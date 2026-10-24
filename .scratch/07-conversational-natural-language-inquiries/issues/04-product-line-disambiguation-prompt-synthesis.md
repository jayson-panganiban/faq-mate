# Ticket 04: Product-Line Disambiguation & Prompt Synthesis

Status: ready-for-agent
Type: task
Blocked by: 01, 02, 03

Update edge prompt synthesis (`src/rag/prompt-synthesizer.ts`) to inject conversation history, disambiguate across product lines (Home Building vs. Contents vs. Landlord vs. Motor), structure broad inquiries into titled comparative sections, and append `STATUTORY_GAW`.

## Objectives
- Integrate history into edge system prompt.
- Disambiguate multi-line coverages.
- Preserve non-negotiable statutory GAW footer.
