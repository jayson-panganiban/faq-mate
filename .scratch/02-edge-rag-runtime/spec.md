# Specification: Edge RAG Runtime & Cloudflare Worker API

**Module:** `src/index.ts`, `src/rag/`, `src/telemetry/`, `src/types/`  
**Status:** Living Specification  
**Version:** 2.0.0  
**Associated ADRs:** [ADR-0001 (AI Search Hybrid Retrieval)](../adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0003 (Static AST Fallback)](../adr/0003-static-ast-corpus-edge-fallback.md), [ADR-0004 (Insurer Registry)](../adr/0004-canonical-insurer-registry-alias-resolution.md)  
**Associated Specs:** [Spec 03 (Regulatory)](03-regulatory-compliance.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md), [Spec 05 (Frontend)](05-frontend-chat-interface.md)  
**Test Contracts:** [`tests/integration/worker.test.ts`](../../tests/integration/worker.test.ts), [`tests/evals/afca-compliance.test.ts`](../../tests/evals/afca-compliance.test.ts)

---

## 1. Deep Module Interface Contract

The Worker exposes one default `fetch(request, env, ctx)` handler. Retrieval, prompt synthesis, SSE framing, fallback generation, and telemetry are hidden behind it. The only test seam needed is `worker.fetch()` with a mocked `Env`.

### 1.1 Routes

| Route | Method | Behaviour |
| :--- | :--- | :--- |
| `/api/chat` | `POST` | Rate limit → JSON parse → schema validation → PII scrub → gatekeeper → retrieval → SSE stream |
| `/health`, `/api/health` | `GET` | `200 { status: "healthy", popLocation, timestamp, service: "faq-mate-edge-api" }` |
| any | `OPTIONS` | CORS preflight (`GET, POST, OPTIONS`; `Content-Type`) |
| other | any | `404 Not Found` |

### 1.2 Inbound Schema ([`src/types/chat.ts`](../../src/types/chat.ts))

```typescript
export const ChatRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  conversationId: z.string().uuid(),
  history: z.array(ChatMessageHistorySchema).max(6).optional(),
  turnstileToken: z.string().optional(),
  filters: z.object({
    // Any primary insurer name/slug/code or bancassurance alias (ADR-0004)
    insurer: z.string().trim().refine((v) => resolveInsurer(v) !== null).optional(),
    product: z.string().optional(),
    docType: z.enum(["PDS", "TMD", "SPDS", "FSG", "FAQ", "GUIDE"]).default("PDS"),
  }).optional(),
});
```

### 1.3 HTTP Status Contract

| Condition | Status | Body |
| :--- | :--- | :--- |
| Rate limit exceeded | `429` | `{ error: "Too Many Requests", message }` |
| Body is not JSON | `400` | `{ error: "Invalid JSON body" }` |
| Schema validation fails | `422` | `{ error: "Validation Error", details }` |
| Gatekeeper refusal | `200` | Single `event: error` SSE frame |
| Accepted query | `200` | SSE stream (§ 2) |

Every `/api/chat` response (including 400/422/429) carries CORS headers and `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds).

---

## 2. Outbound Protocol: Server-Sent Events

`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Only these four event names are permitted (`AGENTS.md` Rule 6):

| Order | Event | Payload |
| :--- | :--- | :--- |
| 1 | `metadata` | `{ "latency_ms": number, "retrieved_chunks": GroundedChunk[] }` |
| 2..n | `token` | `{ "text": string }` |
| last | `done` | `{ "finish_reason": "stop", "total_tokens": number }` |
| — | `error` | `{ "code": string, "reason"?: string, "message": string, "emergencyHotline"?: string }` |

```typescript
interface GroundedChunk {
  id: string;
  relevanceScore: number;
  content: string;
  source: { insurer: string; product: string; docType: string; section: string; clauseId?: string; effectiveDate?: string };
}
```

**Error codes:**
* `EMERGENCY_INTERCEPTION`: gatekeeper reason `EMERGENCY_LIFE_SAFETY`; includes `emergencyHotline` ([Spec 03 § 2](03-regulatory-compliance.md#2-code-of-practice-cop-life-safety-interception)).
* `ADVICE_BOUNDARY_VIOLATION`: gatekeeper reason `PERSONAL_ADVICE_REQUESTED` ([Spec 03 § 1](03-regulatory-compliance.md#1-advice-boundary-corporations-act-2001--asic-rg-244)).
* `STREAM_ERROR`: unexpected exception after `metadata` was sent.

---

## 3. Cloudflare Bindings ([`src/types/bindings.d.ts`](../../src/types/bindings.d.ts))

| Binding | Required | Use |
| :--- | :--- | :--- |
| `AI_SEARCH` | Optional | `search({ query, topK: 5, rerank: true, filter: { insurer } })`. Absent or throwing → local fallback. |
| `AI` | Yes | `run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages, stream: true, max_tokens: 512 })` (secondary fallback: `@cf/meta/llama-3.1-8b-instruct`) |
| `DB` | Yes | D1 `rag_telemetry_audit` ([PRD § 6.4](../PRD.md#64-d1-telemetry--audit-schema)) |
| `CORPUS_BUCKET` | Yes | R2 corpus (written by `scripts/upload-to-r2.ts`; not read by the Worker) |
| `CONFIG_KV` | Yes | Reserved; not read at runtime |

---

## 4. Worker Execution Flow (`POST /api/chat`)

1. **Rate limiting:** `evaluateRateLimit(cf-connecting-ip)`, a sliding 60 s window, max 10 requests per IP, held in an isolate-local `Map`.
2. **Parse & validate:** `request.json()`, then `ChatRequestSchema.safeParse()`.
3. **PII scrub:** `sanitizePii(query)` → `{ sanitized, queryHash }` ([Spec 03 § 3](03-regulatory-compliance.md#3-australian-privacy-principles-app-3--11)).
4. **Gatekeeper:** `evaluateAdviceBoundary(sanitized)`. On refusal, write telemetry (`adviceFlagTriggered: true`) via `ctx.waitUntil()` and return the single `error` frame.
5. **Retrieval:** `retrievePolicyChunks(sanitizedQuery, filters.insurer, env.AI_SEARCH)`:
   * AI Search bound → map results to `GroundedChunk` (defaults: insurer `General`, product `Insurance`, docType `PDS`, section `General Terms`).
   * Unbound or throws → `localHybridSearch({ query, topK: 5, filter: { insurer } })` over `STATIC_CORPUS_CHUNKS` ([ADR-0003](../adr/0003-static-ast-corpus-edge-fallback.md)).
6. **Prompt synthesis (`synthesizePrompt()` in [`src/rag/prompt-synthesizer.ts`](../../src/rag/prompt-synthesizer.ts)):** Returns `[system, user]` messages. Chunks are wrapped as `<context id="…" source="{insurer} {product} {docType} ({section})">…</context>`; the system prompt enforces the **Australian Insurance Product & Claims Specialist Persona** and the **5-Part Specialist Response Anatomy** ([`GLOSSARY.md § 2`](../../GLOSSARY.md#2-regulatory--compliance-invariants)):
   1. **Direct Definition or Coverage Position:** State the operative PDS or statutory rule immediately (e.g., *Insurance Contracts Regulations 2012 (Cth)* Reg 29D prescribed flood definition).
   2. **Related Event & Policy Structure Demarcation:** Group and distinguish adjacent perils and cover structures (*Flood* vs. *Rainwater Run-off* vs. *Storm Surge / Actions of the Sea* vs. *Escape of Liquid*; *Agreed Value* vs. *Market Value*; *Own Occupation* vs. *Any Occupation TPD*).
   3. **Critical Exclusions, Waiting Periods & Sub-Limits:** Call out 48h/72h embargoes, wear & tear, actions of the sea, retaining walls, unforced entry, unlicensed drivers, and monetary sub-limits.
   4. **Certificate of Insurance (Policy Schedule) Context:** Clarify where optional cover elections, flood opt-outs, specified portable valuables, and Excess tiers appear on the customer's *Certificate of Insurance*.
   5. **Dual-Provenance Citations & Verbatim `STATUTORY_GAW`:** Cite `[Source: {insurer} {product} ({section})]` inline (pairing contractual `PDS`/`SPDS` clauses with `FAQ`/`GUIDE` summaries when both are retrieved) and end with `STATUTORY_GAW`.
   * **Anti-Meta-Language Invariant:** Strictly prohibits internal RAG meta-talk (`"in the provided context"`, `"based on the provided passages"`, `"the context does not state"`). Address the policyholder directly as an authoritative insurance specialist: *"Under the {Insurer} {Product} PDS..."*.
7. **Streaming inference:** Emit `metadata`, then re-encode each Workers AI delta (`response` or `text`) as a `token` event. If `env.AI.run()` throws or returns no stream, emit one `token` carrying `generateFallbackResponse(query, chunks)`, a deterministic specialist answer that cites `[Source: {insurer} {product} ({section})]` and ends with `STATUTORY_GAW`. Then emit `done`.
8. **Telemetry:** `recordTelemetry(env.DB, record)` via `ctx.waitUntil()` with `hybridRetrievalLatencyMs`, `inferenceTtftMs`, `totalMs`, chunk IDs, and `queryHash` (never the raw query).

---

## 5. Deterministic Fallback Rules (`generateFallbackResponse()`)

| Query Signal | Answer Shape |
| :--- | :--- |
| Silent peril (`chimpanzee`, `exotic pet`) | Explicit silent-peril abstention: *"Under the {Insurer} {Product} PDS, accidental damage caused by an unlisted domestic animal or exotic pet is not named in the insured events — the policy is silent on exotic animal hazards."* (AFCA TC-10) |
| TMD eligibility (`eligible`, `target market`, `who is this policy for`) | "According to the Target Market Determination dated …" framing, no eligibility certification (PRD § 5.3) |
| `flood` | 5-part specialist breakdown: Statutory flood definition (*Insurance Contracts Regulations 2012* Reg 29D) + Rainwater run-off vs. Storm surge / Actions of the sea demarcation + 72-hour embargo & retaining wall exclusions + Certificate of Insurance context |
| `unlicensed` / `driver` | Unlicensed/suspended driver exclusion + owner knowledge caveat |
| `ring` / `jewelry` / `jewellery` | \$2,500 total / \$1,000 per item sub-limit + Certificate of Insurance specified item listing requirement |
| `garage` / `theft` / `open` | Forcible and violent entry requirement + unforced entry exclusion |
| Other with chunks | Top chunk specialist synthesis + `[Source: {insurer} {product} ({section})]` citation (zero `"in the provided context"` phrasing) |
| No chunks | Explicit policy silence notice (*"The {Insurer} {Product} PDS is silent on this specific event..."*) |

All branches end with `STATUTORY_GAW` and never emit robotic meta-RAG language (`"in the provided context"`).

---

## 6. Verification

| Test | Asserts |
| :--- | :--- |
| `worker.test.ts` #1 | `/health` returns 200 + `popLocation` |
| `worker.test.ts` #2 | 422 on invalid schema |
| `worker.test.ts` #3–4 | Advice and emergency queries return `event: error` with correct codes/hotlines |
| `worker.test.ts` #5 | Compliant query streams `metadata → token → done` |
| `worker.test.ts` #6 | PII redaction + daily-salted hash |
| `worker.test.ts` #7 | `X-RateLimit-*` headers and 429 after 10 requests |
| `afca-compliance.test.ts` | End-to-end AFCA-10 via `worker.fetch()` ([Spec 04](04-afca-eval-benchmarks.md)) |

---

## 7. Known Gaps

| # | Gap | Current | Target |
| :--- | :--- | :--- | :--- |
| G1 | Turnstile | Client widget only; Worker ignores tokens | Add `turnstileToken` to schema, verify via Siteverify, return `403` on failure |
| G2 | Secondary LLM | 70B failure → deterministic fallback | 70B → `@cf/meta/llama-3.1-8b-instruct` → deterministic |
| G3 | TTFT accuracy | `inferenceTtftMs` captured before streaming begins | Capture at first `token` enqueue; write telemetry after stream close |
| G6 | Feedback | `user_feedback_score` column exists; no route | `POST /api/feedback { id, score: 1 \| -1 }` |
| G7 | Rate limit scope | Isolate-local `Map` (not global across PoPs/isolates) | Cloudflare Rate Limiting binding or Durable Object |
| G9 | SSE richness | No `pop_location`, TTFT, or groundedness in `metadata`/`done` | Additive fields; existing consumers must keep working |
| G11 | Filters | `product` and `docType` validated but not forwarded to retrieval | Forward to AI Search `filter` and `localHybridSearch()` |
