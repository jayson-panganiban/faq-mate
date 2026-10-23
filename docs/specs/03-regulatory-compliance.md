# Specification: Regulatory Guardrails & Compliance

**Module:** `packages/api/guardrails`  
**Status:** Living Specification  
**Version:** 1.0.0  
**Associated Statutes:** *Corporations Act 2001 (Cth)*, *Insurance Contracts Act 1984 (Cth)*, *Privacy Act 1988 (Cth)*  

---

## 1. Advice Boundary (Corporations Act 2001 / ASIC RG 244)

The application operates without an Australian Financial Services Licence (AFSL) and is legally prohibited from providing **Personal Financial Advice**.

### 1.1 Intent Classification Matrix

| User Query Pattern | Classification | Required System Action |
| :--- | :--- | :--- |
| *"What does Suncorp define as a flood?"* | **Factual Information** | Pass to RAG pipeline. |
| *"Does Comprehensive Motor cover hail damage?"* | **Factual Information** | Pass to RAG pipeline with policy citation. |
| *"I have $500/month budget and a 2018 Mazda 3. Which policy should I buy?"* | **Personal Advice** | **BLOCK & DIVERT** to Deterministic Refusal. |
| *"Should I cancel my Allianz policy and switch to NRMA?"* | **Personal Advice** | **BLOCK & DIVERT** to Deterministic Refusal. |
| *"Is $1,000 excess too high for me?"* | **Personal Advice** | **BLOCK & DIVERT** to Deterministic Refusal. |

### 1.2 Deterministic Refusal Message (Safe Harbor)
When personal advice intent is detected, the Worker immediately halts execution and returns:
> *"I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.*  
> *I can, however, provide factual information regarding what is covered or excluded under published Product Disclosure Statements (PDS).*  
>  
> *⚠️ General Advice Warning: Any information provided is general factual information only and does not consider your personal objectives, financial situation, or needs. Please review the relevant PDS and TMD before making a decision."*

---

## 2. Australian General Insurance Code of Practice (COP) Alignment

1. **Plain Language Mandate:** Answers must unpack dense legal terms (e.g., "sum insured", "indemnity", "unforced entry", "embargo") into plain English suitable for retail consumers.
2. **Emergency Vulnerability Triggers:** If a query mentions immediate physical catastrophe or distress (*"my house is actively burning down"*, *"we are trapped in floodwater"*, *"emergency shelter"*):
   * System prepends emergency hotlines:
     * **Triple Zero (000)** for immediate life threats.
     * **State Emergency Service (SES): 132 500** for storm/flood assistance.
     * **Disaster Welfare Services: 1800 018 444**.

---

## 3. Australian Privacy Principles (APPs - Privacy Act 1988)

* **Edge PII Redaction:** Client inputs pass through a regex/token sanitizer before entering the embedding or retrieval pipeline.
* **Redaction Rules:**
  * Tax File Numbers (TFN): `\b\d{3}\s?\d{3}\s?\d{3}\b` -> `[REDACTED_TFN]`
  * Medicare Numbers: `\b[2-6]\d{9}\s?\d?\b` -> `[REDACTED_MEDICARE]`
  * Credit Cards: Luhn-valid 16-digit sequences -> `[REDACTED_CARD]`
  * Driver Licence Numbers: Australian state formats -> `[REDACTED_LICENCE]`
* **Zero Persistence:** No raw user input containing PII is written to Cloudflare D1 or KV. D1 logs store only salted hashes of queries for duplicate/performance analysis.
