# Issue 03: Balanced Multi-Line Edge AST Compiler Guide Integration & Isolate Budgeting

Status: ready-for-agent
Type: task

## Description
Update `scripts/compile-corpus.ts` to include high-signal guide documents from `data/corpus/guides/` into `src/rag/corpus-data.ts` across all 5 canonical categories and core insurance lines (Home, Motor, Travel, Life, and Business).
- Implement category-balanced quota allocation instead of home-only peril filters, ensuring equitable static representation for `suncorp-group`, `major-insurers`, `challengers-auto-clubs`, `travel-specialists`, and `life-insurers`.
- Apply priority scoring so that key definitions and plain-English guide explanations across all lines are compiled into static edge chunks.
- Enforce the 1.5MB isolate bundle budget ($\le 550$ total chunks) and pure V8 isolate portability.

## Acceptance Criteria
- [ ] Static edge chunks in `src/rag/corpus-data.ts` include representative guide documents across Home, Motor, Travel, Life, and Business categories.
- [ ] Compiled bundle size remains $\le 1.5\text{MB}$ uncompressed.
- [ ] `npm run compile:corpus` succeeds without memory or token budget errors.
