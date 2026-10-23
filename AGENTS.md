# FAQ-Mate Agent Guide

Australian General Insurance FAQ Edge RAG system running on Cloudflare Workers, Workers AI (Llama 3.3 70B), Cloudflare AI Search, R2, and D1.

## Context Pointers
- **Roadmap & Phase Tracker:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Living Specifications:** [`docs/specs/`](docs/specs/) (01 Ingestion, 02 Edge Runtime, 03 Regulatory, 04 AFCA Evals)
- **Domain Invariants & Legal Terms:** [`GLOSSARY.md`](GLOSSARY.md)
- **System Architecture & PRD:** [`docs/PRD.md`](docs/PRD.md)
- **Coding Standards & Review Rules:** [`CODING_STANDARDS.md`](CODING_STANDARDS.md)

---

## Antigravity Operating Loop

Execute every task through this 5-stage loop:

1. **Locate & Align:** Read the relevant specification in [`docs/specs/`](docs/specs/) and related tests before modifying code.
2. **Spec-First Verification:** Write or update the test contract in [`tests/`](tests/) before or alongside changes.
3. **Surgical Implementation:** Make minimal, deep-module changes. Preserve existing docstrings, legal citations, and comments.
4. **Fast Verify Gate:** Run `npm run verify` (typecheck + vitest + AFCA evals). Never consider a turn complete on failing tests.
5. **Regulatory Audit:** Validate non-negotiable statutory invariants before reporting completion.

---

## Non-Negotiable Engineering Rules

1. **Pure Edge Runtime Portability (V8 Isolates):**
   - Code inside `src/` executes within Cloudflare Workers isolates (`workerd`).
   - **Strictly Prohibited in `src/`:** Node.js filesystem APIs (`node:fs`, `node:child_process`, `process.cwd()`).
   - Confine filesystem access strictly to `scripts/` and `tests/`. Static corpus lookups in `src/` must use [`src/rag/corpus-data.ts`](src/rag/corpus-data.ts).

2. **Statutory GAW Copy Invariant (Corporations Act s.949A):**
   - Never rephrase or paraphrase the statutory General Advice Warning.
   - Always import and use `STATUTORY_GAW` from [`src/constants/statutory.ts`](src/constants/statutory.ts).

3. **Personal Financial Advice Boundary (ASIC RG 244):**
   - Strictly prohibit personal advice framing (budget, asset value, switching recommendations).
   - Divert to deterministic refusal returning `code: "ADVICE_BOUNDARY_VIOLATION"` and `STATUTORY_SAFE_HARBOR_REFUSAL`.

4. **Life Safety Emergency Interception (Code of Practice):**
   - Intercept active peril prompts with `code: "EMERGENCY_INTERCEPTION"` providing Triple Zero (`000`), SES (`132 500`), and Disaster Welfare (`1800 018 444`).

5. **Zero Raw Query Persistence & k-Anonymity (APP 3/11 & PRD § 5.4):**
   - Never store raw query strings in Cloudflare D1.
   - Hash queries with rotating daily salt via `getDailySalt()` in [`src/guardrails/pii-sanitizer.ts`](src/guardrails/pii-sanitizer.ts).

6. **Schema & Protocol Parity:**
   - D1 schema must maintain exact column names: `hybrid_retrieval_latency_ms` and `inference_ttft_ms` ([`docs/PRD.md § 6.4`](docs/PRD.md#L269-L287)).
   - Edge chat endpoint (`/api/chat`) must strictly emit SSE events: `event: metadata`, `event: token`, `event: done`, and `event: error`.
   - Every request must evaluate and emit `X-RateLimit-*` headers (10 req/min per IP).

---

## Verification Commands

- **Full Verification Gate:** `npm run verify` (runs `typecheck`, `test`, `test:evals`)
- **Fast Typecheck:** `npm run typecheck`
- **Unit & Integration Suite:** `npm test`
- **AFCA Regulatory Evals:** `npm run test:evals`
- **PDS Normalization Batch Check:** `npm run normalize`
- **Corpus R2 Key Audit:** `npm run upload:r2`
