# Ticket 02: ASIC RG 244 Conversational Decision-Factor Guardrail

Status: ready-for-agent
Type: task
Blocked by:

Update `evaluateAdviceBoundary()` to detect conversational dilemmas (*"Should I claim or pay out of pocket?"*, *"Which insurer is better for my budget?"*). Enable factual decision-factor education while enforcing deterministic safe-harbor refusals (`STATUTORY_SAFE_HARBOR_REFUSAL`) on personal recommendation and switching prompts.

## Objectives
- Enhance advice boundary evaluation regex and semantic classification.
- Support factual decision matrices without crossing the personal advice threshold.
