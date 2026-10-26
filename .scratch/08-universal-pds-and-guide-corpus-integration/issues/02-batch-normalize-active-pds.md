# Issue 02: Multi-Line Batch Normalization of 391 Active PDS Documents across 39 Insurers

Status: resolved
Type: task

## Description
Run the updated PDS normalizer across all 391 active PDS PDFs in `all_manifest.csv` into `data/corpus/pds/`, spanning all product lines (Home, Comprehensive Motor, Travel, Term Life & TPD, Commercial, and Specialty lines).
- Replace placeholder metadata stubs (`"This policy is governed by terms and conditions..."`) with actual parsed sections (Definitions, Insured Events, Exclusions, Sub-limits).
- Deprecate hand-crafted stubs in `src/ingest/benchmark-policies.ts` so Suncorp, NRMA, Allianz, QBE, Youi, and all remaining 34 insurers are processed uniformly.
- Verify that `npm run lint:corpus` passes across all generated files.

## Acceptance Criteria
- [x] 391 active PDS documents normalized into `data/corpus/pds/` with real clauses across Home, Motor, Travel, Life, and Commercial lines.
- [x] `npm run lint:corpus` passes with 0 violations across all PDS, FAQ, and Guide markdown files.
