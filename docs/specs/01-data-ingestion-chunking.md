# Specification: Data Ingestion & Normalization Pipeline

**Module:** `packages/ingest`  
**Status:** Living Specification  
**Version:** 1.0.0  
**Associated ADR:** [ADR-0002](file:///Users/jaysoncp/Developer/faq-mate/docs/adr/0002-pre-normalized-markdown-r2-ingestion.md)  

---

## 1. Responsibilities & Seams
The Ingestion Module is responsible for parsing public Australian General Insurance documents (PDS, TMD, SPDS), converting them to structured semantic Markdown, injecting hierarchical metadata headers, and publishing the normalized corpus to the Cloudflare R2 bucket.

### Seams
* **Input:** Raw public PDF files or public disclosure URLs.
* **Output:** Normalized Markdown documents committed to Cloudflare R2 (`faq-mate-corpus` bucket) triggering automatic indexing by Cloudflare AI Search.

---

## 2. Ingestion Rules & Standards

### 2.1 File Naming & Path Convention
Normalized documents must be stored in R2 using the following structured path key:
`corpus/{insurer_code}/{product_slug}/{document_type}_{version_or_effective_date}.md`

*Example:* `corpus/suncorp/home-contents-classic/PDS_2024-01-15.md`

### 2.2 Hierarchical Header Injection Schema
Every operative policy section in the Markdown file must begin with a structured frontmatter/header block:

```markdown
<!-- BREADCRUMB
insurer: Suncorp
product: Home & Contents Classic
doc_type: PDS
effective_date: 2024-01-15
section: Insured Events
sub_section: Flood
-->
# Suncorp Home & Contents Classic (PDS 2024-01-15)
## Section: Insured Events
### Insured Event 7: Flood
#### Status: Standard Cover (Subject to Exclusions & 72-Hour Embargo)
```

### 2.3 Table Serialization Standard
All tables in the PDS must be extracted into standard Markdown tables. No flattened unstructured text is permitted:

```markdown
| Item Category | Standard Sub-Limit | Optional Increase Available? |
| :--- | :--- | :--- |
| Jewelry & Watches | $2,500 total ($1,000 per item) | Yes, specified on certificate |
| Works of Art & Curios | $5,000 total | Yes, with valuation certificate |
| Cash, Cheques, Gift Cards | $500 total | No |
```

### 2.4 Preservation of Domain Exclusions
The parser must never decouple the following paired clauses:
1. **Flood Definitions:** Statutory definition must be immediately followed by the specific list of what is excluded (storm surge, ocean waves, seepage).
2. **Embargo Clauses:** 48-hour or 72-hour exclusion windows must be co-located with the peril definition (Bushfire, Flood, Named Cyclone).
3. **Theft & Malicious Damage:** Must explicitly state whether "forcible and violent entry" is required for cover.
