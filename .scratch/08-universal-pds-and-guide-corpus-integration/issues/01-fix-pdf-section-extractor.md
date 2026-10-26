# Issue 01: Universal Multi-Line PDF Section Extractor & Term-Level Glossary Parsing

Status: resolved
Type: task

## Description
Upgrade `src/ingest/pds-normalizer.ts` to properly extract policy glossaries and core sections from PDS PDFs across all insurance lines (Home, Motor, Travel, Life, and Commercial).
- Fix the regex bug where `Excess means...` matches a heading and lumps all following definitions and sections into monolithic `Excess (Part N)` blocks.
- Implement universal term-level definition extraction for `[Term] means ...` patterns across all lines:
  - *Home:* Flood, Storm, Rainwater Run-off, Building, Contents
  - *Motor:* Agreed Value, Market Value, Total Loss, Choice of Repairer, Unlicensed Driver
  - *Travel:* Pre-existing Condition, Medically Necessary, Curtailment, Unforeseen Circumstances
  - *Life:* Total and Permanent Disablement (TPD), Waiting Period, Benefit Period, Trauma
  - *Commercial:* Public Liability, Indemnity Period, Business Interruption
- Output discrete sections titled `Definitions — [Term]`.
- Leverage `/opt/homebrew/bin/pdftotext` with a fallback to `unpdf` for sub-second full document extraction.
- Write unit tests in `tests/ingest/pds-normalizer.test.ts` verifying discrete section parsing from sample PDF text across multiple lines.

## Acceptance Criteria
- [x] `extractSectionsFromRawPdfText()` extracts discrete `Definitions — [Term]` sections across Home, Motor, Travel, and Life PDS text without swallowing subsequent sections.
- [x] Unit tests pass via `npm test tests/ingest/pds-normalizer.test.ts`.
