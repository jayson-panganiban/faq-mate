# Ticket 01: Multi-Turn Inbound Schema & APP 3/11 PII Scrubber

Status: resolved
Type: task
Blocked by:

Extend `ChatRequestSchema` with an optional `history` array (max 4 turns, max 1000 chars per message). Update `sanitizePii()` to recursively scrub all historical turns while preserving the invariant that only the latest prompt is hashed with `getDailySalt()` for telemetry logging.

## Objectives
- Update request schema in `src/rag/types.ts` or edge validation.
- Ensure APP 3/11 PII compliance across conversation history.
- Test with single-turn and multi-turn payloads.

## Answer
- Extended `ChatRequestSchema` in `src/types/chat.ts` with `ChatMessageHistorySchema` (role: user/assistant, content length 1-1000 chars, max 4 messages) and relaxed min query length to 2.
- Updated `sanitizePii()` in `src/guardrails/pii-sanitizer.ts` with multi-turn overload to scrub PII from both query and history messages while strictly hashing only the latest query for k-anonymity (APP 3/11 & PRD § 5.4).
- Added comprehensive unit tests in `tests/guardrails/pii-sanitizer.test.ts` and `tests/types/chat-schema.test.ts`.
