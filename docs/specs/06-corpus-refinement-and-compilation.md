# Specification: Phase 7 — Multi-Insurer Corpus Expansion & Edge AST Compiler

**Module:** `packages/ingest` / `src/rag` / `scripts`  
**Status:** Living Specification  
**Version:** 2.0.0  
**Associated Specs:** [Spec 01 (Data Ingestion & Pipeline)](01-data-ingestion-chunking.md), [Spec 02 (Edge Runtime)](02-edge-rag-runtime.md), [Spec 03 (Regulatory Compliance)](03-regulatory-compliance.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md), [Spec 05 (Frontend Chat Interface)](05-frontend-chat-interface.md)  
**Associated ADRs:** [ADR-0001 (Cloudflare AI Search Hybrid Retrieval)](../adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002 (Pre-Normalized Markdown in R2)](../adr/0002-pre-normalized-markdown-r2-ingestion.md), [ADR-0003 (Static AST Corpus Edge Fallback)](../adr/0003-static-ast-corpus-edge-fallback.md), [ADR-0004 (Canonical Insurer Registry & Brand Alias Resolution)](../adr/0004-canonical-insurer-registry-alias-resolution.md)  

---

## 1. Problem Statement

Australian policyholders, brokers, and claimants comparing policies across underwriters face a heavily fragmented disclosure landscape. While FAQ-Mate's edge runtime and frontend UI support multi-insurer queries, scaling coverage across the Australian insurance ecosystem exposed key data and compiler challenges:

1. **Market Breadth & Underwriter Concentration**: The market is divided among conglomerate underwriters (Suncorp Group, IAG, Allianz, QBE), regional auto clubs (RACV, RACQ, RAA, RAC WA, RACT), challenger direct brands (Budget Direct, Youi), specialized travel underwriters, and life insurers. A narrow 5-insurer corpus fails to reflect real Australian consumer choice.
2. **Bancassurance & White-Label Confusion**: Major retail banks (CommBank, Westpac, ANZ, NAB, HSBC, ING) and retail conglomerates (Coles, Woolworths Everyday) market insurance policies under consumer brand names, while the underlying underwriting risk and PDS disclosures belong to licensed general and life underwriters. Consumers querying bank-branded insurance require accurate underwriter resolution without advice leakage.
3. **Manual Edge Compilation Drift**: In early versions, `src/rag/corpus-data.ts` required manual synchronization with raw Markdown sources, creating an unverified seam where normalized edits drifted from edge static chunks.
4. **Empty Heading Chunks (AST Fragmentation)**: Naive heading-based splitters emitted heading-only chunks (`## Section: Exclusions` with no paragraphs or tables), polluting top-K retrieval results with zero-information passages.
5. **Worker Bundle Budget Constraints**: An expanded corpus covering 39 insurers risks exceeding Cloudflare Workers V8 isolate limits (128MB isolate RAM and 10MB compressed script size) if static chunks are not strictly token-budgeted and optimized.

---

## 2. Solution: The v2.0 Multi-Insurer Expansion & AST Compiler

Deliver a production-grade ingestion and edge compilation pipeline expanding the FAQ-Mate knowledge base across the Australian general and life insurance market:

1. **Comprehensive 39-Insurer Roster across 5 Market Categories**:
   - Ingest 1,277 Product Disclosure Statements and policy disclosure PDFs indexed in `data/raw/all_manifest.csv`.
   - Ingest 5,416 Q&As across 39 primary insurer FAQ disclosure sets in `data/raw/FAQs/`.
2. **Canonical Insurer & Bancassurance Registry**:
   - Establish `src/constants/insurers.ts` as the single source of truth for the 39 primary insurers and their AFSL underwriter details.
   - Resolve Bancassurance (CommBank, Westpac, ANZ, NAB, HSBC, ING, Bankwest) and white-label brands (Coles Insurance, ROLLiN', Everyday Insurance, Australian Seniors) to issuing underwriters.
3. **Automated Corpus Linter (`src/ingest/corpus-linter.ts`)**:
   - Enforce mandatory frontmatter validation, GFM table integrity, peril-embargo co-location, and statutory GAW injection via `npm run lint:corpus`.
4. **Deterministic Edge AST Compiler (`scripts/compile-corpus.ts`)**:
   - Walk Markdown AST structures to generate typed static chunks in `src/rag/corpus-data.ts`.
   - Implement heading-only chunk elimination: fold empty headers into child sections or parent breadcrumbs.
   - Extract dense BM25 keyword tokens and relevance scores for sub-40ms edge isolate retrieval.
5. **Worker Isolate Bundle Budgeting**:
   - Budget edge static chunk structures to guarantee total compiled footprint remains lightweight, pure V8 isolate compatible, and zero-filesystem dependent.

---

## 3. Insurer Taxonomy & Brand Alias Matrix

### 3.1 The 39 Primary Insurers across 5 Categories

| Category | Insurers Count | Primary Insurers Included |
| :--- | :--- | :--- |
| **Suncorp Group** | 6 | Suncorp, AAMI, GIO, APIA, Shannons, Bingle |
| **Major Insurers** | 4 | Allianz, QBE, Vero, NRMA |
| **Challengers & Auto Clubs** | 9 | Budget Direct, RAC WA, RAA, RACT, RACV, RACQ, CGU, Youi, TIO |
| **Travel Specialists** | 8 | Go Insurance, 1Cover, InsureandGo, Fast Cover, Southern Cross Travel Insurance (SCTI), Zoom, Cover-More, Travel Insurance Direct (TID) |
| **Life Insurers** | 12 | Zurich, AIA, NobleOak, NEOS, HCF Life, Acenda (formerly MLC Life), Challenger, ClearView, MetLife, TAL, PPS Mutual, Asteron Life |

### 3.2 Bancassurance & White-Label Brand Alias Mappings

All brand alias resolutions are maintained centrally in [`src/constants/insurers.ts`](file:///Users/jaysoncp/Developer/faq-mate/src/constants/insurers.ts):

```typescript
// Example Alias Mappings
commbank     -> Target: "allianz"       (Allianz Australia / AIA Life)
westpac      -> Target: "allianz"       (Allianz Australia / TAL Life)
anz          -> Target: "qbe"           (QBE Insurance / Cover-More Travel)
nab          -> Target: "allianz"       (Allianz Australia / Acenda Life)
ing          -> Target: "budget-direct" (Auto & General / Hollard)
"coles"      -> Target: "cgu"           (Insurance Australia Limited / IAG)
"rollin"     -> Target: "cgu"           (Insurance Australia Limited / IAG)
"everyday"   -> Target: "budget-direct" (Everyday Insurance / Hollard / Auto & General)
```

---

## 4. AST Chunking & Heading-Only Elimination

### 4.1 The Heading-Only Chunk Problem
When chunking hierarchically structured PDS documents, documents often contain intermediate structural headers:
```markdown
## Section 3: Exclusions
### 3.1 General Policy Exclusions
The following exclusions apply across all covers...
```
A naive heading chunker creates a chunk for `## Section 3: Exclusions` containing zero body text. In hybrid search, this chunk matches queries on "exclusions" with high keyword density but provides zero grounding content, displacing informative passages from top-K context.

### 4.2 AST Elimination & Merging Algorithm
The AST compiler (`scripts/compile-corpus.ts`) executes the following invariant rules:
1. **Empty Header Elimination:** When an AST heading node (`##`, `###`) is encountered without immediate body paragraphs, tables, or list items before the next heading:
   - The empty heading's title is appended to the hierarchical breadcrumb path (`section` -> `sub_section`).
   - The empty heading is not emitted as an independent chunk.
2. **Atomic Table Preservation:** Markdown tables (`| ... |`) are never split across chunks. The table and its preceding descriptive header are compiled into an atomic chunk with full sub-limit metadata.
3. **Chunk Minimum Substance Bar:** Every emitted chunk must have at least one substantive sentence or table row ($\ge 30$ tokens of policy content).

---

## 5. Worker Isolate Bundle Budgeting

To ensure zero latency regression and protect the Cloudflare Worker V8 isolate budget:

1. **Zero Filesystem Invariant in `src/`:** The runtime reads static chunks solely from `src/rag/corpus-data.ts`. No `node:fs`, `node:path`, or `process.cwd()` is imported in `src/`.
2. **Dense Static Representation:** Static chunks use condensed metadata keys and pre-extracted BM25 keyword arrays, preventing runtime tokenization overhead.
3. **Bundle Size Ceiling:**
   - Compiled `src/rag/corpus-data.ts` source size: $\le 1.5\text{MB}$ uncompressed.
   - Total Worker bundle (including React frontend SSR/pages assets and edge logic): $\le 5\text{MB}$ compressed (well within the Cloudflare 10MB limit).
   - Peak isolate heap memory at runtime: $\le 32\text{MB}$ (well within the Cloudflare Workers 128MB ceiling).

---

## 6. Automated Corpus Linter (`src/ingest/corpus-linter.ts`)

The corpus linter runs as a prerequisite gate during `npm run compile:corpus` and in `npm run lint:corpus`. It validates:

1. **Frontmatter Integrity:**
   - Every file must start with `<!-- BREADCRUMB ... -->`.
   - Mandatory keys: `insurer`, `insurer_code`, `category`, `product`, `doc_type`, `effective_date`, `jurisdiction`.
   - `insurer_code` and `category` must match valid entries in `src/constants/insurers.ts`.
2. **Table Syntax:**
   - Markdown tables must have matching column counts in header and row lines.
   - Tables must contain valid GFM delimiter rows (`| :--- | :--- |`).
3. **Peril-Embargo Co-Location:**
   - Verifies that occurrences of flood clauses contain co-located ocean/surge exclusions.
   - Verifies that bushfire, flood, and cyclone operative sections contain statutory waiting period disclosures (48h or 72h).
4. **General Advice Warning:**
   - Verifies that every normalized document contains the unmodified `STATUTORY_GAW`.

---

## 7. User Stories

1. **Suncorp Group Policyholder:** As an APIA or AAMI policyholder, I want to query my Home Contents policy regarding accidental damage sub-limits, so that I receive answers grounded in AAI Limited underwriting terms.
2. **Bancassurance Customer:** As a CommBank customer with Home Insurance, I want my query about flood cover to resolve to Allianz Australia terms while clearly identifying CommBank as the distributor, so that I understand who underwrites my policy.
3. **Auto Club Member:** As an RACV or RACQ member, I want to compare towing and emergency accommodation allowances with Budget Direct, so that I can see the exact schedule differences in GFM tables.
4. **Travel Insurance Traveler:** As an overseas traveler comparing Fast Cover and Cover-More, I want to check existing medical condition exclusions and snow sports excess surcharges, so that I have clear underwriting rules before departure.
5. **Life Insurance Claimant:** As a holder of TAL or AIA life insurance, I want to inspect TPD (Total & Permanent Disability) definition criteria (any occupation vs own occupation), so that I understand eligibility thresholds without financial advice bias.
6. **Edge Platform Engineer:** As an edge runtime engineer, I want `src/rag/corpus-data.ts` to compile deterministically without heading-only chunks, so that Worker memory and TTFT latency remain sub-40ms on Cloudflare's Anycast edge.
7. **Compliance Auditor:** As an AFCA compliance officer, I want every compiled passage to feature statutory GAW text and structured breadcrumbs, so that every generated edge response satisfies Section 949A.

---

## 8. Verification & Test Contracts

### 8.1 Automated Verification Commands

| Command | Action | Verification Gate |
| :--- | :--- | :--- |
| `npm run lint:corpus` | Runs `src/ingest/corpus-linter.ts` | 0 lint errors across all files in `data/corpus/` |
| `npm run normalize` | Runs normalization pipeline | Current operative PDS/SPDS & 39 FAQ files generated |
| `npm run compile:corpus` | Runs `scripts/compile-corpus.ts` | `src/rag/corpus-data.ts` compiled without empty heading chunks |
| `npm run upload:r2` | Syncs normalized files to R2 | Canonical key audit against Cloudflare R2 |
| `npm run verify` | Full CI verification gate | Typecheck + Unit Tests + AFCA Compliance Evals |

### 8.2 Test Suite Parity
- All 13 AFCA eval scenarios (TC-01 through TC-10) in [`tests/evals/afca-compliance.test.ts`](file:///Users/jaysoncp/Developer/faq-mate/tests/evals/afca-compliance.test.ts) must continue to pass with $\ge 0.98$ groundedness and $0.00\%$ personal advice leakage.
- Insurer resolution tests must verify that queries specifying brand aliases (e.g., `commbank`, `coles`, `ing`) resolve to the proper underwriter without ungrounded hallucinations.

---

## 9. Known Gaps

| # | Gap | Current Behaviour | Target Behaviour |
| :--- | :--- | :--- | :--- |
| G8 | Peril Co-Location Lint Rules | Peril co-location (flood + ocean surge, embargo waiting periods) is enforced via normalizer pipeline conventions and manual audits. | Add automated syntax checks in `lintMarkdownDocument()` verifying that occurrences of flood clauses contain co-located ocean surge exclusions. |
| G10 | Worker Bundle & Isolate Memory CI Checks | Bundle size and heap memory are constrained by compiler chunk budgeting (~1.0 MB raw). | Add automated bundle size and isolate heap measurement assertions directly into `npm run verify`. |
