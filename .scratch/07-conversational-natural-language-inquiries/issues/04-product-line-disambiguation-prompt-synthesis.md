# Ticket 04: Product-Line Disambiguation & Prompt Synthesis

Status: resolved
Type: task
Blocked by: 01, 02, 03

Update edge prompt synthesis (`src/rag/prompt-synthesizer.ts`) to inject conversation history, disambiguate across product lines (Home Building vs. Contents vs. Landlord vs. Motor), structure broad inquiries into titled comparative sections, and append `STATUTORY_GAW`.

## Objectives
- Integrate history into edge system prompt.
- Disambiguate multi-line coverages.
- Preserve non-negotiable statutory GAW footer.

## Answer
- Updated `synthesizePrompt()` in `src/rag/prompt-synthesizer.ts` with `SynthesizePromptOptions` to inject chronological multi-turn history into `ChatMessage[]`.
- Enhanced system prompt with explicit PRODUCT LINE DEMARCATION requirements (demarcating Home Building, Contents, Landlord, and Motor under dedicated Markdown headings) and CONVERSATIONAL DILEMMA instructions.
- Upgraded `generateFallbackResponse()` in `src/index.ts` to output structured multi-product headings, objective decision criteria for claim dilemmas, and mandatory `STATUTORY_GAW`.
- Added unit tests in `tests/rag/prompt-synthesizer.test.ts`.
