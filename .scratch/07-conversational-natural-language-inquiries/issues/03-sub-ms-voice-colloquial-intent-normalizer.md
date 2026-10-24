# Ticket 03: Sub-ms Voice & Colloquial Intent Normalizer

Status: ready-for-agent
Type: task
Blocked by: 01

Implement a lightweight, deterministic AST/regex intent normalizer ($< 1\text{ ms}$) in `src/rag/intent-normalizer.ts` that strips speech-to-text verbal fillers (*"um"*, *"like"*, *"so basically"*) and maps colloquial terms (*"burst pipe"*, *"soaked floor"*, *"smashed window"*, *"blackout food"*) into canonical statutory insurance tokens (`Escape of Liquid`, `Theft with Violent Entry`, `Food Spoilage`).

## Objectives
- Create `src/rag/intent-normalizer.ts`.
- Map colloquial peril terms to statutory terms without remote LLM latency.
