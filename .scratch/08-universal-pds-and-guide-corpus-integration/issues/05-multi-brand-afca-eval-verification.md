# Issue 05: Multi-Brand & Multi-Line AFCA Evaluation Matrix & Verification Gate

Status: ready-for-agent
Type: task

## Description
Expand the AFCA regulatory test suite to verify definition, coverage, and exclusion answers across multiple brands and product lines (Home, Motor, Travel, Life).
- In `tests/evals/afca-compliance.test.ts`, ensure evaluation scenarios cover:
  - *Home:* Flood definition and 72-hour embargo scenarios across Suncorp, NRMA, Allianz, and Youi.
  - *Motor:* Unlicensed driver exclusions and agreed vs. market value distinctions.
  - *Travel:* Pre-existing medical condition assessments and trip cancellation boundaries.
  - *Life:* Cooling-off periods and TPD claim definitions.
- Verify that definition queries generate complete, grounded responses with 0 Silent PDS refusals and 100% `STATUTORY_GAW` compliance.
- Run `npm run verify` (`typecheck`, `lint`, `lint:corpus`, `test`, `test:evals`).

## Acceptance Criteria
- [ ] AFCA evaluation scenarios pass across multiple brands and product categories.
- [ ] `npm run verify` completes with 0 errors.
