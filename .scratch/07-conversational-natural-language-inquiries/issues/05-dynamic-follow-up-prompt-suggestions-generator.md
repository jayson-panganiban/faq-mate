# Ticket 05: Dynamic Follow-Up Prompt Suggestions Generator

Status: resolved
Type: task
Blocked by: 04

Generate 2–3 contextual statutory follow-up prompt chips derived from retrieved chunk metadata (e.g. embargoes, sub-limits, carve-outs) and emit them in the SSE metadata/done payload for interactive client rendering.

## Objectives
- Extract relevant metadata keywords.
- Emit suggested prompts in SSE stream payload.

## Answer
- Implemented `generateFollowUpSuggestions()` in `src/rag/follow-up-generator.ts` mapping retrieved chunk metadata, peril tags, and carve-out boundaries into 2-3 clickable statutory questions.
- Emitted `suggested_follow_ups` in both `metadata` and `done` SSE events from `src/index.ts`.
- Integrated follow-up chips into `ChatMessage.metadata.suggestedFollowUps` in `useChatStream.ts`, rendered interactively in `AssistantMessage.tsx` and wired through `ChatContainer.tsx`.
- Created unit tests in `tests/rag/follow-up-generator.test.ts`.
