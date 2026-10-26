# Issue 04: Multi-Line Definition Inquiry Intent & Heuristic Relevance Boosting

Status: ready-for-agent
Type: task

## Description
Upgrade intent normalization and local hybrid search to support universal definition inquiries across all insurance lines (Home, Motor, Travel, Life, and Commercial).
- In `src/rag/intent-normalizer.ts`, add a `DEFINITION_INQUIRY` pattern mapping inquiries such as `what is [term] definition`, `define [term]`, `what counts as [term]`, `meaning of [term]` across terms like `flood`, `agreed value`, `market value`, `total loss`, `tpd`, `waiting period`, `pre-existing condition`, `public liability`.
- Expand search tokens with `definition`, `definitions`, `means`, `prescribed definition`, `words with special meanings`, `defined terms`.
- In `src/rag/local-retriever.ts`, add heuristic relevance scoring for chunks where `source.section` contains `Definitions` or body contains `[term] means` when `DEFINITION_INQUIRY` is detected.

## Acceptance Criteria
- [ ] `normalizeIntent()` detects `DEFINITION_INQUIRY` across multiple lines (e.g. `"What is flood definition for NRMA?"`, `"What does agreed value mean for AAMI?"`, `"What is TPD definition for Zurich?"`).
- [ ] `localHybridSearch()` returns the relevant definition chunk as top-1 across Home, Motor, Travel, and Life queries.
