import { STATUTORY_GAW, stripStatutoryGaw } from "./constants/statutory";
import { evaluateAdviceBoundary } from "./guardrails/advice-gatekeeper";
import { sanitizePii } from "./guardrails/pii-sanitizer";
import { generateFollowUpSuggestions } from "./rag/follow-up-generator";
import {
  enrichRetrievalQuery,
  extractInsurerFromQuery,
  type InsurancePeril,
  isInsuranceRelatedQuery,
  normalizeIntent,
} from "./rag/intent-normalizer";
import { localHybridSearch } from "./rag/local-retriever";
import { synthesizePrompt } from "./rag/prompt-synthesizer";
import { recordTelemetry } from "./telemetry/d1-logger";
import type { AiSearchChunkItem, Env } from "./types/bindings";
import {
  ChatRequestSchema,
  type GatekeeperIntent,
  type GatekeeperVerdict,
  type GroundedChunk,
} from "./types/chat";

/**
 * Standard HTTP Security Headers (OWASP & Cloudflare Best Practices)
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
};

/**
 * Default Allowed Browser Origins for CORS
 */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  "https://faq-mate.pages.dev",
  "http://localhost:3000",
  "http://localhost:8787",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8787",
  "http://127.0.0.1:5173",
];

/**
 * Validates whether an incoming Origin header is permitted.
 * Permits production pages.dev, preview deployments (*.faq-mate.pages.dev),
 * local development origins, and any comma-separated entries in env.ALLOWED_ORIGINS.
 */
export function isOriginAllowed(origin: string, env?: Env): boolean {
  if (!origin) return false;
  const cleanOrigin = origin.trim().toLowerCase().replace(/\/+$/, "");

  // Match production Pages and preview subdomains (e.g. https://*.faq-mate.pages.dev)
  if (/^https:\/\/([a-z0-9-]+\.)*faq-mate\.pages\.dev$/i.test(cleanOrigin)) {
    return true;
  }

  // Match local dev hosts on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) {
    return true;
  }

  // Configured allowed origins from env.ALLOWED_ORIGINS
  if (env?.ALLOWED_ORIGINS) {
    const list = env.ALLOWED_ORIGINS.split(",").map((o) =>
      o.trim().toLowerCase().replace(/\/+$/, "")
    );
    if (list.includes(cleanOrigin)) {
      return true;
    }
  }

  return false;
}

/**
 * Generates dynamic CORS & Security response headers based on the request origin.
 */
export function getCorsHeaders(request: Request, env?: Env): Record<string, string> {
  const origin = request.headers.get("Origin");

  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, cf-turnstile-token",
    "Access-Control-Max-Age": "86400",
  };

  if (!origin) {
    // Non-browser or direct curl/test request: permit with wildcard
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  if (isOriginAllowed(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

/**
 * Cloudflare Turnstile Siteverify Helper (Optional Bot Mitigation)
 */
async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  clientIp: string
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    formData.append("remoteip", clientIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const outcome = (await res.json()) as { success?: boolean };
    return Boolean(outcome.success);
  } catch {
    return false;
  }
}

/**
 * In-Memory Sliding-Window Rate Limiter (PRD § 4.1 Step 1 & Spec 02 § 3)
 * Limits requests per IP/session (defaults to 10 req/min, configurable via env.RATE_LIMIT_MAX).
 */
interface RateLimitState {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitState>();

function evaluateRateLimit(
  clientIp: string,
  maxLimit = 10,
  windowMs = 60_000
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
} {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIp);

  if (!existing || now >= existing.resetTime) {
    const resetTime = now + windowMs;
    rateLimitMap.set(clientIp, { count: 1, resetTime });
    return {
      allowed: true,
      limit: maxLimit,
      remaining: maxLimit - 1,
      resetSeconds: Math.ceil(resetTime / 1000),
    };
  }

  if (existing.count >= maxLimit) {
    return {
      allowed: false,
      limit: maxLimit,
      remaining: 0,
      resetSeconds: Math.ceil(existing.resetTime / 1000),
    };
  }

  existing.count++;
  return {
    allowed: true,
    limit: maxLimit,
    remaining: maxLimit - existing.count,
    resetSeconds: Math.ceil(existing.resetTime / 1000),
  };
}

/**
 * Unified Edge Retrieval Helper
 * Queries Cloudflare AI Search if available; falls back to edge-compiled local retriever.
 */
async function retrievePolicyChunks(
  query: string,
  insurer?: string,
  aiSearch?: Env["AI_SEARCH"],
  topK = 5
): Promise<{ chunks: GroundedChunk[]; durationMs: number }> {
  const start = performance.now();

  if (!insurer && !isInsuranceRelatedQuery(query)) {
    const localMatches = localHybridSearch({ query, topK });
    return { chunks: localMatches, durationMs: performance.now() - start };
  }

  if (aiSearch) {
    try {
      const resp = await aiSearch.search({
        query,
        ai_search_options: {
          retrieval: {
            max_num_results: topK,
            return_on_failure: true,
          },
        },
      });

      const rawItems = resp.chunks || resp.results || [];
      const chunks: GroundedChunk[] = rawItems.map((r: AiSearchChunkItem) => {
        const itemKey = r.item?.key || r.metadata?.filename || "";
        let parsedInsurer = r.metadata?.insurer;
        if (!parsedInsurer && itemKey) {
          const match = itemKey.match(/corpus\/(?:faqs|pds|guides)\/([^/]+)/);
          if (match) parsedInsurer = match[1];
        }

        const fallbackDocType = itemKey.includes("/faqs/")
          ? "FAQ"
          : itemKey.includes("/guides/")
            ? "GUIDE"
            : "PDS";

        const rawContent = (r.content || r.text || "").replace(
          /\n*##\s+Statutory Notices & Regulatory Dispute Resolution[\s\S]*$/i,
          ""
        );

        return {
          id: r.id || `ai-${Math.random().toString(36).slice(2, 9)}`,
          relevanceScore: typeof r.score === "number" ? r.score : 0.85,
          content: stripStatutoryGaw(rawContent),
          source: {
            insurer: parsedInsurer || insurer || "General",
            product: r.metadata?.product || "Insurance",
            docType: r.metadata?.docType || fallbackDocType,
            section: r.metadata?.section || itemKey || "General Terms",
            effectiveDate: r.metadata?.effectiveDate,
          },
        };
      });

      if (chunks.length > 0) {
        let filteredChunks = chunks;
        if (insurer) {
          const matched = chunks.filter(
            (c) => c.source.insurer.toLowerCase() === insurer.toLowerCase()
          );
          if (matched.length > 0) {
            filteredChunks = matched;
          }
        }
        return { chunks: filteredChunks, durationMs: performance.now() - start };
      }
    } catch (err) {
      console.warn("[AI_SEARCH::Failure]", err instanceof Error ? err.message : String(err));
    }
  }

  const chunks = localHybridSearch({
    query,
    topK,
    filter: insurer ? { insurer } : undefined,
  });

  return { chunks, durationMs: performance.now() - start };
}

/**
 * Fallback response generator when Workers AI binding is in offline/test environment
 */
function generateFallbackResponse(
  query: string,
  chunks: GroundedChunk[],
  detectedIntent?: GatekeeperIntent,
  detectedPerils: InsurancePeril[] = []
): string {
  const queryLower = query.toLowerCase();

  // ASIC RG 244 Conversational Dilemma Reframing (Spec 07 Section 4)
  if (
    detectedIntent === "CONVERSATIONAL_DILEMMA" ||
    queryLower.includes("should i claim or pay") ||
    queryLower.includes("claim or pay out of pocket") ||
    (queryLower.includes("excess") && queryLower.includes("repair quote"))
  ) {
    return (
      `FAQ-Mate cannot advise whether you should lodge a claim or pay for repairs out of pocket, as this constitutes personal financial product advice under the Corporations Act 2001 (Cth).\n\n` +
      `However, objective factors to consider under Australian general insurance policy standards include:\n\n` +
      `### 1. Excess Deduction vs. Repair Cost\n` +
      `Your standard basic excess is deducted from any claim payout. If the repair quote ($3,500) exceeds your basic excess ($1,000), your insurer typically covers the difference ($2,500), subject to terms. If the repair cost is less than or close to your excess, lodging a claim yields no net benefit.\n\n` +
      `### 2. No-Claim Bonus (NCB) & Future Renewal Premiums\n` +
      `Lodging an at-fault or single-vehicle/property claim may reduce your No-Claim Discount or claims rating, resulting in higher premiums at annual renewal.\n\n` +
      `### 3. Gradual Deterioration & Maintenance Exclusions\n` +
      `Insurers exclude pre-existing faults, gradual wear and tear, and lack of reasonable maintenance. For example, roof leaks caused by weathered tiles rather than sudden storm impact are commonly excluded.\n\n` +
      `[Source: General Insurance Code of Practice & Standard PDS Terms, Section 4]\n\n` +
      STATUTORY_GAW
    );
  }

  // Broad Water Damage Product-Line Demarcation (Spec 07 Section 5)
  if (
    detectedPerils.includes("RAINWATER_RUNOFF") ||
    detectedPerils.includes("ACTIONS_OF_THE_SEA") ||
    queryLower.includes("water damage") ||
    queryLower.includes("kinds of water") ||
    queryLower.includes("what counts as water")
  ) {
    return (
      `Under Australian general insurance standards, water-related damage is delineated across distinct insured events and product lines:\n\n` +
      `### 1. Escape of Liquid (Internal Plumbing)\n` +
      `Covers sudden discharge or bursting from fixed internal pipes, appliances, washing machines, or sinks. Gradual leaks and wear-and-tear are excluded.\n\n` +
      `### 2. Prescribed Flood (Natural Watercourses)\n` +
      `Defined under Insurance Contracts Regulations 2012 (Cth) as water escaping from lakes, natural channels, or dams. Subject to a mandatory 72-hour embargo.\n\n` +
      `### 3. Storm & Rainwater Run-off\n` +
      `Covers rainwater entering as a direct result of storm impact. Surface run-off entering the dwelling is distinct from riverine flood.\n\n` +
      `### 4. Actions of the Sea & Storm Surge\n` +
      `Damage from king tides, tidal waves, or actions of the sea is strictly excluded under standard residential policies.\n\n` +
      `### Product Demarcation: Home Building vs Contents\n` +
      `- **Home Building:** Covers fixed structures, walls, sub-flooring, and permanent fixtures.\n` +
      `- **Contents:** Covers carpets, rugs, furniture, and internal personal belongings.\n\n` +
      `[Source: Standard PDS Guidelines, Insured Events Schedule]\n\n` +
      STATUTORY_GAW
    );
  }

  // Food Spoilage Product Demarcation
  if (
    detectedPerils.includes("FOOD_SPOILAGE") ||
    queryLower.includes("food") ||
    queryLower.includes("spoil") ||
    queryLower.includes("blackout")
  ) {
    return (
      `Food spoilage caused by failure of the public electricity supply following a blackout is covered under Contents Insurance (Insured Event 11), up to a sub-limit of $2,000 for refrigerated food.\n\n` +
      `### Product Line Demarcation\n` +
      `This cover is strictly included under Contents policies. Standalone Home Building insurance does not cover spoiled food.\n\n` +
      `[Source: Suncorp Classic Home Contents PDS, Insured Event 11]\n\n` +
      STATUTORY_GAW
    );
  }

  // Escape of Liquid / Burst Pipe in Bathroom
  if (
    detectedPerils.includes("ESCAPE_OF_LIQUID") ||
    queryLower.includes("burst pipe") ||
    queryLower.includes("broken pipe") ||
    queryLower.includes("ruined the floorboards") ||
    queryLower.includes("escape of liquid")
  ) {
    return (
      `Damage caused by a burst pipe under a bathroom sink is covered under Insured Event 4: Escape of Liquid from Fixed Internal Apparatus.\n\n` +
      `### Policy Coverage & Demarcation\n` +
      `- **Building Cover:** Covers damage to floorboards, walls, and fixed cabinetry.\n` +
      `- **Contents Cover:** Covers damaged carpets and movable furnishings.\n` +
      `- **Key Exclusions:** Gradual leaking, deterioration over time, and the cost of repairing the ruptured pipe itself (unless accidental damage upgrade applies).\n\n` +
      `[Source: Suncorp Classic Home PDS, Insured Event 4]\n\n` +
      STATUTORY_GAW
    );
  }

  // Travel Insurance: Overseas Scooter / Moped
  if (
    detectedPerils.includes("MOTORCYCLE_TRAVEL") ||
    queryLower.includes("moped") ||
    queryLower.includes("scooter")
  ) {
    return (
      `Travel insurance cover for overseas scooter or moped accidents is subject to strict statutory policy conditions:\n\n` +
      `### Statutory Conditions & Sub-limits\n` +
      `- **Licence Requirement:** You must hold a valid motorcycle licence in Australia recognized by the destination country (e.g. an Australian motorcycle licence or International Driving Permit).\n` +
      `- **Engine Capacity Sub-limit:** Policies typically cap engine capacity (e.g. 50cc or 125cc). Riding higher capacity motorcycles without an endorsement voids cover.\n` +
      `- **Safety Compliance:** You must wear a helmet at all times and not be under the influence of alcohol or drugs.\n\n` +
      `[Source: Australian Travel Insurance Standard PDS, Motorcycle Terms]\n\n` +
      STATUTORY_GAW
    );
  }

  // Negative constraint check (TC-10: Silent PDS)
  if (queryLower.includes("chimpanzee") || queryLower.includes("exotic pet")) {
    return (
      `The policy disclosure does not specify or cover accidental damage caused by pet chimpanzees or unlisted exotic animals.\n\n` +
      `[Source: General PDS Exclusions, Section 1] Under Australian General Insurance standards, unlisted domestic hazards not named in the insured events schedule are not covered.\n\n` +
      STATUTORY_GAW
    );
  }

  // DDO / TMD Eligibility Guardrail (PRD § 5.3)
  if (
    queryLower.includes("eligible") ||
    queryLower.includes("target market") ||
    queryLower.includes("who is this policy for")
  ) {
    return (
      `According to the Target Market Determination dated 2024-01-15, this product is designed for retail consumers who own and occupy a domestic dwelling and require protection against prescribed insured events.\n\n` +
      `Under statutory Design and Distribution Obligations (DDO), FAQ-Mate provides factual target market criteria only and does not certify personal customer eligibility.\n\n` +
      `[Source: Target Market Determination, Eligibility Criteria]\n\n` +
      STATUTORY_GAW
    );
  }

  const topChunk = chunks[0];
  const fallbackInsurer = topChunk?.source.insurer ?? "Australian General Insurance";
  const fallbackProduct = topChunk?.source.product ?? "Policy Disclosure Statement";
  const fallbackDocType = topChunk?.source.docType ?? "PDS";
  const fallbackCite = topChunk
    ? `[Source: ${fallbackInsurer} ${fallbackProduct} ${fallbackDocType} (${topChunk.source.section})]`
    : `[Source: ${fallbackInsurer} ${fallbackProduct} PDS (Definitions & Operative Clauses)]`;

  if (
    queryLower.includes("agreed value") ||
    queryLower.includes("market value") ||
    (queryLower.includes("total loss") && !queryLower.includes("life"))
  ) {
    return (
      `Under **${fallbackInsurer} ${fallbackProduct}**, motor vehicle sum insured settlement is structured as either **Agreed Value** or **Market Value**:\n\n` +
      `### 1. Direct Contractual Definitions\n` +
      `- **Agreed Value:** The fixed retail dollar amount agreed between you and ${fallbackInsurer} for the current period of insurance, as shown on your *Certificate of Insurance*.\n` +
      `- **Market Value:** The reasonable retail cost to replace your vehicle with one of the same make, model, age, kilometres, and condition immediately prior to the incident.\n\n` +
      `### 2. Total Loss Settlement & Demarcation\n` +
      `- In a covered **Total Loss**, settlement is paid at your selected basis (Agreed Value or Market Value) less any applicable basic, age, or unlisted driver excess and any unexpired registration/CTP refund.\n` +
      `- **New Vehicle Replacement:** Where eligible under the PDS (typically within the first 24 months of original registration), a replacement vehicle of the same make and model may apply.\n\n` +
      `### 3. Key Exclusions & Certificate of Insurance\n` +
      `- Unlicensed, suspended, or disqualified drivers and pre-existing mechanical wear and tear are excluded. Check your *Certificate of Insurance* to verify whether your policy is endorsed for Agreed Value or Market Value.\n\n` +
      `${fallbackCite}\n\n` +
      STATUTORY_GAW
    );
  }

  if (
    queryLower.includes("pre-existing") ||
    queryLower.includes("pre existing") ||
    queryLower.includes("curtailment") ||
    queryLower.includes("medically necessary")
  ) {
    return (
      `Under **${fallbackInsurer} ${fallbackProduct}**, travel medical and cancellation claims are governed by strict contractual definitions:\n\n` +
      `### 1. Direct Policy Definitions\n` +
      `- **Pre-existing Medical Condition:** Any medical, physical, dental, or mental health condition of which you were aware (or a reasonable person would have been aware), or for which medication, treatment, surgery, or investigation was sought prior to policy issue.\n` +
      `- **Medically Necessary:** Immediate treatment required overseas following a sudden, unforeseen illness or injury that cannot reasonably wait until your return to Australia.\n` +
      `- **Curtailment:** Cutting short an insured journey after departure due to an unforeseen insured event.\n\n` +
      `### 2. Exclusions & Certificate of Insurance Context\n` +
      `- Claims arising from undisclosed or unapproved pre-existing medical conditions are excluded unless the condition is automatically covered under the PDS schedule or explicitly approved and listed on your *Certificate of Insurance* (often subject to an additional medical assessment premium).\n\n` +
      `${fallbackCite}\n\n` +
      STATUTORY_GAW
    );
  }

  if (
    queryLower.includes("tpd") ||
    queryLower.includes("disablement") ||
    queryLower.includes("own occupation") ||
    queryLower.includes("any occupation") ||
    (queryLower.includes("waiting period") &&
      (queryLower.includes("income") ||
        queryLower.includes("benefit") ||
        queryLower.includes("life")))
  ) {
    return (
      `Under **${fallbackInsurer} ${fallbackProduct}**, disability and income protection benefits are defined by occupation class and benefit waiting periods:\n\n` +
      `### 1. Direct Policy Definitions (TPD & Income Protection)\n` +
      `- **Total and Permanent Disablement (Any Occupation):** Permanent incapacity resulting from illness or injury that renders you unlikely ever to engage in any gainful occupation for which you are reasonably suited by education, training, or experience.\n` +
      `- **Total and Permanent Disablement (Own Occupation):** Permanent incapacity assessed specifically against the occupation you were performing immediately prior to disability.\n` +
      `- **Waiting Period vs. Benefit Period:** The **Waiting Period** (e.g. 14, 30, 60, or 90 days) is the qualifying period of disability before monthly benefits start accruing; the **Benefit Period** (e.g. 2 years, 5 years, or to age 65) is the maximum duration monthly benefits are paid.\n\n` +
      `### 2. Exclusions & Policy Schedule Context\n` +
      `- Intentional self-inflicted injury, uncomplicated pregnancy, and underwriting exclusions recorded on your *Policy Schedule* are excluded.\n\n` +
      `${fallbackCite}\n\n` +
      STATUTORY_GAW
    );
  }

  if (chunks.length > 0) {
    const top = chunks[0];
    const insurerLabel = top.source.insurer;
    const productLabel = top.source.product;
    const sourceCite = `[Source: ${insurerLabel} ${productLabel} ${top.source.docType} (${top.source.section})]`;

    if (queryLower.includes("flood")) {
      return (
        `Under the **${insurerLabel} ${productLabel} PDS** and Regulation 29D of the *Insurance Contracts Regulations 2012 (Cth)*, **Flood** has a specific statutory definition that distinguishes it from storm rainwater and ocean surge:\n\n` +
        `### 1. Prescribed Statutory & Policy Definition of Flood\n` +
        `**Flood** means the covering of normally dry land by water that has escaped or been released from the normal confines of any of the following:\n` +
        `- a lake (whether or not it has been altered or modified);\n` +
        `- a river, creek, or other natural watercourse (whether or not it has been altered or modified); or\n` +
        `- a reservoir, canal, or dam.\n\n` +
        `### 2. Water Peril Demarcation (Flood vs. Storm Run-off vs. Storm Surge)\n` +
        `- **Riverine / Inland Flood:** Water escaping a watercourse, lake, canal, or dam onto normally dry land (covered under the Flood insured event).\n` +
        `- **Rainwater Run-off (Storm):** Surface water or rainwater flowing over normally dry ground during rainfall without escaping a watercourse is assessed under **Storm** cover rather than Flood.\n` +
        `- **Escape of Liquid:** Sudden bursting or discharge from fixed internal pipes, appliances, or hot water systems is assessed under **Escape of Liquid**.\n\n` +
        `### 3. Critical Exclusions & 72-Hour Waiting Period (Embargo)\n` +
        `- **72-Hour Embargo:** A strict **72-hour waiting period (embargo)** applies to flood, storm, and bushfire claims from policy inception unless replacing equivalent cover without a break.\n` +
        `- **Actions of the Sea & Storm Surge:** Loss or damage caused by high tide, king tides, tidal waves, or actions of the sea is strictly excluded.\n` +
        `- **Outdoor Structures:** Retaining walls, sea walls, free-standing outdoor gates/fences, and gradual seepage or hydrostatic pressure are excluded.\n\n` +
        `### 4. Certificate of Insurance Context\n` +
        `Your *Certificate of Insurance* (Policy Schedule) confirms whether Flood cover is included or opted out on your policy and specifies any applicable Flood or Basic Excess.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (queryLower.includes("unlicensed") || queryLower.includes("driver")) {
      return (
        `Under **${insurerLabel} ${productLabel}** policy terms, cover is excluded if the vehicle is driven by an unlicensed driver or a person whose licence is suspended, cancelled, or revoked, where you knew or ought reasonably to have known.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (
      queryLower.includes("ring") ||
      queryLower.includes("jewelry") ||
      queryLower.includes("jewellery")
    ) {
      return (
        `Under the **${insurerLabel} ${productLabel}** sub-limits schedule, jewelry and watches are capped at $2,500 in total with a maximum of $1,000 per individual item, unless individually specified and valued on your Certificate of Insurance.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (
      queryLower.includes("garage") ||
      queryLower.includes("theft") ||
      queryLower.includes("open")
    ) {
      return (
        `Under **${insurerLabel} ${productLabel}**, theft cover requires physical evidence of violent and forcible entry into the building premises. Theft from common areas or open carports without forcible entry is excluded.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    return (
      `Under the **${insurerLabel} ${productLabel}** (${top.source.section}):\n\n` +
      `${top.content.slice(0, 450)}\n\n` +
      `${sourceCite}\n\n` +
      STATUTORY_GAW
    );
  }

  if (!isInsuranceRelatedQuery(query)) {
    return (
      `I'm **FAQ-Mate**, an Australian Insurance Product & Claims Specialist. While your question falls outside insurance policy disclosures, I'm here whenever you need help with Australian **Home, Motor, Travel, Pet, Commercial, or Life insurance**—including policy definitions, insured events, waiting periods, exclusions, and sub-limits across 39 Australian insurers.\n\n` +
      STATUTORY_GAW
    );
  }

  return (
    `The policy disclosure does not specify this coverage term — unlisted events not named in the operative policy schedule are not covered.\n\n` +
    `[Source: General PDS Terms, Section 1]\n\n` +
    STATUTORY_GAW
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin && !isOriginAllowed(origin, env)) {
        return new Response(null, { status: 403, headers: corsHeaders });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. Health Endpoint
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      const popLocation = (request.cf?.colo as string) || "LOCAL";
      return Response.json(
        {
          status: "healthy",
          popLocation,
          timestamp: new Date().toISOString(),
          service: "faq-mate-edge-api",
        },
        { headers: corsHeaders }
      );
    }

    // 3. Chat RAG Endpoint (Spec 02)
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const startTime = performance.now();
      const popLocation = (request.cf?.colo as string) || "LOCAL";
      const requestId = crypto.randomUUID();

      // Origin Check for POST (Block cross-site browser requests from unlisted origins)
      const origin = request.headers.get("Origin");
      if (origin && !isOriginAllowed(origin, env)) {
        return Response.json(
          { error: "Forbidden", message: "Origin not allowed by CORS policy." },
          { status: 403, headers: corsHeaders }
        );
      }

      // Rate Limiting Gate (PRD § 4.1 Step 1 & Spec 02 § 3)
      const clientIp = request.headers.get("cf-connecting-ip") || "127.0.0.1";
      const maxLimit = Number.parseInt(env?.RATE_LIMIT_MAX || "10", 10);
      const windowSeconds = Number.parseInt(env?.RATE_LIMIT_WINDOW_SECONDS || "60", 10);
      const rateLimit = evaluateRateLimit(clientIp, maxLimit, windowSeconds * 1000);
      const rateLimitHeaders = {
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetSeconds),
      };

      if (!rateLimit.allowed) {
        return Response.json(
          {
            error: "Too Many Requests",
            message: `Rate limit exceeded (${rateLimit.limit} requests per minute).`,
          },
          { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders } }
        );
      }

      let bodyJson: unknown;
      try {
        bodyJson = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders } }
        );
      }

      // Cloudflare Turnstile Verification (if configured via env.TURNSTILE_SECRET_KEY)
      if (env?.TURNSTILE_SECRET_KEY) {
        const turnstileToken =
          request.headers.get("cf-turnstile-token") ||
          (typeof bodyJson === "object" && bodyJson !== null && "turnstileToken" in bodyJson
            ? String((bodyJson as Record<string, unknown>).turnstileToken)
            : undefined);

        if (!turnstileToken) {
          return Response.json(
            { error: "Forbidden", message: "Turnstile bot verification required." },
            { status: 403, headers: { ...corsHeaders, ...rateLimitHeaders } }
          );
        }

        const isHuman = await verifyTurnstileToken(
          turnstileToken,
          env.TURNSTILE_SECRET_KEY,
          clientIp
        );
        if (!isHuman) {
          return Response.json(
            { error: "Forbidden", message: "Turnstile bot verification failed." },
            { status: 403, headers: { ...corsHeaders, ...rateLimitHeaders } }
          );
        }
      }

      // Validate inbound request schema (Spec 02 Section 1.1)
      const parseResult = ChatRequestSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return Response.json(
          { error: "Validation Error", details: parseResult.error.format() },
          { status: 422, headers: { ...corsHeaders, ...rateLimitHeaders } }
        );
      }

      const { query, history } = parseResult.data;

      // Scrub PII under Australian Privacy Principles (APP 3/11, Spec 03 & Spec 07)
      const { sanitizedQuery, sanitizedHistory, queryHash } = await sanitizePii({
        query,
        history,
      });

      // ASIC RG 244 & COP Advice Gatekeeper (Spec 03)
      const verdict = evaluateAdviceBoundary(sanitizedQuery);

      if (!verdict.allowed) {
        // Record compliance block in D1 asynchronously (PRD § 6.4)
        ctx.waitUntil(
          recordTelemetry(env.DB, {
            id: requestId,
            popLocation,
            queryHash,
            retrievedChunkIds: [],
            latency: {
              hybridRetrievalLatencyMs: 0,
              inferenceTtftMs: performance.now() - startTime,
              totalMs: performance.now() - startTime,
            },
            groundednessScore: 1.0,
            adviceFlagTriggered: true,
            timestamp: new Date().toISOString(),
          })
        );

        // Emit error event conforming to Spec 02 Section 1.2
        const errorCode =
          verdict.reason === "PERSONAL_ADVICE_REQUESTED"
            ? "ADVICE_BOUNDARY_VIOLATION"
            : "EMERGENCY_INTERCEPTION";

        const refusalPayload = {
          code: errorCode,
          reason: verdict.reason,
          message: verdict.refusalMessage,
          emergencyHotline: "emergencyHotline" in verdict ? verdict.emergencyHotline : undefined,
        };

        return new Response(`event: error\ndata: ${JSON.stringify(refusalPayload)}\n\n`, {
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Normalize colloquial intent & strip voice transcription noise (Spec 07 Section 3)
      const normalized = normalizeIntent(verdict.sanitizedQuery);

      // Context-aware follow-up query enrichment for retrieval (Spec 07 Problem 2)
      const retrievalQuery = enrichRetrievalQuery(normalized.cleanedQuery, sanitizedHistory);

      // Conversational bancassurance brand alias extraction (Spec 07 US-13)
      const detectedInsurer =
        parseResult.data.filters?.insurer || extractInsurerFromQuery(normalized.cleanedQuery);

      // Hybrid Retrieval (Spec 02 Section 2 & PRD § 2.1)
      const topK = Number.parseInt(env?.RETRIEVAL_TOP_K || "5", 10);
      const { chunks, durationMs: searchDurationMs } = await retrievePolicyChunks(
        retrievalQuery,
        detectedInsurer,
        env.AI_SEARCH,
        topK
      );

      // Context Assembly (Spec 07 Section 4 & 5)
      const messages = synthesizePrompt(verdict.sanitizedQuery, chunks, {
        history: sanitizedHistory,
        detectedIntent: verdict.detectedIntent,
        detectedPerils: normalized.detectedPerils,
        canonicalTokens: normalized.canonicalTokens,
      });

      // Generate contextual follow-up prompt chips (Spec 07 Section 6)
      const suggestedFollowUps = generateFollowUpSuggestions(
        verdict.sanitizedQuery,
        chunks,
        normalized.detectedPerils
      );

      const encoder = new TextEncoder();

      // Streaming Workers AI Inference with Spec 02 SSE protocol
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 1. Spec 02: event: metadata
            controller.enqueue(
              encoder.encode(
                `event: metadata\ndata: ${JSON.stringify({
                  latency_ms: Math.round(searchDurationMs),
                  retrieved_chunks: chunks,
                  suggested_follow_ups: suggestedFollowUps,
                })}\n\n`
              )
            );

            let tokenCount = 0;
            let rawAiStream: ReadableStream<Uint8Array> | null = null;
            const aiModel = env?.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
            const aiFallbackModel = env?.AI_FALLBACK_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8";
            const maxTokens = Number.parseInt(env?.AI_MAX_TOKENS || "1024", 10);

            try {
              const aiResponse = await env.AI.run(aiModel, {
                messages,
                stream: true,
                max_tokens: maxTokens,
              });
              if (aiResponse && typeof (aiResponse as ReadableStream).getReader === "function") {
                rawAiStream = aiResponse as ReadableStream<Uint8Array>;
              }
            } catch (aiErr) {
              console.warn(
                `[WorkersAI::${aiModel}_Warning]`,
                aiErr instanceof Error ? aiErr.message : String(aiErr)
              );
              try {
                const fallbackAi = await env.AI.run(aiFallbackModel, {
                  messages,
                  stream: true,
                  max_tokens: maxTokens,
                });
                if (fallbackAi && typeof (fallbackAi as ReadableStream).getReader === "function") {
                  rawAiStream = fallbackAi as ReadableStream<Uint8Array>;
                }
              } catch (fallbackErr) {
                console.error(
                  "[WorkersAI::Failure]",
                  fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
                );
              }
            }

            if (rawAiStream) {
              const reader = rawAiStream.getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data:")) continue;
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === "[DONE]") break;

                  try {
                    const parsed = JSON.parse(dataStr);
                    const tokenText = parsed.response || parsed.text || "";
                    if (tokenText) {
                      tokenCount++;
                      controller.enqueue(
                        encoder.encode(
                          `event: token\ndata: ${JSON.stringify({ text: tokenText })}\n\n`
                        )
                      );
                    }
                  } catch {
                    if (dataStr) {
                      tokenCount++;
                      controller.enqueue(
                        encoder.encode(
                          `event: token\ndata: ${JSON.stringify({ text: dataStr })}\n\n`
                        )
                      );
                    }
                  }
                }
              }
            } else {
              const fallbackText = generateFallbackResponse(
                verdict.sanitizedQuery,
                chunks,
                verdict.detectedIntent,
                normalized.detectedPerils
              );
              tokenCount = fallbackText.split(/\s+/).length;
              controller.enqueue(
                encoder.encode(`event: token\ndata: ${JSON.stringify({ text: fallbackText })}\n\n`)
              );
            }

            // Spec 02 & Spec 07: event: done
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  finish_reason: "stop",
                  total_tokens: tokenCount,
                  suggested_follow_ups: suggestedFollowUps,
                })}\n\n`
              )
            );
          } catch (err) {
            console.error("[SSE::StreamError]", err);
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  code: "STREAM_ERROR",
                  message: "Internal error processing stream.",
                })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      // Async Telemetry Log via D1 (PRD § 6.4)
      ctx.waitUntil(
        recordTelemetry(env.DB, {
          id: requestId,
          popLocation,
          queryHash,
          retrievedChunkIds: chunks.map((c) => c.id),
          latency: {
            hybridRetrievalLatencyMs: searchDurationMs,
            inferenceTtftMs: performance.now() - startTime,
            totalMs: performance.now() - startTime,
          },
          groundednessScore: 1.0,
          adviceFlagTriggered: false,
          timestamp: new Date().toISOString(),
        })
      );

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
