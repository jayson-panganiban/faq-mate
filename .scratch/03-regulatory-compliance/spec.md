# Specification: Regulatory Guardrails & Compliance

**Module:** `src/guardrails/advice-gatekeeper.ts`, `src/guardrails/pii-sanitizer.ts`, `src/frontend/utils/client-pii-scrubber.ts`, `src/constants/statutory.ts`, `src/constants/insurers.ts`  
**Status:** Living Specification  
**Version:** 2.0.0  
**Associated Statutes:** *Corporations Act 2001 (Cth)*, *Insurance Contracts Act 1984 (Cth)*, *Privacy Act 1988 (Cth)*, *General Insurance Code of Practice (COP)*  
**Associated ADRs:** [ADR-0004 (Canonical Insurer Registry & Brand Alias Resolution)](../adr/0004-canonical-insurer-registry-alias-resolution.md)  
**Associated Specs:** [Spec 02 (Edge Runtime)](02-edge-rag-runtime.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md), [Spec 05 (Frontend)](05-frontend-chat-interface.md)  
**Test Contracts:** [`tests/integration/worker.test.ts`](../../tests/integration/worker.test.ts), [`tests/evals/afca-compliance.test.ts`](../../tests/evals/afca-compliance.test.ts), [`tests/frontend/client-pii-scrubber.test.ts`](../../tests/frontend/client-pii-scrubber.test.ts)

---

## 1. Advice Boundary (Corporations Act 2001 / ASIC RG 244)

The application operates without an Australian Financial Services Licence (AFSL) and is legally prohibited under Section 766B of the *Corporations Act 2001 (Cth)* from providing **Personal Financial Product Advice**.

### 1.1 Intent Classification Matrix

| User Query Pattern | Classification | Required System Action |
| :--- | :--- | :--- |
| *"What does Suncorp define as a flood?"* | **Factual Information** | Pass to retrieval and synthesis pipeline. |
| *"Does Comprehensive Motor cover hail damage?"* | **Factual Information** | Pass to retrieval with policy citation. |
| *"According to the Target Market Determination, who is this product for?"* | **TMD Inquiry** | Pass with DDO/TMD factual criteria framing ([PRD § 5.3](../PRD.md#53-design-and-distribution-obligations-ddo--tmd-alignment)). |
| *"I earn $60,000 and have two kids, which car insurance can I afford?"* | **Personal Advice** | **BLOCK & DIVERT** to deterministic safe-harbor refusal. |
| *"Should I cancel my Allianz policy and switch to NRMA?"* | **Personal Advice** | **BLOCK & DIVERT** to deterministic safe-harbor refusal. |
| *"Is $1,000 excess too high for me?"* | **Personal Advice** | **BLOCK & DIVERT** to deterministic safe-harbor refusal. |
| *"Which policy is best for my budget?"* | **Personal Advice** | **BLOCK & DIVERT** to deterministic safe-harbor refusal. |
| *"Which is better for me, CommBank or Suncorp?"* | **Brand Comparison Advice** | **BLOCK & DIVERT** via `BRAND_COMPARISON_ADVICE_REGEX`. |

### 1.2 Deterministic Refusal Message (Safe Harbor)
When personal financial advice intent is detected, `evaluateAdviceBoundary()` returns:
```typescript
{
  allowed: false,
  reason: "PERSONAL_ADVICE_REQUESTED",
  refusalMessage: STATUTORY_SAFE_HARBOR_REFUSAL,
}
```
`STATUTORY_SAFE_HARBOR_REFUSAL` is imported directly from [`src/constants/statutory.ts`](../../src/constants/statutory.ts) (`AGENTS.md` Rule 2 & 3):
> *"I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.*  
>  
> *I can, however, provide factual information regarding what is covered or excluded under published Product Disclosure Statements (PDS).*  
>  
> *⚠️ General Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice."*

### 1.3 Brand-Comparison Heuristics & Registry Synchronization
Under ASIC RG 244, recommending one brand over another constitutes financial product advice. `evaluateAdviceBoundary()` checks queries against `BRAND_COMPARISON_ADVICE_REGEX` ([`src/constants/insurers.ts`](../../src/constants/insurers.ts)):
* Dynamically compiles brand names from all **39 primary insurers** and all **24 bancassurance / white-label aliases** (e.g., CommBank, Coles, Everyday, ROLLiN', ANZ, NAB, Westpac, ING).
* Detects comparative recommendation patterns such as `/(is|should I (choose|pick|switch to)) (BrandA) (better than|or|versus) (BrandB)/i`.

---

## 2. Code of Practice (COP) Life-Safety Interception

Under the Australian General Insurance Code of Practice (COP) Vulnerable Customers provisions, life safety and disaster response supersede financial product inquiries.

### 2.1 Emergency Catastrophe Heuristics
Before evaluating advice boundaries, `evaluateAdviceBoundary()` evaluates the **Emergency Gate** against active peril and distress patterns:
* **Trigger Patterns:** House actively on fire / burning, trapped in floodwater / rising water, active bushfire at house, immediate life threat, emergency shelter request.
* **Gatekeeper Output:**
  ```typescript
  {
    allowed: false,
    reason: "EMERGENCY_LIFE_SAFETY",
    emergencyHotline: EMERGENCY_HOTLINES.summary,
    refusalMessage: EMERGENCY_REFUSAL_MESSAGE,
  }
  ```
* **Statutory Contacts Provided:**
  * **Triple Zero (000)** for immediate life threats.
  * **State Emergency Service (SES): 132 500** for storm and flood emergency assistance.
  * **Disaster Welfare Services: 1800 018 444** for emergency accommodation and catastrophe support.
* **Frontend Rendering:** `EmergencyBanner` renders high-contrast red alert cards with click-to-call `tel:000`, `tel:132500`, and `tel:1800018444` buttons.

---

## 3. Australian Privacy Principles (APP 3 & 11)

Under the *Privacy Act 1988 (Cth)*, retail insurance queries must prevent the collection, storage, or unmasked transmission of Personal Identifiable Information (PII).

### 3.1 Defense-in-Depth PII Redaction

1. **Browser Pre-Ingress Scrubbing (`sanitizeClientPii()` in `src/frontend/utils/client-pii-scrubber.ts`):**
   * Scans input text before network transmission.
   * Replaces Australian Tax File Numbers (TFN), Medicare cards, credit card numbers, phone numbers, and driver licence numbers with redacted tokens.
   * Sets client-side sanitization state and displays the `PiiAssuranceBadge`.
2. **Edge Ingress Sanitization (`sanitizePii()` in `src/guardrails/pii-sanitizer.ts`):**
   * Redacts any unmasked PII that bypassed or disabled client scripting:
     * **TFN:** `\b\d{3}\s?\d{3}\s?\d{3}\b` → `[REDACTED_TFN]`
     * **Medicare:** `\b[2-6]\d{9}\s?\d?\b` → `[REDACTED_MEDICARE]`
     * **Credit Card:** Luhn-valid 16-digit patterns → `[REDACTED_CARD]`
     * **Australian Phone:** Mobile (`04xx xxx xxx`), landline (`02/03/07/08`), and international `+61` → `[REDACTED_PHONE]`
     * **Driver Licence:** Prefixed state formats → `licence [REDACTED_LICENCE]`

### 3.2 k-Anonymity & Zero Raw Query Persistence
* **Daily Salted Hashing (`getDailySalt()`):** Computes `SHA-256("faq-mate-daily-salt-YYYY-MM-DD" + ":" + sanitizedQuery)` rotating every UTC midnight.
* **Persistent Storage Invariant:** Zero raw query text is stored in Cloudflare D1. Only `query_hash` is recorded in `rag_telemetry_audit` (`AGENTS.md` Rule 5).

---

## 4. Mandatory Statutory General Advice Warning (GAW)

Under Section 949A of the *Corporations Act 2001 (Cth)*, all non-refusal communications must carry the statutory GAW without alteration (`AGENTS.md` Rule 2).

* **Canonical Copy:** Exported as `STATUTORY_GAW` in [`src/constants/statutory.ts`](../../src/constants/statutory.ts) and defined in [`GLOSSARY.md`](../../GLOSSARY.md#2-regulatory--compliance-terms).
* **Document Footers:** Automatically appended to every normalized document in `data/corpus/` via `formatStatutoryFooter()` in [`src/ingest/corpus-codec.ts`](../../src/ingest/corpus-codec.ts).
* **Streaming Responses:** Appended to every synthesized response in `src/rag/prompt-synthesizer.ts` and `generateFallbackResponse()`.
* **Frontend Persistence:** Permanently rendered in the `AppShell` application footer and on `AssistantMessage` bubbles.

---

## 5. Verification Contracts

| Test Suite | Assertions |
| :--- | :--- |
| `tests/frontend/client-pii-scrubber.test.ts` | Validates client-side redaction of TFNs, Medicare, Credit Cards, Phones, Licences, and immutability of safe queries. |
| `tests/integration/worker.test.ts` (#3) | Asserts personal financial advice queries return `event: error` with `ADVICE_BOUNDARY_VIOLATION` and `STATUTORY_SAFE_HARBOR_REFUSAL`. |
| `tests/integration/worker.test.ts` (#4) | Asserts active life-threat emergencies return `event: error` with `EMERGENCY_INTERCEPTION` and hotlines. |
| `tests/integration/worker.test.ts` (#6) | Asserts edge PII redaction and daily-salted SHA-256 hashing. |
| `tests/evals/afca-compliance.test.ts` (TC-06, TC-07, TC-09) | Evaluates end-to-end advice refusal, brand comparison refusal, and emergency catastrophe protocol against the Worker. |

---

## 6. Known Gaps

| # | Gap | Current Behaviour | Target Behaviour |
| :--- | :--- | :--- | :--- |
| G5 | Runtime Advice-Leakage Stream Filter | Advice gate runs only pre-inference; CI evals check generated responses. | Active streaming token scanner that aborts stream or falls back if LLM emits advice phrasing ("I recommend", "you should buy"). |
