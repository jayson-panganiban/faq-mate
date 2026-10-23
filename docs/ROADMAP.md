# Project Roadmap & Progress Tracker: FAQ-Mate

**System:** Australian General Insurance FAQ Edge RAG  
**Target:** Production-Grade Engineering Portfolio  
**Methodology:** Spec-Driven Development (SDD)  
**Last Updated:** October 2026

---

## Progress Overview

| Phase       | Description                              | Status   | Verification Criteria                                                               |
| :---------- | :--------------------------------------- | :------- | :---------------------------------------------------------------------------------- |
| **Phase 1** | **Spec-Driven Foundation**               | **DONE** | PRD v1.1.0, GLOSSARY, ADR-0001, ADR-0002, 4 modular specs.                          |
| **Phase 2** | **Core Edge Worker & Telemetry**         | **DONE** | Worker entrypoint, PII scrubber, advice gatekeeper, D1 migration, 8/8 tests pass.   |
| **Phase 3** | **Data Ingestion & R2 Normalizer**       | **DONE** | PDF/Markdown normalizer script, table serializer, seed corpus & R2 upload utility.  |
| **Phase 4** | **Cloudflare AI Search Binding**         | **DONE** | `AI_SEARCH` binding in `wrangler.jsonc`, hybrid search + local retriever fallback. |
| **Phase 5** | **AFCA Evals & Groundedness Benchmarks** | **DONE** | Full AFCA-10 red-teaming test suite, LLM-as-a-Judge groundedness gate ($\ge 0.98$). |
| **Phase 6** | **Frontend Chat Interface (Pages)**      | **UPCOMING** | High-density UI, citation drawers, latency badges, Turnstile abuse shield.      |

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
- [x] PII Redaction module (TFN, Medicare, Cards, Phones, Driver Licences)
- [x] ASIC RG 244 & COP Advice Gatekeeper (`src/guardrails/advice-gatekeeper.ts`)
- [x] Non-blocking D1 logger (`src/telemetry/d1-logger.ts`)
- [x] Edge Worker dispatcher (`src/index.ts`) with SSE streaming
- [x] Integration test suite (8/8 tests passing, 0 TypeScript errors)
- [x] Seed benchmark policy ([`data/corpus/suncorp-classic-home-pds.md`](file:///Users/jaysoncp/Developer/faq-mate/data/corpus/suncorp-classic-home-pds.md))

### Phase 3: Data Ingestion & R2 Normalization (Completed)

- [x] Ingest multi-insurer Australian FAQ corpus:
  - [x] Extracted Tier 1 Home & Contents disclosures (Allianz, NRMA, QBE, Suncorp, AAMI)
  - [x] Ingested 778 FAQs across 44 Australian insurer brands
  - [x] Normalized into hierarchical Markdown with breadcrumbs in `data/corpus/faqs/`
- [x] Implement PDF extraction utility ([`scripts/normalize-pds.ts`](file:///Users/jaysoncp/Developer/faq-mate/scripts/normalize-pds.ts))
- [x] Add table extraction & sub-limit serializer ([`src/ingest/table-serializer.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/ingest/table-serializer.ts))
- [x] Normalize benchmark policies:
  - [x] Suncorp Classic Home & Contents ([`data/corpus/suncorp-classic-home-pds.md`](file:///Users/jaysoncp/Developer/faq-mate/data/corpus/suncorp-classic-home-pds.md))
  - [x] Allianz Comprehensive Motor ([`data/corpus/allianz-comprehensive-motor-pds.md`](file:///Users/jaysoncp/Developer/faq-mate/data/corpus/allianz-comprehensive-motor-pds.md))
- [x] Automated upload script to Cloudflare R2 bucket ([`scripts/upload-to-r2.ts`](file:///Users/jaysoncp/Developer/faq-mate/scripts/upload-to-r2.ts))
- [x] Ingestion test suite passing 5/5 tests ([`tests/ingest/pds-normalizer.test.ts`](file:///Users/jaysoncp/Developer/faq-mate/tests/ingest/pds-normalizer.test.ts))

### Phase 4: Cloudflare AI Search & Edge Wiring (Completed)

- [x] Configure `env.AI_SEARCH` binding in [`wrangler.jsonc`](file:///Users/jaysoncp/Developer/faq-mate/wrangler.jsonc)
- [x] Wire hybrid search and top-K chunk retrieval into [`src/index.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/index.ts) with local hybrid fallback
- [x] Full SSE outbound protocol implementation: `event: metadata`, `event: token`, `event: done`, and `event: error`

### Phase 5: AFCA Red-Team Evals (Completed)

- [x] Expand [`tests/evals/afca-compliance.test.ts`](file:///Users/jaysoncp/Developer/faq-mate/tests/evals/afca-compliance.test.ts) to all 10 legal trap scenarios (TC-01 through TC-10)
- [x] Implement LLM-as-a-Judge groundedness scorer ([`src/evals/groundedness-judge.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/evals/groundedness-judge.ts))
- [x] Enforce automated CI gate ($\ge 0.98$ groundedness, $0.00\%$ advice leakage, $100\%$ GAW, $100\%$ citation precision)
- [x] All 13/13 eval tests passing in CI

### Phase 6: Cloudflare Pages Frontend (Upcoming)

- [ ] Scaffold Vite + React 19 UI in `packages/ui` or `src/frontend/`
- [ ] Citation preview modal & PDS page deep-links
- [ ] Edge latency meter (TTFT, Cloudflare PoP location pill)
- [ ] Cloudflare Turnstile bot protection
