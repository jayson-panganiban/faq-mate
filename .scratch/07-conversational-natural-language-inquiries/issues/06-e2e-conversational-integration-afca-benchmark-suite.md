# Ticket 06: E2E Conversational Integration & AFCA Benchmark Suite

Status: ready-for-agent
Type: task
Blocked by: 01, 02, 03, 04, 05

Implement comprehensive integration tests at the `worker.fetch(request, env, ctx)` seam covering multi-turn context carry-over, conversational dilemmas, voice dictation queries, and AFCA groundedness benchmarks ($\ge 0.98$ groundedness, 0% advice leakage, 100% GAW).

## Objectives
- Full vitest integration suite covering multi-turn SSE streams.
- AFCA eval suite with groundedness and advice-boundary assertions.
- Verify `npm run verify` passes completely.
