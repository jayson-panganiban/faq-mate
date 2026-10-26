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
| **Phase 6** | **Frontend Chat Interface (Pages)**      | **DONE** | High-density UI, citation drawers, latency badges, Turnstile abuse shield, 154 tests. |
| **Phase 7** | **Multi-Insurer Archive & Edge AST Compiler** | **DONE** | 39 insurers across 5 categories, 1,277 PDF archive, 5,416 FAQs, AST heading-clean compiler, corpus linter. |
| **Phase 8** | **Runtime Hardening & Known Gaps**       | **PLANNED** | Server Turnstile verify, 8B secondary LLM fallback, true TTFT timing, feedback API, durable rate limit. |

---

## Detailed Task Breakdown

### Phase 1: Spec-Driven Foundation (Completed)

- [x] Author comprehensive PRD ([`docs/PRD.md`](file:///Users/jaysoncp/Developer/faq-mate/docs/PRD.md))
- [x] Establish legal terminology baseline ([`GLOSSARY.md`](file:///Users/jaysoncp/Developer/faq-mate/GLOSSARY.md))
- [x] Record ADR-0001 (Cloudflare AI Search Hybrid Retrieval)
- [x] Record ADR-0002 (Pre-Normalized Markdown in R2)
- [x] Record ADR-0003 (Static AST Corpus as In-Isolate Retrieval Fallback)
- [x] Record ADR-0004 (Canonical Insurer Registry & Bancassurance Alias Resolution)
- [x] Author & maintain living specifications (`.scratch/01` through `06` all at v2.0.0)

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

### Phase 6: Cloudflare Pages Frontend ([`.scratch/05-frontend-chat-interface/spec.md`](../.scratch/05-frontend-chat-interface/spec.md))

- [x] Scaffold Vite + React 19 UI in `src/frontend/` with Tailwind CSS & Lucide React
- [x] Stream state machine & custom `useChatStream` hook with full SSE protocol
- [x] Citation preview drawer (`CitationDrawer`) & inline citation chips (`CitationPill`)
- [x] Edge latency meter (Anycast PoP pill, hybrid retrieval latency, TTFT badge)
- [x] Regulatory guardrail cards (ASIC RG 244 `RefusalCard`, COP `EmergencyBanner`, Section 949A `StatutoryGaw`)
- [x] Markdown tabular sub-limits renderer & negative constraint silent PDS notices
- [x] Side-by-side policy comparison matrix (`PolicyComparisonView`)
- [x] Client-side APP 3/11 PII redaction and `RateLimitBadge`
- [x] Cloudflare Turnstile bot protection support
- [x] Complete frontend unit and E2E integration test suite (154/154 tests passing)

### Phase 7: Ground-Up Multi-Insurer Ingestion & Edge AST Compiler ([`.scratch/06-corpus-refinement-and-compilation/spec.md`](../.scratch/06-corpus-refinement-and-compilation/spec.md))

- [x] Canonical Insurer Registry ([`src/constants/insurers.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/constants/insurers.ts)):
  - [x] Model 39 primary insurers across 5 categories (Suncorp Group, Major Insurers, Challengers & Auto Clubs, Travel Specialists, Life Insurers)
  - [x] Map Bancassurance (CommBank, Westpac, ANZ, NAB, HSBC, ING, Bankwest) and retail brand aliases (Coles, ROLLiN', Everyday Insurance, Australian Seniors) to issuing underwriters
- [x] Raw Archive Ingestion & Manifesting:
  - [x] Multi-insurer raw collector scripts in `scripts/collector/`
  - [x] Index 1,277 policy disclosure PDFs in `data/raw/all_manifest.csv` with category, product, document type, and effective dates
  - [x] Archive 5,416 Q&As in `data/raw/FAQs/` across all 39 primary insurers
  - [x] Manifest selector contract supporting default current-edition filtering and `--all-historical` full archive ingestion
- [x] Semantic Normalization Pipeline ([`.scratch/01-data-ingestion-chunking/spec.md`](../.scratch/01-data-ingestion-chunking/spec.md)):
  - [x] Multi-insurer normalizer (`scripts/normalize-corpus.ts` / `npm run normalize`)
  - [x] Structured frontmatter injection with `<!-- BREADCRUMB -->` schema (`insurer`, `insurer_code`, `category`, `product`, `doc_type`, `effective_date`, `jurisdiction`)
  - [x] GFM table serialization for monetary sub-limits schedules and excess structures
  - [x] Co-location of statutory peril definitions, flood water exclusions, 48h/72h embargoes, and violent/forcible entry clauses
  - [x] Automated statutory General Advice Warning (`STATUTORY_GAW`) append
- [x] Automated Corpus Linter:
  - [x] Corpus validation utility (`src/ingest/corpus-linter.ts` / `npm run lint:corpus`)
  - [x] Strict validation of breadcrumb schema, GFM table syntax, and peril-embargo co-location
- [x] Deterministic Edge AST Compiler:
  - [x] AST traversal compiler (`scripts/compile-corpus.ts` / `npm run compile:corpus`) generating typed `src/rag/corpus-data.ts`
  - [x] Heading-only chunk elimination: fold intermediate headers without body paragraphs into hierarchical breadcrumbs
  - [x] Pre-computed BM25 keyword tokens and relevance scores for sub-40ms edge retrieval
  - [x] Worker isolate bundle budgeting ($\le 1.5\text{MB}$ uncompressed, pure V8 isolate portability, zero filesystem access)
- [x] Cloudflare R2 Corpus Synchronization:
  - [x] Upload utility (`scripts/upload-to-r2.ts` / `npm run upload:r2`) for R2 bucket `faq-mate-corpus`
  - [x] Enforce canonical R2 key parity: `corpus/pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md` and `corpus/faqs/{insurer_code}.md`
- [x] Verification, Living Specs & Agent Rules:
  - [x] Updated `AGENTS.md` with Spec 06 context pointer, Ingestion & Compilation Invariants, and verification commands
  - [x] Upgraded Spec 01 to v2.0.0 (`.scratch/01-data-ingestion-chunking/spec.md`)
  - [x] Aligned Spec 06 to v2.0.0 (`.scratch/06-corpus-refinement-and-compilation/spec.md`)
  - [x] Zero regressions against AFCA-10 benchmark evals and TypeScript verification gate (`npm run verify`)

---

### Phase 8: Runtime Hardening & Planned Improvements (Planned)

Tracked across living specifications [02](../.scratch/02-edge-rag-runtime/spec.md#7-known-gaps), [03](../.scratch/03-regulatory-compliance/spec.md#6-known-gaps), [04](../.scratch/04-afca-eval-benchmarks/spec.md#6-known-gaps), and [06](../.scratch/06-corpus-refinement-and-compilation/spec.md#9-known-gaps):

- [ ] **G1: Server-Side Turnstile Verification:** Validate `turnstileToken` with Cloudflare Siteverify API before routing to edge RAG; return 403 on failed token.
- [ ] **G2: Secondary `@cf/meta/llama-3.1-8b-instruct` Fallback:** Try 8B model when 70B fails before falling back to deterministic synthesis.
- [ ] **G3: True First-Token TTFT Measurement:** Measure time at first `token` SSE frame emit, then dispatch D1 telemetry asynchronously on stream close.
- [ ] **G4: Real-Time Groundedness Scoring:** Execute `evaluateGroundedness()` in non-blocking `ctx.waitUntil()` to record authentic groundedness score in D1.
- [ ] **G5: Real-Time Streaming Advice-Leakage Gate:** Abort SSE stream or fallback if LLM emits advice phrasing.
- [ ] **G6: Feedback API Route & UI Buttons:** Implement `POST /api/feedback` to record thumbs up/down user ratings into `rag_telemetry_audit.user_feedback_score`.
- [ ] **G7: Durable Global Rate Limiting:** Migrate in-memory rate limiting to Cloudflare Rate Limiting binding or Durable Object for cross-isolate / multi-PoP enforcement.
- [ ] **G8: Automated Peril Co-Location Linter Check:** Add AST rules verifying flood clauses co-locate ocean surge exclusions and embargo clauses.
- [ ] **G9: Enriched SSE Metadata:** Add `pop_location`, `ttft_ms`, and `groundedness_score` to SSE events without breaking consumers.
- [ ] **G10: CI Bundle & Memory Budget Assertions:** Automated bundle size and memory budget assertions in `npm run verify`.
- [ ] **G11: Query Filter Forwarding:** Forward `product` and `docType` from validated request schema into AI Search and local retriever.
- [ ] **Phase 8.1 / Spec 07: Conversational Natural Language & Semantic Intent Expansion:** ([`.scratch/07-conversational-natural-language-inquiries/spec.md`](../.scratch/07-conversational-natural-language-inquiries/spec.md)) Colloquial peril-to-statutory intent mapper, dual-tier semantic retrieval, factual breadth disambiguation, and Plain-English synthesis.
- [ ] **Phase 8.2 / Spec 08: Universal Multi-Brand & Multi-Line Ingestion: Contractual PDS Extraction & Comprehensive Guide Corpus Integration:** ([`.scratch/08-universal-pds-and-guide-corpus-integration/spec.md`](../.scratch/08-universal-pds-and-guide-corpus-integration/spec.md)) Full multi-line PDS extraction across 391 active PDFs (Home, Motor, Travel, Life, Commercial), Tripartite Knowledge Base integration (`pds/`, `faqs/`, `guides/`), category-balanced multi-line edge compilation budgeting across all 5 insurer categories, and universal definition inquiry intent recognition.
  - [x] Curated guide corpus built: **937 documents across 39 insurers**, 0 linter violations; seeds and manifest tracked, `data/corpus/guides/` gitignored and R2-only.
  - [x] Guide normalizer and linter integration; guides excluded from the static edge bundle to protect the 1.5 MB budget.
  - [ ] R2 upload and AI Search sync (pending explicit approval).
  - [ ] Category-balanced edge compilation and universal definition inquiry intent (remaining Spec 08 work).
