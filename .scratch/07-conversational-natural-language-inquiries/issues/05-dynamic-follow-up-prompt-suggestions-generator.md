# Ticket 05: Dynamic Follow-Up Prompt Suggestions Generator

Status: ready-for-agent
Type: task
Blocked by: 04

Generate 2–3 contextual statutory follow-up prompt chips derived from retrieved chunk metadata (e.g. embargoes, sub-limits, carve-outs) and emit them in the SSE metadata/done payload for interactive client rendering.

## Objectives
- Extract relevant metadata keywords.
- Emit suggested prompts in SSE stream payload.
