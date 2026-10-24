# Ticket 06: E2E Conversational Integration & AFCA Benchmark Suite

Status: resolved
Type: task
Blocked by: 01, 02, 03, 04, 05

Implement comprehensive integration tests at the `worker.fetch(request, env, ctx)` seam covering multi-turn context carry-over, conversational dilemmas, voice dictation queries, and AFCA groundedness benchmarks ($\ge 0.98$ groundedness, 0% advice leakage, 100% GAW).

## Objectives
- Full vitest integration suite covering multi-turn SSE streams.
- AFCA eval suite with groundedness and advice-boundary assertions.
- Verify `npm run verify` passes completely.

## Answer
- Authored `tests/integration/conversational-rag.test.ts` testing multi-turn context carry-over, conversational dilemma reframing, voice dictation normalization, follow-up prompt suggestions, and APP 3/11 PII compliance at the `worker.fetch(request, env, ctx)` seam.
- Expanded `tests/evals/afca-compliance.test.ts` with TC-11 through TC-15 (catastrophe embargo follow-up, claim vs out-of-pocket dilemma, colloquial burst pipe ingestion, food spoilage product demarcation, and overseas scooter rental conditions).
- Verified `npm run verify` passes with 202/202 unit/integration tests and 18/18 AFCA evals passing with 0 advice leakage and 100% GAW compliance.
