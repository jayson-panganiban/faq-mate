# Coding Standards & Architecture Invariants: FAQ-Mate

This document governs coding standards and review criteria for the FAQ-Mate codebase. It is consulted by implementation and review agents.

---

## 1. Statutory Invariants & Legal Disclosures

1. **General Advice Warning (GAW) Canonical Invariant:**
   - The statutory warning under Section 949A of the *Corporations Act 2001 (Cth)* must **never** be rephrased or paraphrased in production code.
   - Always import and use `STATUTORY_GAW` from [`src/constants/statutory.ts`](src/constants/statutory.ts).
   - Canonical wording:
     > *"This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent advice."*

2. **Personal Financial Advice Boundary (ASIC RG 244):**
   - The system is prohibited from providing personal financial product advice.
   - All advice boundary rejections must return `code: "ADVICE_BOUNDARY_VIOLATION"` and output `STATUTORY_SAFE_HARBOR_REFUSAL` verbatim.

3. **Life Safety Emergency Escalation (Code of Practice):**
   - Active life/property danger prompts must be intercepted with `code: "EMERGENCY_INTERCEPTION"` providing Triple Zero (`000`), SES (`132 500`), and Disaster Welfare Services (`1800 018 444`).

---

## 2. Cloudflare Edge Runtime Portability

1. **Pure V8 Isolate Isolation:**
   - Code inside `src/` executes within Cloudflare Workers (workerd).
   - **Prohibited in `src/`:** Node.js filesystem APIs (`node:fs`, `node:child_process`, `process.cwd()`).
   - Pre-compile any local static assets or corpus lookups into typed modules (e.g., [`src/rag/corpus-data.ts`](src/rag/corpus-data.ts)).
   - Filesystem operations are strictly confined to `scripts/` and `tests/`.

2. **Edge Rate Limiting (Spec 02 § 3):**
   - Every request to `/api/chat` must evaluate client IP rate limits (10 req/min) and emit standard `X-RateLimit-*` headers.

---

## 3. Privacy & Telemetry Standards (PRD § 5.4 & § 6.4)

1. **APP k-Anonymity Query Hashing:**
   - Raw user queries must never be persisted to Cloudflare D1.
   - Hash queries with a rotating UTC daily salt via `getDailySalt()` in [`src/guardrails/pii-sanitizer.ts`](src/guardrails/pii-sanitizer.ts).

2. **D1 Schema Parity:**
   - Schema definitions in `migrations/`, [`src/types/chat.ts`](src/types/chat.ts), and [`src/telemetry/d1-logger.ts`](src/telemetry/d1-logger.ts) must maintain exact column name alignment with `docs/PRD.md § 6.4`:
     - `hybrid_retrieval_latency_ms REAL`
     - `inference_ttft_ms REAL`
     - `total_duration_ms REAL`
     - `groundedness_score REAL`

---

## 4. Evaluation Tiers (Spec 04 § 2)

1. **Tier 1: Deterministic Heuristic Evals (`evaluateGroundedness`)**
   - Fast, offline regex and string verification run in automated test suites and PR gates.
   - Verifies 0.00% advice leakage, 100% GAW presence, 100% citation format.

2. **Tier 2: Model-Assisted LLM Judge (`evaluateWithLlmJudge`)**
   - Dispatches evaluation prompt to `@cf/meta/llama-3.3-70b-instruct` when `env.AI` binding is active.
   - Validates groundedness against retrieved context passages.

---

## 5. Tooling, Formatting & Static Analysis

1. **TypeScript & Frontend Tooling (Biome):**
   - **Linter & Formatter:** [Biome](https://biomejs.dev/) configured in [`biome.json`](biome.json).
   - Formatter conventions: 2-space indentation, double quotes, trailing commas (`es5`), semicolons always, line width 100.
   - Run linter and formatting checks with `npm run lint` or `npm run format:check`.
   - Auto-fix issues with `npm run lint:fix` or `npm run format`.

2. **Python Tooling (Astral Ruff & ty):**
   - Configured centrally in [`pyproject.toml`](pyproject.toml).
   - **Linter & Formatter:** [Ruff](https://docs.astral.sh/ruff/) (`[tool.ruff]`), target Python 3.11+. Line length 100, double quotes.
   - **Type Checker:** [ty](https://docs.astral.sh/ty/) (`[tool.ty]`), Astral's fast Rust static type checker.
   - Run Python quality gate with `npm run lint:py` or `npm run typecheck:py`.
   - Auto-format Python scripts with `npm run format:py`.
