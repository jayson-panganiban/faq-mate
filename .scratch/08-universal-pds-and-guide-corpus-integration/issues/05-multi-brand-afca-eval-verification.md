# Issue 05: Multi-Brand & Multi-Line AFCA Evaluation Matrix & Specialist Tone Gate

Status: resolved
Type: task

## Description
Expand the AFCA regulatory test suite to verify definition, coverage, and exclusion answers across multiple brands and product lines (Home, Motor, Travel, Life), asserting specialist precision and zero false-positive Silent PDS refusals.
- In `tests/evals/afca-compliance.test.ts`, ensure evaluation scenarios cover:
  - *Home:* Flood definition, rainwater run-off, storm surge, and 72-hour embargo scenarios across Suncorp, NRMA, Allianz, and Youi.
  - *Motor:* Unlicensed driver exclusions and agreed vs. market value distinctions.
  - *Travel:* Pre-existing medical condition assessments and trip cancellation boundaries.
  - *Life:* Cooling-off periods and TPD claim definitions.
- Verify that definition queries generate complete, grounded specialist responses with 0 meta-RAG phrases (`"in the provided context"`), 0 false-positive `Silent PDS Notices`, and 100% `STATUTORY_GAW` compliance.
- Run `npm run verify` (`typecheck`, `lint`, `lint:corpus`, `test`, `test:evals`).

## Acceptance Criteria
- [x] AFCA evaluation scenarios pass across multiple brands and product categories.
- [x] Responses on standard covered perils and definitions never contain `"in the provided context"` or false Silent PDS refusals.
- [x] `npm run verify` completes with 0 errors.
