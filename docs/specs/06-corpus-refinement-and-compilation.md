# Specification: Phase 7 — Corpus Refinement, Multi-Insurer Expansion & Automated Edge Compiler

**Module:** `packages/ingest` / `src/rag`  
**Status:** Living Specification  
**Version:** 1.0.0  
**Associated Specs:** [Spec 01 (Data Ingestion)](01-data-ingestion-chunking.md), [Spec 02 (Edge Runtime)](02-edge-rag-runtime.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md), [Spec 05 (Frontend)](05-frontend-chat-interface.md)  
**Associated ADRs:** [ADR-0001](../adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002](../adr/0002-pre-normalized-markdown-r2-ingestion.md)  

---

## Problem Statement

Australian insurance policyholders and brokers comparing cover across major underwriters face a fragmented information landscape. While FAQ-Mate's edge runtime and frontend UI allow users to filter queries by five primary Australian insurers (NRMA, Suncorp, Allianz, QBE, and Youi), the underlying retrieval corpus suffers from severe data drift and structural gaps:

1. **Incomplete Insurer Coverage**: Full Product Disclosure Statements (PDS) only exist for Suncorp Home and Allianz Motor. NRMA and QBE have minimal FAQ coverage without full underwriting terms, while Youi is entirely absent from the indexing corpus despite being selectable in the client interface.
2. **Product Asymmetry**: Home Building & Contents and Comprehensive Motor are not uniformly available across all Tier-1 insurers, preventing cross-product and cross-underwriter coverage comparisons.
3. **Manual Compilation Drift**: The edge static corpus lookup module is maintained through manual synchronization rather than an automated AST compiler. This creates a brittle seam where updates to raw or normalized Markdown are not deterministically reflected in edge chunks.
4. **Missing Regulatory Product Determinations (TMDs)**: Target Market Determinations mandated under statutory Design and Distribution Obligations (DDO) are absent, leaving target market eligibility queries without primary policy source grounding.
5. **Aggregator Contamination**: Third-party commercial aggregators (e.g. Compare the Market, iSelect) are mixed into the FAQ corpus without clear distinction from primary underwriter disclosures.

---

## Solution

Build an end-to-end automated corpus refinement pipeline that expands, normalizes, validates, and edge-compiles all primary Product Disclosure Statements and Target Market Determinations for the five major Australian general insurers.

The system will:
1. Ingest comprehensive, multi-module PDS and TMD policy documents for **NRMA, Suncorp, Allianz, QBE, and Youi** across Home & Contents and Comprehensive Motor.
2. Enforce strict tabular serialization of sub-limits schedules (jewelry, watches, works of art, bicycles, tools of trade) and excess structures (basic, age, inexperienced driver, unoccupied dwelling).
3. Co-locate peril definitions with statutory waiting periods (e.g. 72-hour bushfire/flood embargoes) and exclusion clauses (storm surge, forcible entry) under the Spec 01 invariant.
4. Quarantine third-party aggregator FAQs from direct insurer disclosures.
5. Provide a deterministic corpus compiler that transforms hierarchical Markdown documents into typed, edge-compatible static index chunks with BM25 keywords, relevance metadata, and breadcrumbs.
6. Provide an automated corpus linter integrated into continuous verification gates.

---

## User Stories

1. As a policyholder insured with NRMA, I want to ask questions about my Home Plus policy sub-limits, so that I can know the exact maximum dollar payout for stolen jewelry without reading the entire document.
2. As a driver insured with Youi, I want to query my Comprehensive Motor policy regarding unnamed driver excesses, so that I understand additional out-of-pocket costs before lending my vehicle.
3. As an insurance broker comparing policies, I want to inspect flood and rainwater run-off coverage across NRMA, Suncorp, Allianz, QBE, and Youi side-by-side, so that I can advise clients on differing peril definitions.
4. As a homeowner in a high-risk bushfire area, I want to verify whether a 72-hour embargo applies to my newly purchased policy, so that I know exactly when my fire cover takes effect.
5. As a policyholder claiming for burglary, I want the system to clarify whether forcible and violent entry is required for contents cover, so that I am not misled about unforced theft exclusions.
6. As a compliance auditor, I want every retrieved passage to include structured document breadcrumbs (insurer, product, document type, effective date, section, and sub-section), so that grounding provenance is traceable.
7. As an insurance customer inquiring about eligibility, I want the system to ground answers in the product's Target Market Determination (TMD), so that I understand the target retail consumer criteria without receiving personal financial advice.
8. As a developer adding a new PDS, I want an automated compilation script that parses Markdown headings and tables into edge chunks, so that I do not have to write manual static TypeScript data files.
9. As a CI/CD pipeline operator, I want an automated corpus linter to fail the build if any policy document lacks mandatory frontmatter metadata or breaks table formatting, so that malformed documents never reach production.
10. As a technical evaluator, I want all tabular sub-limits schedules to render as structured Markdown tables rather than flattened paragraphs, so that monetary figures and item caps are unambiguous.
11. As a privacy-conscious user, I want third-party comparison aggregator commentary separated from underwriter policy terms, so that responses reflect legal underwriting guidelines rather than broker marketing copy.
12. As an edge runtime engineer, I want compiled corpus chunks to execute strictly in pure V8 isolates without any Node.js filesystem calls, so that edge performance remains sub-40ms.
13. As a mobile user querying accidental damage, I want glass breakage sub-limits and excess waiver conditions for windscreens to be clearly distinguished between motor and home policies, so that I receive product-accurate terms.
14. As an insurer operations lead, I want historical PDS versions clearly stamped with effective dates, so that coverage questions accurately reflect policy wording active at the time of claim.
15. As a motor vehicle owner, I want the corpus to document unlicensed driver exclusions across all five insurers, so that statutory exclusion rules under the Insurance Contracts Act 1984 are consistently grounded.
16. As a tenant with contents insurance, I want to know specific limits for guest property and temporary accommodation, so that emergency living allowances are transparent.
17. As an AFCA evaluator, I want the expanded corpus to maintain 100% precision on existing benchmark scenarios (TC-01 through TC-10), so that corpus updates never degrade regulatory compliance.

---

## Implementation Decisions

### 1. Ingestion Scope & Insurer Roster
- The refined corpus will contain primary documents for all five active insurers:
  - **NRMA**: Home Plus Building & Contents PDS, Comprehensive Motor PDS.
  - **Suncorp**: Classic Home Building & Contents PDS (expanded), Comprehensive Motor PDS.
  - **Allianz**: Classic Home & Contents PDS, Comprehensive Motor PDS.
  - **QBE**: Home & Contents PDS, Comprehensive Motor PDS.
  - **Youi**: Comprehensive Home Building & Contents PDS, Comprehensive Motor PDS.
  - **Target Market Determinations (TMD)**: Retail Home & Motor determinations for Tier-1 insurers.
- Commercial aggregator FAQs (e.g. Compare the Market, iSelect) will be quarantined into an isolated aggregator category and excluded from primary underwriting retrieval.

### 2. Tabular Normalization & Co-Location Standard
- All monetary sub-limits schedules must be serialized into aligned Markdown tables containing:
  - Item/peril category.
  - Standard policy dollar limit or calculation formula.
  - Conditions for optional higher cover.
- In accordance with Spec 01 § 2.4, the following domain pairings must be co-located within the same chunk:
  - Flood definition + storm surge / action of the sea exclusions.
  - Bushfire, cyclone, and flood definitions + embargo waiting periods (48h or 72h).
  - Theft / burglary + violent and forcible entry conditions.

### 3. Automated Edge Compiler Architecture
- A dedicated compiler utility will read all normalized Markdown documents in the corpus repository.
- **Parsing**: Walks the Markdown document structure, extracting frontmatter metadata, major section headings (`##`), and defined peril/schedule sub-headings (`###`).
- **Table Preservation**: Markdown tables are treated as atomic blocks and are never partitioned across multiple chunks.
- **Keyword Generation**: Automatically extracts domain terms, synonym tokens, and statutory phrases while filtering standard stop words.
- **Code Generation**: Emits a strongly typed, zero-dependency TypeScript module exporting the static indexed chunks array conforming to the edge runtime contract.

### 4. Corpus Linter & Verification Gate
- A static linter script will validate all Markdown files in the corpus before compilation:
  - Checks for valid frontmatter blocks with required fields: `insurer`, `product`, `doc_type`, `effective_date`, `jurisdiction`.
  - Validates Markdown table formatting and syntax.
  - Enforces mandatory statutory disclaimers where applicable.
  - Verifies peril-embargo co-location.
- The linter will be integrated directly into the automated verification command (`npm run verify`).

---

## Testing Decisions

### What Makes a Good Test
Tests must verify behavior at the public boundaries:
1. **Compilation Seam**: The compiler takes Markdown source files and outputs a valid, typed chunk collection matching the expected schema, counts, and keyword density, without requiring runtime filesystem access.
2. **Retrieval Seam**: Queries targeting any of the five insurers (NRMA, Suncorp, Allianz, QBE, Youi) or either product category (Home, Motor) must retrieve relevant policy chunks with high relevance confidence.
3. **Regulatory Invariant Seam**: All 13 AFCA eval benchmark tests (TC-01 through TC-10) must continue to pass with $\ge 0.98$ groundedness, 0.00% advice leakage, and 100% GAW presence against the refined corpus.

### Modules to Test
1. **Corpus Compiler**: Test parsing of headings, tables, frontmatter breadcrumbs, and keyword extraction.
2. **Corpus Linter**: Test detection of missing frontmatter, broken table markup, and un-colocated embargo clauses.
3. **Local Hybrid Retriever**: Test multi-insurer queries across all five brands to confirm zero ungrounded gaps.
4. **AFCA Evals Suite**: Regression test ensuring expanded corpus causes no advice leakage or hallucination regressions.

### Prior Art
- `tests/ingest/pds-normalizer.test.ts`: Existing test harness for PDS normalization and R2 path key generation.
- `tests/evals/afca-compliance.test.ts`: 10 synthetic AFCA trap scenarios validating regulatory groundedness.

---

## Out of Scope

- Scraping or automated live crawling of dynamic insurer websites (all policy documents are source-verified, pre-downloaded public PDFs or official disclosures).
- Commercial lines or business insurance PDSs (corpus remains strictly focused on retail personal lines: Home & Contents and Private Motor).
- Optical Character Recognition (OCR) of scanned paper forms (input documents are digital-native PDFs with extractable text).
- Premium calculation, underwriting algorithms, or quoting logic.

---

## Further Notes

- The compiled static corpus must preserve the edge isolate invariant: zero Node.js filesystem dependencies in `src/`.
- All newly ingested PDS documents must be synchronized to the Cloudflare R2 bucket (`faq-mate-corpus`) following the structured key format: `corpus/{insurer_code}/{product_slug}/{document_type}_{version_or_effective_date}.md`.
