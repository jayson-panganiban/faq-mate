# Ticket 01: Multi-Turn Inbound Schema & APP 3/11 PII Scrubber

Status: ready-for-agent
Type: task
Blocked by:

Extend `ChatRequestSchema` with an optional `history` array (max 4 turns, max 1000 chars per message). Update `sanitizePii()` to recursively scrub all historical turns while preserving the invariant that only the latest prompt is hashed with `getDailySalt()` for telemetry logging.

## Objectives
- Update request schema in `src/rag/types.ts` or edge validation.
- Ensure APP 3/11 PII compliance across conversation history.
- Test with single-turn and multi-turn payloads.
