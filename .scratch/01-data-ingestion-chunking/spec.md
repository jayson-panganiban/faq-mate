# Specification: Data Ingestion & Edge Compilation Pipeline

**Module:** `packages/ingest` / `scripts` / `src/rag`  
**Status:** Living Specification  
**Version:** 2.0.0  
**Associated ADRs:** [ADR-0001 (Cloudflare AI Search Hybrid Retrieval)](../adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002 (Pre-Normalized Markdown in R2)](../adr/0002-pre-normalized-markdown-r2-ingestion.md), [ADR-0003 (Static AST Corpus Edge Fallback)](../adr/0003-static-ast-corpus-edge-fallback.md), [ADR-0004 (Canonical Insurer Registry & Brand Alias Resolution)](../adr/0004-canonical-insurer-registry-alias-resolution.md)  
**Associated Specs:** [Spec 02 (Edge Runtime)](02-edge-rag-runtime.md), [Spec 03 (Regulatory)](03-regulatory-compliance.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md), [Spec 06 (Corpus & AST Compiler)](06-corpus-refinement-and-compilation.md)  

---

## 1. Responsibilities & Seams

The Ingestion & Edge Compilation Pipeline is responsible for collecting, normalizing, linting, compiling, and distributing Australian General & Life Insurance disclosure documents (Product Disclosure Statements, Supplementary PDSs, Target Market Determinations, and Insurer FAQs).

It guarantees that retrieval inputs to Cloudflare AI Search (R2) and the Cloudflare Workers V8 isolate (`src/rag/corpus-data.ts`) maintain 100% legal groundedness, preserve tabular sub-limits schedules, co-locate statutory exclusions and embargoes, and adhere strictly to pure edge isolate portability.

### The 4-Stage Architecture

```
[ Stage 1: Collector & Archive ]
  scripts/collector/
      │
      ▼
  data/raw/
    ├── all_manifest.csv (1,277 PDFs across 39 insurers)
    ├── FAQs/ (5,416 Q&As across 39 insurers)
    └── guide_seeds/ & guides_manifest.csv (937 official guide pages across 39 insurers)
      │
      ▼
[ Stage 2: Semantic Normalization ]
  scripts/normalize-corpus.ts (`npm run normalize`)
    • Current edition filtering (or `--all-historical` for all 1,277)
    • Term-level glossary extraction (`Definitions — [Term]`)
    • Markdown frontmatter injection (<!-- BREADCRUMB -->)
    • GFM table serialization & sub-limit preservation
    • Peril-exclusion & embargo co-location
    • STATUTORY_GAW injection
      │
      ▼
  data/corpus/
    ├── pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md (Committed)
    ├── faqs/{insurer_code}.md                                           (Committed)
    └── guides/{insurer_code}/{page_slug}/GUIDE_{effective_date}.md      (R2-Only, Gitignored)
      │
      ├─────────────────────────────────────────┐
      ▼                                         ▼
[ Stage 3: Edge AST Compilation & Linting ]    [ Stage 4: Cloudflare R2 Sync ]
  scripts/compile-corpus.ts (`npm run compile:corpus`)  scripts/upload-to-r2.ts (`npm run upload:r2`)
  src/ingest/corpus-linter.ts (`npm run lint:corpus`)           │
    • Lints PDS, FAQ, and locally generated GUIDE files         ▼
    • Compiles committed PDS/FAQ into AST chunk tree    Cloudflare R2 (faq-mate-corpus)
    • Heading-only chunk elimination                            │
    • BM25 keyword generation & V8 isolate budgeting            ▼
      │                                                 Cloudflare AI Search Index
      ▼
  src/rag/corpus-data.ts
```

---

## 2. Insurer Registry & Underwriter Resolution

All 39 primary insurer archives and commercial distributing brands resolve deterministically via the canonical registry in [`src/constants/insurers.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/constants/insurers.ts).

### 2.1 The 39 Primary Insurers across 5 Categories

1. **Suncorp Group (6):** Suncorp, AAMI, GIO, APIA, Shannons, Bingle (Underwriter: AAI Limited / Suncorp Group).
2. **Major Insurers (4):** Allianz, QBE, Vero, NRMA (Underwriters: Allianz Australia Insurance Limited, QBE Insurance (Australia) Limited, Insurance Australia Limited).
3. **Challengers & Auto Clubs (9):** Budget Direct, RAC WA, RAA, RACT, RACV, RACQ, CGU, Youi, TIO.
4. **Travel Specialists (8):** Go Insurance, 1Cover, InsureandGo, Fast Cover, Southern Cross Travel Insurance, Zoom, Cover-More, Travel Insurance Direct.
5. **Life Insurers (12):** Zurich, AIA, NobleOak, NEOS, HCF Life, Acenda (formerly MLC Life), Challenger, ClearView, MetLife, TAL, PPS Mutual, Asteron Life.

### 2.2 Bancassurance & White-Label Alias Resolution

Distributing retail brands, major banks, and white-labels are resolved to their underlying statutory AFS Licensee / underwriter via `INSURER_BRAND_ALIASES`:

- **CommBank, Westpac, St.George, BankSA, HSBC, Bankwest:** Resolve to Allianz Australia (General) / AIA / TAL (Life).
- **ANZ:** Resolves to QBE Insurance (Australia) Limited (General) / Cover-More (Travel).
- **NAB:** Resolves to Allianz Australia (General) / Acenda (Life).
- **ING, Everyday Insurance (Woolworths), Australian Seniors:** Resolve to Auto & General / Budget Direct / Hollard.
- **Coles Insurance, ROLLiN':** Resolve to CGU / Insurance Australia Limited (IAG).
- **Macquarie:** Resolves to Zurich Australia Limited.

---

## 3. Pipeline Stages & Execution Contracts

### Stage 1: Collection & Raw Archive

- **Scripts:** `scripts/collector/`
- **Output:** `data/raw/`
  - `data/raw/all_manifest.csv`: Comprehensive index of 1,277 collected policy disclosure PDFs, recording `insurer_code`, `category`, `product_name`, `doc_type`, `effective_date`, `source_url`, and `local_filepath`.
  - `data/raw/FAQs/`: 5,416 Q&As parsed across all 39 primary insurer FAQ disclosure sets.
- **Edition Selection Contract:**
  - **Default (Current Edition):** The normalization pipeline defaults to current, in-force PDS, SPDS, and TMD documents based on the most recent `effective_date`.
  - **Historical Archive (`--all-historical`):** When the `--all-historical` flag is supplied (`npm run normalize -- --all-historical`), all 1,277 PDFs across multi-year policy versions are ingested and normalized for historical claims disputes.

### Stage 2: Semantic Normalization

- **Command:** `npm run normalize` (`tsx scripts/normalize-corpus.ts` / `scripts/normalize-pds.ts`)
- **Output:** `data/corpus/{pds,faqs}/`
- **Normalization Invariants:**
  1. **Breadcrumb Frontmatter:** Injects structured `<!-- BREADCRUMB ... -->` blocks at the top of each document and operative section (see Section 4).
  2. **GFM Table Serialization:** Extracts structured schedules into GitHub Flavored Markdown (GFM) tables. Unstructured flattened text for sub-limits or excess tiers is strictly prohibited.
  3. **Peril-Exclusion Co-Location:** Adheres to Section 6 co-location invariants (e.g., Flood statutory definition paired with ocean water exclusions; 48h/72h embargoes paired with peril clauses).
  4. **Statutory GAW Injection:** Automatically appends the statutory General Advice Warning (`STATUTORY_GAW` under Corporations Act 2001 s.949A) to the end of every normalized FAQ and PDS document.

### Stage 3: Edge AST Compilation & Linting

- **Commands:** `npm run lint:corpus` and `npm run compile:corpus`
- **Modules:** `src/ingest/corpus-linter.ts` and `scripts/compile-corpus.ts`
- **Output:** `src/rag/corpus-data.ts`
- **Compilation Rules:**
  1. **Strict Automated Linting:** Validates frontmatter completeness, table syntax, peril co-location, and GAW presence before compilation starts.
  2. **Heading-Only Chunk Elimination:** AST traversal detects structural headings (`##`, `###`) devoid of body text or tabular content. The compiler must merge empty headers into child sections or fold them into parent breadcrumbs; emitting standalone heading-only chunks into the edge bundle is strictly prohibited.
  3. **Edge Isolate Budgeting:** Compiled static chunks in `src/rag/corpus-data.ts` must maintain dense BM25 keyword tokens and minimal serialized overhead, guaranteeing the total bundle remains well within the Cloudflare Workers 128MB isolate memory and 10MB compressed script size budget.
  4. **Single Source of Truth:** `src/rag/corpus-data.ts` is purely generated code. Manual edits are prohibited.

### Stage 4: Cloudflare R2 Synchronization

- **Command:** `npm run upload:r2` (`tsx scripts/upload-to-r2.ts`)
- **Target:** Cloudflare R2 bucket `faq-mate-corpus`
- **Sync Invariant:** Uploads only validated Markdown files matching the canonical R2 key format. Cloudflare AI Search automatically reindexes updated or newly pushed keys.

---

## 4. Canonical R2 Path Key Schema

All normalized Markdown documents stored in Cloudflare R2 must conform to the following deterministic paths:

### 4.1 Product Disclosure Statements (PDS, SPDS, TMD)
```
corpus/pds/{insurer_code}/{product_slug}/{doc_type}_{effective_date}.md
```
- `{insurer_code}`: Lowercase slug from `PRIMARY_INSURERS` (e.g., `suncorp`, `allianz`, `nrma`, `youi`, `budget-direct`).
- `{product_slug}`: Lowercase kebab-case product identifier (e.g., `home-contents-classic`, `comprehensive-motor`).
- `{doc_type}`: Uppercase document classification (`PDS`, `SPDS`, `TMD`, `FSG`).
- `{effective_date}`: ISO 8601 date format (`YYYY-MM-DD`).

*Example:* `corpus/pds/suncorp/home-contents-classic/PDS_2024-01-15.md`

### 4.2 Insurer Frequently Asked Questions (FAQs)
```
corpus/faqs/{insurer_code}.md
```
- `{insurer_code}`: Lowercase slug matching the underwriter registry.

*Example:* `corpus/faqs/allianz.md`

### 4.3 Curated Insurer Guides (GUIDE)
```
corpus/guides/{insurer_code}/{page_slug}/GUIDE_{effective_date}.md
```
- `{insurer_code}`: Lowercase slug matching the underwriter registry.
- `{page_slug}`: Lowercase kebab-case guide topic identifier (e.g., `home-insurance-storm-and-flood-insurance`).
- `{effective_date}`: ISO 8601 retrieval/publication date (`YYYY-MM-DD`).

*Example:* `corpus/guides/nrma/home-insurance-storm-and-flood-insurance/GUIDE_2026-10-25.md`

---

## 5. Hierarchical Header Injection Schema

Every normalized Markdown document and operative policy chunk must include the complete structured metadata frontmatter block:

```markdown
<!-- BREADCRUMB
insurer: Suncorp
insurer_code: SUNCORP
category: suncorp-group
product: Home & Contents Classic
doc_type: PDS
effective_date: 2024-01-15
jurisdiction: Commonwealth of Australia
section: Insured Events
sub_section: Flood
-->
# Suncorp Home & Contents Classic (PDS 2024-01-15)
## Section: Insured Events
### Insured Event 7: Flood
#### Status: Standard Cover (Subject to Exclusions & 72-Hour Embargo)
```

### Mandatory Frontmatter Fields
- `insurer`: Full statutory underwriter or commercial brand display name.
- `insurer_code`: Uppercase unique filter identifier matching `PRIMARY_INSURERS` code.
- `category`: Primary classification (`suncorp-group`, `major-insurers`, `challengers-auto-clubs`, `travel-specialists`, `life-insurers`).
- `product`: Exact product title.
- `doc_type`: Classification (`PDS`, `SPDS`, `TMD`, `FSG`, `FAQ`, `GUIDE`).
- `effective_date`: Operative policy effective date (`YYYY-MM-DD`).
- `jurisdiction`: Mandatory regulatory jurisdiction (`Commonwealth of Australia` / `Australia (Cth)`).

---

## 6. Tabular Serialization & Schedule Preservation

Policy schedules and limits must be serialized into GFM tables. Table rows must be preserved as atomic units during AST compilation and must never be partitioned across chunk boundaries:

```markdown
| Item Category | Standard Sub-Limit | Optional Increase Available? | Excess Applicable |
| :--- | :--- | :--- | :--- |
| Jewelry & Watches | $2,500 total ($1,000 per item) | Yes, specified on certificate | Standard Basic Excess |
| Works of Art & Curios | $5,000 total | Yes, with valuation certificate | Standard Basic Excess |
| Cash, Cheques, Gift Cards | $500 total | No | Standard Basic Excess |
| Tools of Trade | $1,500 total | Yes | Basic Excess + $250 |
```

---

## 7. Domain Invariant Co-Location Rules

The normalizer and AST compiler must strictly co-locate the following paired underwriting concepts within the same retrieval passage:

1. **Flood Definitions & Water Exclusions:**
   - The statutory definition of flood (*water that escapes from the normal confines of a natural watercourse, lake, or dam*) must be immediately followed by specific exclusions: storm surge, tidal wave, ocean action, and rising ground water/seepage.
2. **Embargo Waiting Periods:**
   - 48-hour or 72-hour waiting periods for Bushfire, Grassfire, Flood, and Named Cyclone must be co-located with the operative peril grant.
3. **Theft & Malicious Damage:**
   - Cover conditions must explicitly state whether "forcible and violent entry" is mandatory for contents and guest property claims.
4. **Unlicensed & Impaired Driver Exclusions:**
   - Motor policy cover grants must co-locate driver licensing, alcohol, and drug test refusal exclusions under the *Insurance Contracts Act 1984*.
5. **Statutory General Advice Warning:**
   - All document and FAQ endings must include `STATUTORY_GAW` without paraphrase.

---

## 8. Verification & Audit Commands

| Step | Command | Purpose |
| :--- | :--- | :--- |
| **Lint Corpus** | `npm run lint:corpus` | Verifies frontmatter schema, GFM table syntax, and peril co-location. |
| **Normalize Corpus** | `npm run normalize` | Normalizes current edition PDS/SPDS and all 39 insurer FAQ files. |
| **Historical Archive** | `npm run normalize -- --all-historical` | Normalizes complete 1,277 PDF historical archive. |
| **Edge AST Compile** | `npm run compile:corpus` | Compiles validated Markdown into typed `src/rag/corpus-data.ts`. |
| **R2 Upload & Key Audit** | `npm run upload:r2` | Uploads validated corpus to Cloudflare R2 bucket `faq-mate-corpus`. |
| **Full Verification Gate** | `npm run verify` | Runs TypeScript typecheck, Vitest unit suite, and AFCA compliance evals. |
