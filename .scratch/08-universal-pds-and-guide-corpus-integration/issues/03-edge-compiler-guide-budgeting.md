# Issue 03: Category-Balanced Multi-Line Edge AST Compilation & Isolate Budgeting

Status: resolved
Type: task

## Description
Update `src/ingest/corpus-compiler.ts` and `scripts/compile-corpus.ts` so `src/rag/corpus-data.ts` compiles a category-balanced, definition-enriched static bundle from committed `data/corpus/pds/` and `data/corpus/faqs/` across all 5 canonical categories and core insurance lines (Home, Motor, Travel, Life, and Business), while linting any locally generated `data/corpus/guides/` (which remain R2-only per `AGENTS.md` Rule 7 and ADR-0003).
- Implement category-balanced quota allocation across `suncorp-group`, `major-insurers`, `challengers-auto-clubs`, `travel-specialists`, and `life-insurers`.
- Apply priority scoring in `scoreChunkPriority()` so that extracted `Definitions — [Term]`, `Insured Events`, `Exclusions & Embargoes`, and `Sub-Limits` clauses across all product lines are prioritized into static edge chunks.
- Enforce the 1.5MB isolate bundle budget ($\le 550$ total chunks) and pure V8 isolate portability.

## Acceptance Criteria
- [x] Static edge chunks in `src/rag/corpus-data.ts` include extracted `Definitions — [Term]` and core clauses across Home, Motor, Travel, Life, and Business categories for all 39 insurers.
- [x] Compiled bundle size remains $\le 1.5\text{MB}$ uncompressed.
- [x] `npm run compile:corpus` succeeds without memory or token budget errors.
