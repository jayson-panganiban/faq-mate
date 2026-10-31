# ADR-0004: Canonical Insurer Registry & Bancassurance Alias Resolution

## Status
Accepted (2026-10-24)

## Context
The v1 system hard-coded five insurers (`NRMA`, `SUNCORP`, `ALLIANZ`, `QBE`, `YOUI`) in separate places: the request schema enum, the frontend selector, the comparison matrix, the advice gatekeeper's brand-comparison regex, and the ingestion scripts. Expanding to the 39-insurer archive in `data/raw/` exposed three problems:

1. **Drift across seams:** Each hard-coded list diverged. A brand accepted by the UI could be rejected by the API schema or missed by the RG 244 comparison gate.
2. **Bancassurance & white-label confusion:** Consumers ask about "CommBank home insurance" or "Coles car insurance", but the PDS and the AFS Licence belong to the underwriter (Allianz, CGU/IAG, etc.). Treating these as separate insurers fragments retrieval and misattributes disclosures.
3. **Advice-boundary coverage:** Brand-comparison advice ("Is Suncorp better than NRMA for me?") must be detected for every brand a user might name, including aliases.

## Decision
`src/constants/insurers.ts` is the **single source of truth** for insurer identity. All other modules derive from it:

1. **`PRIMARY_INSURERS`:** 39 `InsurerProfile` records (`name`, `slug`, `code`, `category`, `underwriter` with ABN/AFSL, `productLines`) across 5 categories: `suncorp-group` (6), `major-insurers` (4), `challengers-auto-clubs` (9), `travel-specialists` (8), `life-insurers` (12).
2. **`INSURER_BRAND_ALIASES`:** 24 bancassurance/white-label keys mapped to `{ targetSlug, displayBrand, underwriterNote }` (e.g., `commbank → allianz`, `anz → qbe`, `coles → cgu`, `ing → budget-direct`, `macquarie → zurich`, `mlc-life → acenda`).
3. **`resolveInsurer(input)`:** The only lookup function. It accepts a name, slug, code, or alias and returns the primary profile (or `null`).
4. **Derived consumers:**
   * `ChatRequestSchema.filters.insurer` (`src/types/chat.ts`) validates via `resolveInsurer() !== null`.
   * `BRAND_COMPARISON_ADVICE_REGEX` is built from the registry and used by `evaluateAdviceBoundary()`.
   * `getGroupedInsurerOptions()` feeds the `GlobalFilterDropdown` roster (composer chip filter via the `InsurerFilterMenu` composition and the two `field`-variant comparison pickers); `POLICY_COMPARISON_DIMENSIONS` / `resolvePolicyComparisonCell()` feed `PolicyComparisonView` (cells rendered through the `MarkdownText` sanitized pipeline).
   * `toInsurerSlug()` produces `insurer_code` values used in breadcrumbs and R2 keys (`src/ingest/corpus-codec.ts`).

## Consequences
### Positive
* Adding an insurer or alias is a one-file change that propagates to the schema, UI, gatekeeper, and ingestion.
* Bank-branded queries retrieve the issuing underwriter's PDS while the UI can still show the distributing brand.
* The RG 244 brand-comparison gate covers the full roster by construction.

### Negative / Trade-Offs
* Alias targets reflect distribution arrangements at a point in time; bancassurance partnerships change and must be reviewed when the raw archive is refreshed.
* Some aliases have different underwriters per product line (e.g., a bank's general vs. life cover). The current model maps each alias to **one** `targetSlug` and records the nuance only in `underwriterNote`.
* The registry file is large (~740 lines); it should stay data-only, with no runtime I/O.
