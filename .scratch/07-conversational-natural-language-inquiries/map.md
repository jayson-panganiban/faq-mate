# Wayfinding Map: Conversational Natural Language Inquiries (Spec 07)

**Spec Reference:** [`spec.md`](spec.md)  
**Triage Role:** `resolved`  
**Integration Branch:** `feat/spec-07-conversational-rag`

## Notes & Decisions
- Multi-turn inbound schema with APP 3/11 PII scrubbing.
- ASIC RG 244 conversational decision-factor guardrail.
- Sub-ms voice & colloquial intent normalizer mapping slang/speech-to-text tokens to statutory insurance terms.
- Product-line disambiguation and dynamic follow-up prompt chips.
- Comprehensive AFCA benchmark suite for conversational multi-turn flows.

## Task Graph

```mermaid
graph TD
    T1[Ticket 1: Multi-Turn Inbound Schema & APP 3/11 PII Scrubber] --> T3[Ticket 3: Sub-ms Voice & Colloquial Intent Normalizer]
    T2[Ticket 2: ASIC RG 244 Conversational Decision-Factor Guardrail] --> T4[Ticket 4: Product-Line Disambiguation & Prompt Synthesis]
    T3 --> T4
    T4 --> T5[Ticket 5: Dynamic Follow-Up Prompt Suggestions Generator]
    T5 --> T6[Ticket 6: E2E Conversational Integration & AFCA Benchmark Suite]
    T1 --> T6
    T2 --> T6
```

## Decisions So Far
- Architecture and living spec authored at `spec.md`.
- All 6 tickets triaged and marked `ready-for-agent`.
- **Ticket 01 Resolved:** Extended `ChatRequestSchema` with `history` (max 4, max 1000 chars/message) and upgraded `sanitizePii()` for multi-turn history scrubbing while hashing only the latest query for k-anonymity ([`01-multi-turn-inbound-schema-pii-scrubber.md`](issues/01-multi-turn-inbound-schema-pii-scrubber.md)).
- **Ticket 02 Resolved:** Updated `evaluateAdviceBoundary()` to detect conversational dilemmas (`CONVERSATIONAL_DILEMMA`) for objective decision-factor education while maintaining deterministic `STATUTORY_SAFE_HARBOR_REFUSAL` on personal switching/budget prompts ([`02-asic-rg244-conversational-decision-factor-guardrail.md`](issues/02-asic-rg244-conversational-decision-factor-guardrail.md)).
- **Ticket 03 Resolved:** Implemented sub-ms deterministic voice & colloquial intent normalizer `src/rag/intent-normalizer.ts` and integrated intent peril boosts into `localHybridSearch` ([`03-sub-ms-voice-colloquial-intent-normalizer.md`](issues/03-sub-ms-voice-colloquial-intent-normalizer.md)).
- **Ticket 04 Resolved:** Enhanced `synthesizePrompt()` in `src/rag/prompt-synthesizer.ts` and `generateFallbackResponse()` in `src/index.ts` with multi-turn history injection, product-line demarcation headings, and conversational dilemma decision matrices ([`04-product-line-disambiguation-prompt-synthesis.md`](issues/04-product-line-disambiguation-prompt-synthesis.md)).
- **Ticket 05 Resolved:** Implemented `generateFollowUpSuggestions()` in `src/rag/follow-up-generator.ts`, emitted `suggested_follow_ups` in edge SSE stream, and wired interactive chips to `AssistantMessage.tsx` ([`05-dynamic-follow-up-prompt-suggestions-generator.md`](issues/05-dynamic-follow-up-prompt-suggestions-generator.md)).
- **Ticket 06 Resolved:** Implemented e2e integration suite `tests/integration/conversational-rag.test.ts` and AFCA benchmark scenarios TC-11 through TC-15 in `tests/evals/afca-compliance.test.ts`, verifying full `npm run verify` pass ([`06-e2e-conversational-integration-afca-benchmark-suite.md`](issues/06-e2e-conversational-integration-afca-benchmark-suite.md)).
- **Code Review Complete:** Two-axis code review (Standards + Spec) conducted and verified. Refactored repeated switch peril boosts into table-driven map, resolved primitive obsession with `InsurancePeril` type, deduplicated follow-up prompt eligibility predicate, stripped voice transcription noise prior to retrieval, added context-aware retrieval query enrichment, and enabled conversational brand alias extraction. Full verification gate passing.
