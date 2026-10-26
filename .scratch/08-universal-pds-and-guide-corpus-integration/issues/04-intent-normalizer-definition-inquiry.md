# Issue 04: Multi-Line Definition Inquiry Intent, Insurance Specialist Persona & Silent PDS Demarcation

Status: resolved
Type: task

## Description
Upgrade intent normalization, local hybrid search, prompt synthesis, and frontend silent-notice detection so the chatbot responds with the precision, structure, and tone of an experienced Australian insurance product and claims specialist.
- **Universal Definition Intent (`src/rag/intent-normalizer.ts`):** Add a `DEFINITION_INQUIRY` pattern mapping inquiries (`what is [term] definition`, `define [term]`, `what counts as [term]`, `meaning of [term]`) across terms like `flood`, `storm surge`, `rainwater run-off`, `agreed value`, `market value`, `total loss`, `tpd`, `waiting period`, `benefit period`, `pre-existing condition`, `public liability`, `indemnity period`. Expand search tokens with `definition`, `definitions`, `means`, `prescribed definition`, `words with special meanings`, `defined terms`.
- **Definition Relevance Boost (`src/rag/local-retriever.ts`):** Add heuristic relevance scoring (`+12.0`) for chunks where `source.section` contains `Definitions` or body contains `[term] means` when `DEFINITION_INQUIRY` is detected.
- **Insurance Specialist Persona & 5-Part Response Anatomy (`src/rag/prompt-synthesizer.ts` & `src/index.ts`):**
  1. Lead directly with the exact policy or statutory definition (e.g., *Insurance Contracts Regulations 2012* for Flood).
  2. Group and contrast adjacent policy events (*Flood* vs. *Rainwater Run-off* vs. *Storm Surge* vs. *Escape of Liquid*; *Agreed Value* vs. *Market Value*; *Own* vs. *Any Occupation TPD*).
  3. Explicitly call out waiting/embargo periods (48h/72h), exclusions, and monetary sub-limits.
  4. Note *Certificate of Insurance (Policy Schedule)* elections and excess tiers.
  5. Cite sources inline (`[Source: {Insurer} {Product} {DocType} ({Section})]`) and conclude with `STATUTORY_GAW`.
  - Strictly forbid meta-RAG phrasing (`"in the provided context"`, `"within the provided context"`, `"based on the provided passages"`).
- **Known Exclusion vs. Silent PDS Demarcation (`src/frontend/components/AssistantMessage.tsx`):** Tighten `SILENT_PDS_REGEX` so standard exclusion prose (`"is not covered"`, `"does not cover"`) renders as normal specialist text rather than triggering a false-positive orange `Silent PDS Notice` alert banner; reserve `Silent PDS Notice` strictly for genuine policy silence (`does not specify`, `silent on`, `policy is silent`, `pds is silent`, `unlisted domestic hazard`, `not named in the insured events`).
- **Statutory GAW Deduplication & UI Refinements (`src/constants/statutory.ts`, `AssistantMessage.tsx`, `RefusalCard.tsx`, `ChatContainer.tsx`, `AppShell.tsx`, `useChatStream.ts`):** Strip duplicate raw GAW disclaimers (including headings, bullets, numbered items, quotes, and partial streaming tails) from assistant message bodies, refusal cards, and multi-turn history, and coordinate `<StatutoryGaw />` rendering so duplicate GAW banners never appear simultaneously.

## Acceptance Criteria
- [x] `normalizeIntent()` detects `DEFINITION_INQUIRY` across multiple lines (`"What is flood definition for NRMA?"`, `"What does agreed value mean for AAMI?"`, `"What is TPD definition for Zurich?"`).
- [x] `localHybridSearch()` returns the relevant definition chunk as top-1 across Home, Motor, Travel, and Life queries.
- [x] Synthesized prompts and fallback responses adhere to the 5-part Insurance Specialist structure with zero meta-RAG phrasing.
- [x] `AssistantMessage` renders standard exclusions without triggering a false `Silent PDS Notice`, while still rendering `Silent PDS Notice` for unlisted hazards (TC-10).
- [x] `stripStatutoryGaw()` and UI components eliminate all duplicate GAW occurrences across markdown blocks, multi-turn history, and the application shell.
