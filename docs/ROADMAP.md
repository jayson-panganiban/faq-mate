# Project Roadmap & Progress Tracker: FAQ-Mate

**System:** Australian General Insurance FAQ Edge RAG  
**Target:** Production-Grade Engineering Portfolio  
**Methodology:** Spec-Driven Development (SDD)  
**Last Updated:** October 2026  

---

## Progress Overview

| Phase | Description | Status | Verification Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Spec-Driven Foundation** | **DONE** | PRD v1.1.0, GLOSSARY, ADR-0001, ADR-0002, 4 modular specs. |
| **Phase 2** | **Core Edge Worker & Telemetry** | **DONE** | Worker entrypoint, PII scrubber, advice gatekeeper, D1 migration, 8/8 tests pass. |
| **Phase 3** | **Data Ingestion & R2 Normalizer** | **IN PROGRESS** | PDF/Markdown normalizer script, table parser, seed corpus in R2. |
| **Phase 4** | **Cloudflare AI Search Binding** | **UPCOMING** | Live hybrid retrieval (BM25 + BGE Large), cross-encoder reranking. |
| **Phase 5** | **AFCA Evals & Groundedness Benchmarks** | **UPCOMING** | Full AFCA-10 red-teaming test suite, LLM-as-a-Judge groundedness gate ($\ge 0.98$). |
| **Phase 6** | **Frontend Chat Interface (Pages)** | **UPCOMING** | High-density UI, citation drawers, latency badges, Turnstile abuse shield. |

---

## Detailed Task Breakdown

### Phase 1: Spec-Driven Foundation (Completed)
- [x] Author comprehensive PRD ([`docs/PRD.md`](file:///Users/jaysoncp/Developer/faq-mate/docs/PRD.md))
- [x] Establish legal terminology baseline ([`GLOSSARY.md`](file:///Users/jaysoncp/Developer/faq-mate/GLOSSARY.md))
- [x] Record ADR-0001 (Cloudflare AI Search Hybrid Retrieval)
- [x] Record ADR-0002 (Pre-Normalized Markdown in R2)
- [x] Write modular living specifications (`docs/specs/01` through `04`)

### Phase 2: Core Edge Worker & Telemetry (Completed)
- [x] Scaffolding: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`
- [x] TypeScript contracts: `bindings.d.ts` and `src/types/chat.ts`
- [x] D1 Telemetry Schema: `migrations/0001_init_telemetry.sql`
- [x] PII Redaction module (TFN, Medicare, Cards, Phones)
- [x] ASIC RG 244 & COP Advice Gatekeeper (`src/guardrails/advice-gatekeeper.ts`)
- [x] Non-blocking D1 logger (`src/telemetry/d1-logger.ts`)
- [x] Edge Worker dispatcher (`src/index.ts`) with SSE streaming
- [x] Integration test suite (8/8 tests passing, 0 TypeScript errors)
- [x] Seed benchmark policy ([`data/corpus/suncorp-classic-home-pds.md`](file:///Users/jaysoncp/Developer/faq-mate/data/corpus/suncorp-classic-home-pds.md))

### Phase 3: Data Ingestion & R2 Normalization (In Progress)
- [ ] Implement PDF extraction utility (`scripts/normalize-pds.ts`)
- [ ] Add table extraction & sub-limit serializer
- [ ] Normalize benchmark policies:
  - [x] Suncorp Classic Home & Contents (Seed created)
  - [ ] Allianz Comprehensive Motor
  - [ ] AAMI Home/Car FAQs (migrated from `data/faqs.json`)
- [ ] Automated upload script to Cloudflare R2 bucket (`faq-mate-corpus`)

### Phase 4: Cloudflare AI Search & Edge Wiring (Upcoming)
- [ ] Configure `env.AI_SEARCH` binding in `wrangler.jsonc`
- [ ] Wire hybrid search and top-K chunk retrieval into `src/index.ts`
- [ ] Validate sub-40ms retrieval latency

### Phase 5: AFCA Red-Team Evals (Upcoming)
- [ ] Expand `tests/evals/afca-compliance.test.ts` from 4 to all 10 legal trap scenarios
- [ ] Implement LLM-as-a-Judge groundedness scorer
- [ ] Enforce automated CI gate ($\ge 0.98$ groundedness)

### Phase 6: Cloudflare Pages Frontend (Upcoming)
- [ ] Scaffold Vite + React 19 UI in `packages/ui` or `src/frontend/`
- [ ] Citation preview modal & PDS page deep-links
- [ ] Edge latency meter (TTFT, Cloudflare PoP location pill)
- [ ] Cloudflare Turnstile bot protection
