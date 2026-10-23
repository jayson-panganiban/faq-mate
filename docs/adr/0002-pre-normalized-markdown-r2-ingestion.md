# ADR-0002: Pre-Normalized Markdown R2 Ingestion Pattern

## Status
Accepted (2026-10-23)

## Context
Australian General Insurance Product Disclosure Statements (PDS) are dense legal documents (typically 80–140 pages) featuring multi-column layouts, nested sub-limits tables, and critical negative conditions (*"What is not covered"*).

If raw multi-column PDF files are uploaded directly to a managed RAG service (like Cloudflare AI Search):
1. **Exclusion Disassociation:** A fixed-token chunker (e.g., 500-token blocks) will inevitably split an operative coverage clause from its statutory carve-outs and exclusions (e.g., placing the Flood coverage on one chunk and the 72-hour bushfire/flood embargo on the next).
2. **Table Flattening:** Tables detailing excess amounts, sub-limits, and optional covers collapse into unparseable raw character strings.
3. **AFCA Liability:** A user asking "Am I covered for flood?" might match only the coverage chunk without the exclusion caveat, causing the LLM to output a hallucinated confirmation of cover.

## Decision
We mandate an out-of-band **Pre-Normalization Ingestion Pipeline** that parses insurer PDFs into clean, structured Markdown files *before* they are uploaded to the Cloudflare R2 bucket connected to Cloudflare AI Search.

The normalization pipeline must enforce:
1. **Hierarchical Header Injection:** Every sub-section and clause must have parent context prepended:
   `# Insurer > ## Product > ### Section > #### Clause Type (Cover vs Exclusion)`
2. **Explicit Table Serialization:** Limits and excess tables must be serialized into GitHub-flavored Markdown tables.
3. **Atomic Clause Units:** Base coverages and their specific exclusions must remain unified in the same Markdown document section so they are indexed together.

## Consequences
### Positive
* Prevents the disassociation of policy exclusions from base coverage terms.
* Preserves structured tabular data (sub-limits, excess schedules).
* Maintains a clean, auditable Markdown corpus in Cloudflare R2 that can be version-controlled and inspected directly.

### Negative / Trade-Offs
* Requires maintaining a dedicated parsing/normalization step instead of directly dumping raw PDFs into Cloudflare.
* Extra build/sync step when new PDS/SPDS revisions are published.
