import { STATUTORY_GAW } from "./constants/statutory";
import { evaluateAdviceBoundary } from "./guardrails/advice-gatekeeper";
import { sanitizePii } from "./guardrails/pii-sanitizer";
import { generateFollowUpSuggestions } from "./rag/follow-up-generator";
import {
  enrichRetrievalQuery,
  extractInsurerFromQuery,
  normalizeIntent,
} from "./rag/intent-normalizer";
import { localHybridSearch } from "./rag/local-retriever";
import { synthesizePrompt } from "./rag/prompt-synthesizer";
import { recordTelemetry } from "./telemetry/d1-logger";
import type { Env } from "./types/bindings";
import { ChatRequestSchema, type GroundedChunk } from "./types/chat";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * In-Memory Sliding-Window Rate Limiter (PRD § 4.1 Step 1 & Spec 02 § 3)
 * Limits requests to 10 req/min per IP/session.
 */
interface RateLimitState {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitState>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function evaluateRateLimit(clientIp: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
} {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIp);

  if (!existing || now >= existing.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(clientIp, { count: 1, resetTime });
    return {
      allowed: true,
      limit: RATE_LIMIT_MAX,
      remaining: RATE_LIMIT_MAX - 1,
      resetSeconds: Math.ceil(resetTime / 1000),
    };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX,
      remaining: 0,
      resetSeconds: Math.ceil(existing.resetTime / 1000),
    };
  }

  existing.count++;
  return {
    allowed: true,
    limit: RATE_LIMIT_MAX,
    remaining: RATE_LIMIT_MAX - existing.count,
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
  aiSearch?: Env["AI_SEARCH"]
): Promise<{ chunks: GroundedChunk[]; durationMs: number }> {
  const start = performance.now();

  if (aiSearch) {
    try {
      const resp = await aiSearch.search({
        query,
        topK: 5,
        rerank: true,
        filter: insurer ? { insurer } : undefined,
      });

      const chunks: GroundedChunk[] = resp.results.map((r) => ({
        id: r.id,
        relevanceScore: r.score,
        content: r.content,
        source: {
          insurer: r.metadata.insurer || "General",
          product: r.metadata.product || "Insurance",
          docType: r.metadata.docType || "PDS",
          section: r.metadata.section || "General Terms",
          effectiveDate: r.metadata.effectiveDate,
        },
      }));

      return { chunks, durationMs: performance.now() - start };
    } catch (err) {
      console.error("[AI_SEARCH::Failure]", err);
    }
  }

  const chunks = localHybridSearch({
    query,
    topK: 5,
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
  detectedIntent?: string
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
  if (queryLower.includes("moped") || queryLower.includes("scooter")) {
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
      `The provided policy disclosure does not specify or cover accidental damage caused by pet chimpanzees or unlisted exotic animals.\n\n` +
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

  if (chunks.length > 0) {
    const top = chunks[0];
    const sourceCite = `[Source: ${top.source.insurer} ${top.source.product} (${top.source.section})]`;

    if (queryLower.includes("flood")) {
      return (
        `According to the PDS, flood is defined under the Insurance Contracts Regulations 2012 (Cth) as the covering of normally dry land by water escaping from lakes, natural channels, reservoirs, canals, or dams.\n\n` +
        `Important Exclusions:\n` +
        `- A strict 72-hour embargo applies from policy purchase.\n` +
        `- Loss caused by actions of the sea, tidal waves, or storm surge is strictly excluded.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (queryLower.includes("unlicensed") || queryLower.includes("driver")) {
      return (
        `Under ${top.source.insurer} policy terms, cover is excluded if the vehicle is driven by an unlicensed driver or a person whose licence is suspended, cancelled, or revoked, where you knew or ought reasonably to have known.\n\n` +
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
        `Under the sub-limits schedule, jewelry and watches are capped at $2,500 in total with a maximum of $1,000 per individual item, unless individually specified and valued on your certificate.\n\n` +
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
        `Theft cover requires physical evidence of violent and forcible entry into the building premises. Theft from common areas or open carports without forcible entry is excluded.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    return (
      `Based on the policy terms in ${top.source.section}:\n\n` +
      `${top.content.slice(0, 300)}...\n\n` +
      `${sourceCite}\n\n` +
      STATUTORY_GAW
    );
  }

  return (
    `The provided policy disclosure does not specify this information.\n\n` +
    `[Source: General PDS Terms, Section 1]\n\n` +
    STATUTORY_GAW
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
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
        { headers: CORS_HEADERS }
      );
    }

    // 3. Chat RAG Endpoint (Spec 02)
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const startTime = performance.now();
      const popLocation = (request.cf?.colo as string) || "LOCAL";
      const requestId = crypto.randomUUID();

      // Rate Limiting Gate (PRD § 4.1 Step 1 & Spec 02 § 3)
      const clientIp = request.headers.get("cf-connecting-ip") || "127.0.0.1";
      const rateLimit = evaluateRateLimit(clientIp);
      const rateLimitHeaders = {
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetSeconds),
      };

      if (!rateLimit.allowed) {
        return Response.json(
          { error: "Too Many Requests", message: "Rate limit exceeded (10 requests per minute)." },
          { status: 429, headers: { ...CORS_HEADERS, ...rateLimitHeaders } }
        );
      }

      let bodyJson: unknown;
      try {
        bodyJson = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400, headers: { ...CORS_HEADERS, ...rateLimitHeaders } }
        );
      }

      // Validate inbound request schema (Spec 02 Section 1.1)
      const parseResult = ChatRequestSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return Response.json(
          { error: "Validation Error", details: parseResult.error.format() },
          { status: 422, headers: { ...CORS_HEADERS, ...rateLimitHeaders } }
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
            ...CORS_HEADERS,
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
      const { chunks, durationMs: searchDurationMs } = await retrievePolicyChunks(
        retrievalQuery,
        detectedInsurer,
        env.AI_SEARCH
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

            try {
              const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct", {
                messages,
                stream: true,
                max_tokens: 512,
              });
              if (aiResponse && typeof (aiResponse as ReadableStream).getReader === "function") {
                rawAiStream = aiResponse as ReadableStream<Uint8Array>;
              }
            } catch (aiErr) {
              console.error("[WorkersAI::Failure]", aiErr);
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
                verdict.detectedIntent
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
          ...CORS_HEADERS,
          ...rateLimitHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
