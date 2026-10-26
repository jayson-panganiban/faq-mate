# Specification: Universal Multi-Brand & Multi-Line Ingestion: Contractual PDS Extraction & Comprehensive Guide Corpus Integration

**Module:** `packages/ingest` / `src/rag` / `scripts`  
**Status:** Implemented — Guide Corpus Built; R2 Sync Pending Approval  
**Label:** `ready-for-agent`  
**Associated ADRs:** [ADR-0001 (Cloudflare AI Search Hybrid Retrieval)](../../docs/adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002 (Pre-Normalized Markdown in R2)](../../docs/adr/0002-pre-normalized-markdown-r2-ingestion.md), [ADR-0003 (Static AST Corpus Edge Fallback)](../../docs/adr/0003-static-ast-corpus-edge-fallback.md), [ADR-0004 (Canonical Insurer Registry & Brand Alias Resolution)](../../docs/adr/0004-canonical-insurer-registry-alias-resolution.md)  
**Associated Specs:** [Spec 01 (Data Ingestion & Pipeline)](../01-data-ingestion-chunking/spec.md), [Spec 02 (Edge Runtime)](../02-edge-rag-runtime/spec.md), [Spec 03 (Regulatory Compliance)](../03-regulatory-compliance/spec.md), [Spec 04 (AFCA Evals)](../04-afca-eval-benchmarks/spec.md), [Spec 06 (Corpus & AST Compiler)](../06-corpus-refinement-and-compilation/spec.md), [Spec 07 (Conversational Natural Language)](../07-conversational-natural-language-inquiries/spec.md)  

> **Implementation update (2026-10-26):** The guide corpus now contains **937 documents across 39 insurers** (up from the original 431-document estimate). Seeds and the crawler manifest are tracked; `data/corpus/guides/` is generated, gitignored, excluded from the static edge bundle, and published to R2 only. All 937 guides pass `npm run lint:corpus`; R2 upload and AI Search sync remain pending explicit approval.

---

## Problem Statement

When retail consumers query standard insurance definitions, event boundaries, or policy terms across any product line—such as *"What is flood definition for NRMA?"*, *"What does agreed value mean for AAMI?"*, *"Define pre-existing medical condition for Cover-More"*, or *"What is TPD definition for Zurich?"*—the FAQ-Mate edge runtime frequently returns a conservative `Silent PDS Notice` (e.g., *"The PDS does not explicitly define [Term] within the provided context"*). In contrast, commercial AI overviews (such as Google AI Overview) successfully provide structured, plain-English definitions that clearly delineate operational and contractual boundaries across all insurance categories.

A root-cause architectural audit revealed that this discrepancy is driven by five compounding data pipeline and retrieval deficits:

1. **Placeholder Metadata Stubs Across 391 Active PDS Documents:** While 1,277 authoritative PDS PDFs exist on disk in `data/raw/` across all 39 insurers spanning Home, Motor, Travel, Life, and Commercial lines, `scripts/normalize-corpus.ts` generated generic 3-line metadata placeholders (`"This policy is governed by terms and conditions..."`) rather than extracting actual policy text. Over 90% of the active PDS corpus contains zero contractual clauses.
2. **Asymmetric Hand-Crafted Prototype Scaffolding:** In early prototyping, `src/ingest/benchmark-policies.ts` created a multi-tier distortion: Suncorp was hand-coded with complete statutory home flood clauses and exclusions, while NRMA was reduced to a 3-line summary without a glossary, and the remaining 37 insurers (including all travel and life insurers) had no substantive clauses. Consequently, CI/CD passed for a narrow slice of home queries while real-world queries across Motor, Travel, Life, and Commercial lines failed.
3. **Heading Regex Swallowing in the PDF Extractor:** In `src/ingest/pds-normalizer.ts`, the heading parser matches lines like `Excess means the amount(s) You must contribute...` as an `excess` section header and subsequently lumps all following glossary terms (including `Flood means...`, `Agreed Value means...`, `Pre-existing Condition means...`, and `Total and Permanent Disablement means...`) into monolithic "Excess (Part N)" blocks, hiding defined terms from BM25 and vector indexing across all lines of insurance.
4. **Artificial Home-Centric Filtering & Edge Bundle Isolation of Curated Guides:** The project introduced 937 curated insurer guide documents in `data/corpus/guides/{insurer}/...`. The corpus spans all five canonical insurer categories plus operational/statutory governance, yet earlier compilation proposals either excluded guides entirely or proposed filtering them exclusively by home water perils (`storm`, `flood`, `bushfire`). This discarded the majority of the guide corpus and created an artificial, home-centric distortion in the edge fallback runtime.
5. **Narrow Definition Inquiry Intent Recognition:** `src/rag/intent-normalizer.ts` and `src/rag/local-retriever.ts` lack generalized heuristics for definition queries across lines (`"What is [term] definition"`, `"define [term]"`). Retrieved results fail to prioritize defined terms over generic mentions, regardless of whether the term belongs to Motor, Travel, Life, Commercial, or Home insurance.

---

## Solution

Establish a unified, multi-brand and multi-line ingestion and retrieval pipeline that treats all 39 primary insurers and all product lines equitably, eliminates placeholder stubs, and integrates the curated guide corpus into a balanced, comprehensive **Tripartite Knowledge Base**:

1. **Tripartite Knowledge Base Hierarchy Across All 5 Categories & 6 Product Lines:**
   - **`corpus/pds/` (Contractual Ground Truth):** Extracted from all 391 active local PDS PDFs. Contains legally binding definitions (*Insurance Contracts Regulations 2012*, *Life Insurance Act 1995*), insured events, monetary sub-limit schedules, excesses, and statutory exclusions/embargoes across all product lines.
   - **`corpus/guides/` (Conversational Explanations):** Curated from official insurer knowledge bases (937 files across 39 insurers). Explains complex insurance concepts in consumer-friendly language across all six core lines:
     1. *Home & Contents / Property (34.8%):* Flood vs. Rainwater Run-off vs. Storm Surge vs. Escape of Liquid, accidental damage, landlord cover, strata boundaries.
     2. *Life & Health / Financial (24.6%):* Term Life / Death benefits, Total & Permanent Disability (TPD Any vs. Own Occupation), Trauma / Critical Illness, Income Protection, Waiting Periods, Benefit Periods.
     3. *Travel Insurance (17.4%):* Overseas Emergency Medical & Hospital, Trip Cancellation & Interruption, Baggage & Valuables Sub-limits, Pre-Existing Medical Conditions, Emergency Contacts.
     4. *Motor & Vehicle (12.5%):* Comprehensive vs. Third-Party Property/Fire & Theft, Agreed Value vs. Market Value, Total Loss & New Car Replacement, Choice of Repairer, Windscreen Excess, Roadside Assistance.
     5. *Business & Commercial (5.6%):* Public & Products Liability, Commercial Property, Business Interruption & Indemnity Periods, Trades & Professional Indemnity.
     6. *Operational & Statutory Governance (5.6%):* Claims Lodgement Procedures, General Insurance Code of Practice, Life Insurance Code of Practice, Financial Hardship, Domestic & Family Violence Policies, AFCA Dispute Escalation.
   - **`corpus/faqs/` (Operational Q&A):** Insurer FAQ markdown covering claims lodgement, premium payments, account servicing, and digital policy self-service.

2. **Section-Aware Structured PDF Normalizer:**
   - Upgrade `src/ingest/pds-normalizer.ts` with universal term-level regex parsing for `^([A-Z][A-Za-z0-9\s/-]+)\s+means\s+` patterns.
   - Eliminate false-positive heading matches so definitions across all lines are indexed as discrete, high-relevance chunks (`Definitions — Flood`, `Definitions — Agreed Value`, `Definitions — Pre-Existing Condition`, `Definitions — Total and Permanent Disablement`).
   - Extract core sections: Definitions, Insured Events, Exclusions & Embargoes, and Sub-Limit tables across all 391 active PDS PDFs.

3. **Uniform Multi-Brand, Multi-Line Processing:**
   - Deprecate synthetic stubs in `src/ingest/benchmark-policies.ts`. All 39 insurers across all 5 canonical categories (`suncorp-group`, `major-insurers`, `challengers-auto-clubs`, `travel-specialists`, `life-insurers`) are processed uniformly through the automated PDF normalization pipeline.

4. **Category-Balanced Edge AST Compilation Budgeting:**
   - Update `scripts/compile-corpus.ts` to compile from `pdsFiles`, `faqFiles`, and a balanced, multi-line selection of `guideFiles`.
   - **Multi-Line Selection Policy:** Reject home-peril-only regex filtering. Allocate compiled chunks proportionally across all 5 canonical insurer categories:
     - `suncorp-group` (Home, Motor, Landlord, Commercial)
     - `major-insurers` (Home, Motor, Business, Travel, Life)
     - `challengers-auto-clubs` (Home, Motor, Roadside, Caravan/Boat)
     - `travel-specialists` (Emergency Medical, Trip Cancellation, Baggage)
     - `life-insurers` (Term Life, TPD, Trauma, Income Protection)
   - Cap compiled chunks per insurer at 14–16 chunks total, preserving rich multi-line coverage while strictly adhering to the 1.5MB isolate budget ($\le 550$ total chunks).

5. **Universal Definition Inquiry Intent & Heuristic Boosting:**
   - Add generalized `DEFINITION_INQUIRY` pattern to `src/rag/intent-normalizer.ts` capturing definitions across all lines:
     - Home: `flood`, `storm surge`, `rainwater run-off`, `accidental damage`, `hydrostatic pressure`
     - Motor: `agreed value`, `market value`, `total loss`, `choice of repairer`, `excess`, `unlicensed driver`
     - Travel: `pre-existing condition`, `medically necessary`, `unforeseen circumstances`, `curtailment`, `depreciation`
     - Life: `total and permanent disability`, `tpd`, `waiting period`, `benefit period`, `trauma`, `terminal illness`
     - Commercial: `public liability`, `indemnity period`, `business interruption`
   - Apply heuristic scoring boosts in `src/rag/local-retriever.ts` when a query seeks any insurance definition and the chunk represents an authentic glossary definition.

6. **Dual-Provenance Multi-Line Prompt Synthesis:**
   - Teach `src/rag/prompt-synthesizer.ts` to synthesize answers attributing both the legal PDS terms and the consumer guide explanation across any insurance line, matching the conversational clarity of commercial search overviews while maintaining 100% AFCA compliance and mandatory `STATUTORY_GAW` disclaimers.

---

## User Stories

1. **Home & Contents (Peril Boundaries):** As an NRMA policyholder, I want to ask *"What is flood definition for NRMA?"* and receive a clear explanation citing both the statutory flood definition from the PDS and the plain-English distinction from the NRMA Storm & Flood Guide, so that I understand my coverage without encountering a Silent PDS Notice.
2. **Motor & Vehicle (Agreed vs. Market Value):** As an AAMI car insurance customer, I want to ask *"What does agreed value mean for AAMI?"* and receive an authoritative explanation distinguishing agreed value from market value, including how depreciation and policy renewals affect the insured amount.
3. **Travel Insurance (Medical & Pre-Existing Conditions):** As a Cover-More travel insurance customer, I want to ask *"What is considered a pre-existing medical condition under Cover-More?"* and receive the specific criteria, lookback period, and assessment rules from the PDS and Travel Health Guide.
4. **Life & Disability (TPD Definitions & Waiting Periods):** As a Zurich Life customer, I want to ask *"What is the difference between Any Occupation and Own Occupation TPD for Zurich?"* and receive a grounded breakdown from the Zurich Assure PDS and Life Guide explaining disability claim thresholds.
5. **Business & Commercial (Public Liability & Interruption):** As a small business owner insured with Vero or QBE, I want to ask *"What does indemnity period mean in business interruption insurance?"* and learn how the coverage duration is measured and applied to ongoing operating expenses.
6. **Auto Clubs & Roadside (Service Boundaries):** As an RACV or RAA member, I want to ask *"Does RACV comprehensive car insurance include emergency roadside assistance?"* and learn the contractual boundary between insurance claims (accidents/theft) and roadside club entitlements (battery, lockout, towing).
7. **Travel Specialists (Trip Cancellation & Severe Weather):** As a Fast Cover policyholder, I want to ask *"Does Fast Cover travel insurance cover trip cancellation due to severe weather?"* and receive an explanation detailing when severe weather is considered an unforeseen event versus a known event subject to embargo.
8. **Life & Income Protection (Waiting vs. Benefit Periods):** As a NobleOak or TAL policyholder, I want to ask *"What is the difference between a waiting period and a benefit period for income protection?"* and receive the exact statutory and plain-English definitions without confusion.
9. **Challenger Multi-Line (Motor Drive-Less-Pay-Less & Building):** As a Youi customer, I want to inquire about *"How does Youi calculate drive less pay less?"* or *"What is Youi's definition of accidental damage at home?"* and receive precise, source-grounded answers across both vehicle and property lines.
10. **Retail Cross-Brand Comparison:** As a consumer comparing general insurers, I want to ask *"How do Suncorp and Budget Direct define storm surge versus flood?"* and receive objective, side-by-side factual comparisons without subjective recommendations or personal financial advice under ASIC RG 244.
11. **Frontend Provenance Badges:** As a user viewing citations in the chat interface, I want citations referencing guide documents to display a clean `GUIDE` badge alongside `PDS` and `FAQ` badges in the Citation Drawer and Pills, so that I immediately understand whether text is contractual or explanatory.
12. **Edge Isolate Portability & Resource Budgeting:** As the edge runtime, I want static edge chunks in `src/rag/corpus-data.ts` to remain $\le 1.5\text{MB}$ uncompressed while representing all 5 canonical categories, ensuring sub-40ms edge retrieval within Cloudflare Workers isolates.
13. **Statutory General Advice Warning (s.949A):** As a compliance officer, I want 100% of responses across all insurance lines (Home, Motor, Travel, Life, Commercial) to conclude with the mandatory `STATUTORY_GAW` disclaimer, guaranteeing strict ASIC RG 244 adherence.
14. **AFCA Multi-Line Evaluator Suite:** As an AFCA evaluator, I want `npm run test:evals` to execute benchmarks across multiple lines—Home (flood definition/embargo), Motor (unlicensed driver/total loss), Travel (medical/cancellation), and Life (cooling-off/non-disclosure)—verifying multi-line accuracy and zero advice leakage.
15. **Technical Insurance Glossaries:** As a policyholder querying obscure terms (*"What is hydrostatic pressure in building insurance?"* or *"What is subrogation in car insurance?"*), I want the system to pull the definition directly from the relevant policy glossary, transparently explaining complex insurance concepts.

---

## Implementation Decisions

### 1. Tripartite Knowledge Base Architecture & Multi-Line Balance
- Maintain three distinct subdirectories under `data/corpus/`:
  - `pds/{insurer}/{product}/{doc_type}_{effective_date}.md`
  - `guides/{insurer}/{page_slug}/GUIDE_{effective_date}.md`
  - `faqs/{insurer}.md`
- The curated guide corpus (`data/corpus/guides/`) consists of 937 documents across 39 insurers, spanning all primary industry segments:
  - **Home & Contents / Property:** building, contents, landlord, renters, strata, flood, glass, and portable valuables.
  - **Life, Disability & Health:** life, income protection, TPD, trauma/critical illness, hospital and extras cover.
  - **Travel Insurance:** comprehensive, basic, domestic, multi-trip, cruise, ski, seniors, family, student, and COVID cover.
  - **Motor & Vehicle:** car, comprehensive, third party, CTP, motorcycle, caravan/trailer, motorhome, and boat.
  - **General Policy Servicing & Statutory Governance:** claims, hardship, family violence, codes of practice, and complaints.
  - **Business & Commercial:** liability, professional indemnity, commercial property, farm, trades, and workers compensation.
  - **Pet Insurance:** dog and cat cover where sold.
- Breadcrumb metadata for Guides must include `doc_type: GUIDE`, `page_title`, `source_url`, and `retrieved_at` in addition to canonical insurer fields.

### 2. Universal Section-Aware PDF Extraction Engine
- Upgrade `src/ingest/pds-normalizer.ts` with a stateful section accumulator:
  - Detects universal glossary term blocks: `^([A-Z][A-Za-z0-9\s/-]+)\s+means\s+`
  - Splits glossary entries into discrete `PolicySection` units titled `Definitions — [Term]` across all product lines (e.g., `Definitions — Flood`, `Definitions — Agreed Value`, `Definitions — Pre-existing Condition`, `Definitions — Total and Permanent Disablement`).
  - Detects major section headings: `Definitions`, `Insured Events`, `What We Cover`, `What is Not Covered`, `General Exclusions`, `Sub-Limits Schedule`, `Excesses`, `Claims Procedure`.
  - Strips running headers, footers, page numbering, and TOC dot leaders.
- Use `/opt/homebrew/bin/pdftotext` with a fallback to `unpdf` to extract raw text across all 391 active manifest PDFs.

### 3. Category-Balanced Edge AST Compilation Budgeting
- Update `scripts/compile-corpus.ts` to compile from `pdsFiles`, `faqFiles`, and a curated multi-line subset of `guideFiles`:
  - **Category Quota Allocation:** Rather than filtering exclusively by home weather perils, allocate static edge chunks equitably across all five canonical insurer categories:
    - `suncorp-group` (Target: ~14 chunks/insurer across Home, Motor, Commercial)
    - `major-insurers` (Target: ~14 chunks/insurer across Home, Motor, Business, Travel, Life)
    - `challengers-auto-clubs` (Target: ~12 chunks/insurer across Home, Motor, Roadside, Property)
    - `travel-specialists` (Target: ~8 chunks/insurer across Emergency Medical, Trip Cancellation, Luggage)
    - `life-insurers` (Target: ~8 chunks/insurer across Life, TPD, Trauma, Income Protection)
  - Ensure total compiled static chunks remain $\le 550$ chunks and bundle size remains $\le 1.5\text{ MB}$ uncompressed to satisfy Cloudflare Workers isolate memory limits.
  - High-signal scoring in `corpus-compiler.ts` preserves priority terms across all lines:
    - *Home:* `flood`, `storm surge`, `rainwater run-off`, `72-hour embargo`, `actions of the sea`, `forcible entry`, `jewelry`
    - *Motor:* `agreed value`, `market value`, `total loss`, `choice of repairer`, `windscreen`, `hire car`, `unlicensed driver`
    - *Travel:* `pre-existing condition`, `overseas medical`, `cancellation`, `unforeseen`, `luggage sub-limit`
    - *Life:* `total and permanent disability`, `tpd`, `waiting period`, `benefit period`, `trauma`, `cooling-off`
    - *Commercial:* `public liability`, `business interruption`, `indemnity period`

### 4. Intent Normalizer & Heuristic Boosting
- Expand `DEFINITION_INQUIRY` intent in `src/rag/intent-normalizer.ts`:
  - Regex pattern: `/\b(?:what\s+is\s+(?:the\s+)?([a-z\s-]+)\s+definition|define\s+([a-z\s-]+)|definition\s+of\s+([a-z\s-]+)|what\s+counts\s+as\s+([a-z\s-]+)|meaning\s+of\s+([a-z\s-]+))\b/i`
  - Universal definition tokens: `definition`, `definitions`, `means`, `prescribed definition`, `words with special meanings`, `defined terms`
- In `src/rag/local-retriever.ts`, add a `+12.0` scoring boost for chunks whose `source.section` contains `Definitions` or whose body defines the queried term when `DEFINITION_INQUIRY` is detected, regardless of whether the inquiry is for Home, Motor, Travel, Life, or Business.

### 5. Multi-Source Prompt Synthesis & Grounded Citations
- Update `src/rag/prompt-synthesizer.ts`:
  - When retrieved chunks contain both `PDS` and `GUIDE` documents, instruct the model:
    `"Synthesize your answer by combining the binding legal definitions and exclusions from the PDS with the plain-English explanations from the official Insurer Guide. Attribute each part to its respective source."`
  - Guarantee that the `STATUTORY_GAW` disclaimer is appended to 100% of responses in compliance with Corporations Act s.949A.

---

## Testing Decisions

### 1. Testing Philosophy
- Tests must verify multi-line retrieval and generation behavior across Home, Motor, Travel, Life, and Business categories.
- Tests must execute in pure V8 isolate compatibility without Node.js `fs` dependencies at runtime.

### 2. Modules to be Tested
- `tests/ingest/pds-normalizer.test.ts`: Verify that raw PDF text containing definitions across multiple lines (`Flood means...`, `Agreed Value means...`, `Total and Permanent Disablement means...`) extracts discrete term-level sections without swallowing following sections.
- `tests/rag/intent-normalizer.test.ts`: Verify that definition queries across lines (`"What is flood definition for NRMA?"`, `"What does agreed value mean for AAMI?"`, `"What is TPD definition for Zurich?"`) trigger `DEFINITION_INQUIRY` and expand canonical definition tokens.
- `tests/rag/local-retriever.test.ts`: Verify that local hybrid search returns the relevant definition chunk as top-1 for Home, Motor, Travel, and Life queries across multiple brands.
- `tests/evals/afca-compliance.test.ts`: Expand the evaluation suite to verify multi-line benchmark scenarios:
  - *Home:* Statutory flood definitions, rainwater run-off, storm surge, 72-hour embargoes
  - *Motor:* Unlicensed driver exclusions, agreed value vs market value
  - *Travel:* Emergency medical expenses, trip cancellation
  - *Life:* Cooling-off periods, TPD occupation criteria
- `tests/ingest/guide-normalizer.test.ts`: Verify that guide normalization preserves breadcrumb frontmatter across all five insurer categories.

### 3. Prior Art in the Codebase
- Existing test patterns in `tests/rag/local-retriever.test.ts`, `tests/evals/afca-compliance.test.ts`, and `tests/ingest/guide-normalizer.test.ts`.

---

## Out of Scope

- Ingesting historical/archived PDS editions (the 886 older PDS versions in `all_manifest.csv`); only the 391 current active editions are in scope.
- Automated web crawling of external insurer marketing domains; guides are generated only from curated official insurer pages listed in `data/raw/guide_seeds/`.
- Changes to frontend CSS or message layout components; existing `CitationDrawer` and `CitationPill` already support `docType: GUIDE`.

---

## Further Notes

- All 391 active PDS PDFs across Home, Motor, Travel, Life, and Commercial lines are verified present on local disk in `data/raw/` (0 missing).
- All 937 curated Guide markdown files across all 39 insurers are present in `data/corpus/guides/` and currently pass `npm run lint:corpus` with 0 violations.
- Once compilation is complete, `npm run upload:r2` can sync the tripartite corpus (`pds/`, `faqs/`, `guides/`) to Cloudflare R2 for vector indexing in Cloudflare AI Search.
