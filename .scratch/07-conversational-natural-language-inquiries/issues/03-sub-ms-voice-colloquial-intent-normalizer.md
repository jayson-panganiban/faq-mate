# Ticket 03: Sub-ms Voice & Colloquial Intent Normalizer

Status: resolved
Type: task
Blocked by: 01

Implement a lightweight, deterministic AST/regex intent normalizer ($< 1\text{ ms}$) in `src/rag/intent-normalizer.ts` that strips speech-to-text verbal fillers (*"um"*, *"like"*, *"so basically"*) and maps colloquial terms (*"burst pipe"*, *"soaked floor"*, *"smashed window"*, *"blackout food"*) into canonical statutory insurance tokens (`Escape of Liquid`, `Theft with Violent Entry`, `Food Spoilage`).

## Objectives
- Create `src/rag/intent-normalizer.ts`.
- Map colloquial peril terms to statutory terms without remote LLM latency.

## Answer
- Implemented `normalizeIntent()` in `src/rag/intent-normalizer.ts` executing in $< 0.1\text{ ms}$ at the edge isolate.
- Strips leading and mid-sentence speech-to-text verbal fillers ("um", "uh", "so basically", "actually", "you know", "like").
- Maps Australian colloquial phrases to statutory canonical tokens (Escape of Liquid, Violent and Forcible Entry, Food Spoilage, Motorcycle Endorsement, Boundary Fence, Rainwater Run-off, Actions of the Sea, Jewelry Sub-limit, 72-Hour Embargo).
- Integrated intent normalization into `localHybridSearch` (`src/rag/local-retriever.ts`) with expanded keyword matching and peril scoring boosts.
- Created unit tests in `tests/rag/intent-normalizer.test.ts` and `tests/rag/local-retriever.test.ts`.
