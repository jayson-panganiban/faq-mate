# Ticket 02: ASIC RG 244 Conversational Decision-Factor Guardrail

Status: resolved
Type: task
Blocked by:

Update `evaluateAdviceBoundary()` to detect conversational dilemmas (*"Should I claim or pay out of pocket?"*, *"Which insurer is better for my budget?"*). Enable factual decision-factor education while enforcing deterministic safe-harbor refusals (`STATUTORY_SAFE_HARBOR_REFUSAL`) on personal recommendation and switching prompts.

## Objectives
- Enhance advice boundary evaluation regex and semantic classification.
- Support factual decision matrices without crossing the personal advice threshold.

## Answer
- Updated `evaluateAdviceBoundary()` in `src/guardrails/advice-gatekeeper.ts` to identify `CONVERSATIONAL_DILEMMA` inquiries (e.g. claim vs pay out of pocket, excess vs repair costs) and permit them with `detectedIntent: "CONVERSATIONAL_DILEMMA"` for objective decision-factor education.
- Enforced deterministic safe-harbor refusal (`STATUTORY_SAFE_HARBOR_REFUSAL` with `PERSONAL_ADVICE_REQUESTED`) on budget switching and recommendation queries ("Which insurer is better for my budget?", "Which policy is best for my budget?", etc.).
- Permitted factual multi-brand comparisons ("How do Suncorp and Allianz treat storm surge?") as `FACTUAL_PRODUCT_INQUIRY`.
- Added unit tests in `tests/guardrails/advice-gatekeeper.test.ts`.
