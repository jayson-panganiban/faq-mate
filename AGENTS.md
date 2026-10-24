# FAQ-Mate Agent Guide

Australian General Insurance FAQ Edge RAG system running on Cloudflare Workers, Workers AI (Llama 3.3 70B), Cloudflare AI Search, R2, and D1.

## Context Pointers
- **Roadmap & Phase Tracker:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Living Specifications:**
  - [`01-data-ingestion-chunking`](.scratch/01-data-ingestion-chunking/spec.md) (4-Stage Ingestion, R2 Keys, Breadcrumbs)
  - [`02-edge-rag-runtime`](.scratch/02-edge-rag-runtime/spec.md) (SSE Protocol, Rate Limiting, Hybrid Search)
  - [`03-regulatory-compliance`](.scratch/03-regulatory-compliance/spec.md) (ASIC RG 244, COP Emergency, APP 3/11 PII)
  - [`04-afca-eval-benchmarks`](.scratch/04-afca-eval-benchmarks/spec.md) (AFCA-10 Trap Scenarios & Groundedness Gate)
  - [`05-frontend-chat-interface`](.scratch/05-frontend-chat-interface/spec.md) (React 19 UI, Citation Drawer, Comparison Matrix)
  - [`06-corpus-refinement-and-compilation`](.scratch/06-corpus-refinement-and-compilation/spec.md) (39-Insurer Roster, Corpus Linter & AST Compiler)
  - [`07-conversational-natural-language-inquiries`](.scratch/07-conversational-natural-language-inquiries/spec.md) (Colloquial Intent, Multi-Turn, Decision Factors)
- **Canonical Registries & Codecs:**
  - [`src/constants/insurers.ts`](src/constants/insurers.ts) (39 Primary Insurers, Bancassurance Aliases, Policy Comparison Catalog)
  - [`src/constants/statutory.ts`](src/constants/statutory.ts) (`STATUTORY_GAW`, `STATUTORY_SAFE_HARBOR_REFUSAL`, `EMERGENCY_HOTLINES`)
  - [`src/ingest/corpus-codec.ts`](src/ingest/corpus-codec.ts) (Breadcrumb Serializer/Parser, R2 Path Key Resolver, Statutory Footer)
- **Domain Invariants & Legal Terms:** [`GLOSSARY.md`](GLOSSARY.md)
- **Architecture Decision Records:** [`docs/adr/`](docs/adr/)
- **Agent Skills Configuration:** [`docs/agents/`](docs/agents/) ([`issue-tracker.md`](docs/agents/issue-tracker.md), [`triage-labels.md`](docs/agents/triage-labels.md), [`domain.md`](docs/agents/domain.md))
- **System Architecture & PRD:** [`docs/PRD.md`](docs/PRD.md)
- **Coding Standards & Review Rules:** [`CODING_STANDARDS.md`](CODING_STANDARDS.md)

---

## Operating Loop

Execute every task through this 5-stage loop:

1. **Locate & Align:** Read the relevant specification in [`.scratch/<feature>/spec.md`](.scratch/) and related tests before modifying code.
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
   - D1 schema must maintain exact column names: `hybrid_retrieval_latency_ms` and `inference_ttft_ms` ([`docs/PRD.md § 6.4`](docs/PRD.md#L292-L312)).
   - Edge chat endpoint (`/api/chat`) must strictly emit SSE events: `event: metadata`, `event: token`, `event: done`, and `event: error`.
   - Every request must evaluate and emit `X-RateLimit-*` headers (10 req/min per IP).

7. **Ingestion & Edge AST Compilation Invariants:**
   - Raw collector scripts reside in `scripts/collector/` and output immutable archives to `data/raw/` (`all_manifest.csv` and `FAQs/`).
   - Stage 2 (`npm run normalize`) normalizes the latest current PDS/SPDS policies and all 39 insurer FAQ files into `data/corpus/{pds,faqs}/` with `<!-- BREADCRUMB -->` frontmatter, GFM tables, peril-exclusion co-location, and `STATUTORY_GAW`.
   - Stage 3 (`npm run compile:corpus`) lints `data/corpus/` and deterministically compiles `src/rag/corpus-data.ts`. Always generate `src/rag/corpus-data.ts` via the compiler; never edit it manually, and never emit heading-only chunks.

---

## Verification Commands

- **Full Verification Gate:** `npm run verify` (runs `typecheck`, `lint`, `lint:corpus`, `test`, `test:evals`)
- **Fast Typecheck:** `npm run typecheck`
- **TypeScript Linter & Formatter (Biome):** `npm run lint` / `npm run lint:fix` / `npm run format`
- **Python Quality Gate (Ruff & ty):** `npm run lint:py` / `npm run format:py` / `npm run typecheck:py`
- **Unit & Integration Suite:** `npm test`
- **AFCA Regulatory Evals:** `npm run test:evals`
- **Corpus Normalization:** `npm run normalize`
- **Corpus AST Edge Compilation:** `npm run compile:corpus`
- **Corpus Linter:** `npm run lint:corpus`
- **Corpus R2 Upload & Audit:** `npm run upload:r2`

---

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/`. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Canonical five-role triage vocabulary. See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context ([`GLOSSARY.md`](GLOSSARY.md) + [`docs/adr/`](docs/adr/) at repo root). See [`docs/agents/domain.md`](docs/agents/domain.md).

