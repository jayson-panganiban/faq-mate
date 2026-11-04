# Specification: Live Retrieval & Answer Quality Evaluation Harness

**Module:** `scripts/evals` / `src/rag` / `src/ingest` / edge Worker metadata contract  
**Status:** Specified  
**Label:** `ready-for-agent`  
**Associated ADRs:** [ADR-0001 (Cloudflare AI Search Hybrid Retrieval)](../../docs/adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002 (Pre-Normalized Markdown in R2)](../../docs/adr/0002-pre-normalized-markdown-r2-ingestion.md), [ADR-0003 (Static AST Corpus Edge Fallback)](../../docs/adr/0003-static-ast-corpus-edge-fallback.md), [ADR-0004 (Canonical Insurer Registry)](../../docs/adr/0004-canonical-insurer-registry-alias-resolution.md)  
**Associated Specs:** [Spec 02 (Edge Runtime)](../02-edge-rag-runtime/spec.md), [Spec 04 (AFCA Evals)](../04-afca-eval-benchmarks/spec.md), [Spec 06 (Corpus & AST Compiler)](../06-corpus-refinement-and-compilation/spec.md), [Spec 07 (Conversational NL)](../07-conversational-natural-language-inquiries/spec.md), [Spec 08 (Universal PDS & Guides)](../08-universal-pds-and-guide-corpus-integration/spec.md)

---

## Problem Statement

As the maintainer of FAQ-Mate, I cannot tell whether a change makes retrieval or answers better or worse.

- **The AFCA eval suite never exercises the real model.** It runs the Worker against a mocked `Env`, so the deterministic and canned fallback paths are scored, not Llama 4 Scout output or AI Search results.
- **The Groundedness / Faithfulness Score is not a measurement.** The deterministic judge starts at `1.0` and only lowers the score for a handful of hard-coded trap phrases (e.g. "high tide", "chimpanzee"). The model-assisted judge exists but is never invoked on live output. D1 telemetry records a constant `groundednessScore = 1.0` (Spec 04 gap G4).
- **Retrieval quality is unmeasured.** There is no recall@k, MRR, or nDCG for AI Search or the static AST fallback, and no measure of cross-insurer leakage beyond unit-level heuristics.
- **Grounded answers can still be unfaithful to the real PDS.** When PDF extraction fails, the Stage 2 normalizer injects generic product-line baseline sections (e.g. a Home `Definitions — Flood` block with 72-hour embargo exclusions) attributed to a specific insurer's PDS. 26 of 430 compiled chunks are this Flood template, including one attributed to *AIA Home Loan Protection*, a life product that matched the `home` regex. A model that is perfectly grounded in that chunk still misstates the insurer's contract.
- **Planned improvements cannot be justified.** Reranking, metadata filtering (G11), query rewriting, and claim-level verification have no baseline to improve against.

## Solution

A live quality harness that sends a reviewed golden dataset through the public `/api/chat` SSE contract of a locally running Worker bound to the real Workers AI and AI Search resources, and scores:

1. **Retrieval quality** from the `event: metadata` `retrieved_chunks` payload (recall@k, MRR, nDCG@k, cross-insurer leakage, synthesized-baseline exposure), per retrieval backend.
2. **Answer quality** from the assembled `event: token` stream (claim-level faithfulness, citation accuracy, refusal precision and recall, Silent PDS Notice correctness, statutory invariants).
3. **Source fidelity**: the share of retrieved and cited content that comes from extracted PDS/FAQ/GUIDE text rather than synthesized baseline templates.

Each run writes a machine-readable report and a Markdown summary. A committed baseline lets a nightly job fail on regression without blocking `npm run verify`.

## User Stories

### Maintainer: measurement

1. As a maintainer, I want one command that runs the full golden dataset against a live Worker, so that I can measure quality on demand.
2. As a maintainer, I want retrieval metrics (recall@1/3/5, MRR, nDCG@5), so that I can compare retrieval changes objectively.
3. As a maintainer, I want retrieval metrics broken down by retrieval backend (`ai_search`, `local`, `auto`), so that I know whether the static AST fallback is a credible substitute for AI Search.
4. As a maintainer, I want metrics sliced by insurer category, product line, doc type, and case tag (colloquial, multi-turn, definition, silent-PDS, cross-insurer trap), so that I can find weak segments rather than staring at one average.
5. As a maintainer, I want a cross-insurer leakage rate (retrieved or cited chunks from a different insurer than the one asked about), so that brand-scoped answers can be trusted.
6. As a maintainer, I want claim-level faithfulness (supported claims ÷ total claims), so that groundedness reflects what the model actually wrote.
7. As a maintainer, I want citation accuracy (citations that point at a retrieved chunk that supports the cited claim), so that citations are not decorative.
8. As a maintainer, I want refusal precision and recall for `ADVICE_BOUNDARY_VIOLATION` and `EMERGENCY_INTERCEPTION`, so that I can see both over-refusal and missed refusals.
9. As a maintainer, I want Silent PDS Notice correctness (the answer says the PDS is silent when the gold label says the corpus has no answer), so that the system does not invent cover.
10. As a maintainer, I want a source fidelity score, so that I can see how often answers rest on synthesized baseline templates instead of extracted text.
11. As a maintainer, I want per-case latency (retrieval latency from metadata, time to first token, total), so that quality gains are not bought with unacceptable latency.
12. As a maintainer, I want an answer-relevance check against a reference answer for FAQ-mined cases, so that a faithful-but-unhelpful answer is visible.

### Maintainer: workflow

13. As a maintainer, I want to run a filtered subset by tag, insurer, or case ID, so that I can iterate quickly on one weakness.
14. As a maintainer, I want to choose the retrieval mode for a run, so that I can compare backends through the same seam.
15. As a maintainer, I want a committed baseline report, so that regressions are detected relative to known performance.
16. As a maintainer, I want an explicit command to promote a run to the new baseline, so that improvements are locked in deliberately.
17. As a maintainer, I want a Markdown summary listing the worst-scoring cases with retrieved sources and judge rationale, so that I can debug failures without reading raw JSON.
18. As a maintainer, I want runs to be resumable and rate-aware, so that a transient Workers AI error does not waste a whole run.
19. As a maintainer, I want the harness to record the generator model, judge model, retrieval mode, corpus fingerprint, and git SHA in every report, so that results are reproducible and comparable.
20. As a maintainer, I want the nightly job to fail only on regression or hard-invariant breaches, so that noise does not train me to ignore it.
21. As a maintainer, I want `npm run verify` to stay offline, fast, and free, so that the live harness never blocks ordinary development.

### Dataset curator

22. As a dataset curator, I want a script that mines candidate cases from the raw FAQ archive (question → that insurer's FAQ section + reference answer), so that I start from hundreds of realistic questions.
23. As a dataset curator, I want mined candidates written to a review queue rather than straight into the golden set, so that nothing unreviewed is scored.
24. As a dataset curator, I want to hand-author cases for PDS clauses, colloquial phrasing, multi-turn follow-ups, silent-PDS questions, and cross-insurer traps, so that the set covers what the FAQ archive cannot.
25. As a dataset curator, I want gold labels at document + section granularity, so that labels survive re-chunking and AI Search ID changes.
26. As a dataset curator, I want to mark a case as "no answer in corpus", so that silent-PDS behaviour is testable.
27. As a dataset curator, I want to mark a case as an expected refusal with its code, so that guardrail behaviour sits in the same dataset.
28. As a dataset curator, I want the dataset validated by schema (unknown insurer codes, missing gold labels, duplicate IDs, history over 4 turns), so that malformed cases fail fast.
29. As a dataset curator, I want gold labels that point at synthesized baseline sections to be rejected, so that templates never become ground truth.
30. As a dataset curator, I want coverage reported by insurer category and product line, so that I can see dataset gaps.

### Corpus pipeline

31. As a corpus pipeline maintainer, I want every synthesized baseline section to carry a provenance marker, so that downstream consumers can tell template text from extracted text.
32. As a corpus pipeline maintainer, I want the corpus compiler to carry provenance into compiled chunks, so that the static fallback path reports it.
33. As a corpus pipeline maintainer, I want the corpus linter to report the count of synthesized sections per insurer, so that extraction failures are visible.
34. As a corpus pipeline maintainer, I want the Worker to strip the provenance marker from chunk content before prompting and display, so that users and the model never see it.

### Edge runtime and frontend

35. As a frontend developer, I want new metadata fields to be additive, so that the existing chat UI keeps working unchanged.
36. As an operator, I want a retrieval mode setting defaulting to `auto`, so that production behaviour is unchanged unless explicitly configured.
37. As a regulator-minded reviewer, I want every hard statutory invariant (GAW verbatim, emergency hotlines, advice refusal, zero raw query persistence) checked on live output, so that model drift cannot silently break compliance.

## Implementation Decisions

### Test seam

- **Single seam: the public `/api/chat` SSE contract** (Spec 02). The harness only speaks HTTP + SSE, so it measures exactly what users receive and needs no new exports from the Worker entrypoint.
- Retrieval metrics are computed from `event: metadata` → `retrieved_chunks`. Answer metrics are computed from the concatenated `event: token` payloads. Refusals are read from `event: error` codes.

### Execution target

- The harness targets a **locally running Worker** (`wrangler dev` using remote Workers AI and AI Search bindings), configured through an eval-only vars file: no `TURNSTILE_SECRET_KEY`, a raised `RATE_LIMIT_MAX`, and an explicit `RETRIEVAL_MODE`. This uses the Worker's existing documented configuration and does not bypass production Turnstile or rate limiting.
- The harness never targets the production URL.
- Requests are sent with bounded concurrency and exponential backoff on 429/5xx. Completed case results are checkpointed so an interrupted run can resume.

### Runtime changes (additive only)

- **`RETRIEVAL_MODE` var:** `auto` (default, current behaviour), `local_only` (skip AI Search), `ai_search_only` (no local backfill or fallback). Unknown values fall back to `auto`.
- **Per-chunk metadata fields** on each `retrieved_chunks` entry:
  - `retrievalBackend: "ai_search" | "local"` (camelCase, matching existing chunk fields such as `relevanceScore`)
  - `provenance: "extracted" | "synthesized_baseline"`
- **Stable source identity:** each chunk's `source` gains an optional `sourceKey` — the R2 key for AI Search items, and the same R2 key resolved by the corpus codec for compiled local chunks, so gold matching never depends on chunk IDs. AI Search items without an ID still get a generated ID, but matching ignores it.
- The Worker strips the provenance marker from content before prompt synthesis and before emitting chunk content.
- No change to the SSE event names, the request schema, the `X-RateLimit-*` headers, or the D1 schema.

### Provenance marker

- The Stage 2 normalizer emits an inline `<!-- PROVENANCE: synthesized_baseline -->` comment as the first line of every section produced by the product-line baseline builder. Extracted sections carry no marker (absent = `extracted`).
- The corpus codec parses the marker. The corpus compiler sets `provenance` on compiled chunks. The corpus linter reports synthesized-section counts per insurer (informational, not a lint failure).
- An inline comment is used, rather than R2 custom metadata, so the marker survives AI Search chunking and reaches the runtime in chunk text.
- **Re-sync gate:** regenerating the corpus, running `npm run upload:r2`, and triggering AI Search re-indexing happen in a dedicated ticket and **only after explicit maintainer approval**. Until then, the `local` backend reports provenance accurately and the `ai_search` backend reports `extracted` by default. Reports flag this as "provenance unverified for ai_search".
- Fixing the normalizer so it no longer attributes templates to specific insurers is **out of scope** (see Out of Scope).

### Golden dataset

- Stored as versioned JSONL in the repository (one case per line), validated by a Zod schema shared by the miner, validator, and harness.
- Target size: about 200 FAQ-mined cases plus about 50 hand-authored cases. Every case is reviewed before entering the golden set; mined candidates land in a separate review queue file.
- Case shape (decision-encoding sketch):

  ```ts
  type GoldenCase = {
    id: string;                       // stable, e.g. "faq-aami-0042" | "hand-flood-colloquial-03"
    origin: "faq_mined" | "hand_authored";
    query: string;                    // 2–500 chars (ChatRequestSchema parity)
    history?: { role: "user" | "assistant"; content: string }[]; // ≤ 4
    filters?: { insurer?: string; product?: string; docType?: DocType };
    tags: CaseTag[];                  // colloquial | multi_turn | definition | silent_pds
                                      // | cross_insurer_trap | sub_limit | refusal | emergency
    expect:
      | { kind: "answer"; gold: GoldSource[]; referenceAnswer?: string; mustMention?: string[] }
      | { kind: "silent_pds" }        // corpus has no answer; must not affirm cover
      | { kind: "refusal"; code: "ADVICE_BOUNDARY_VIOLATION" | "EMERGENCY_INTERCEPTION" };
  };
  type GoldSource = {
    insurerCode: string;              // canonical code from the insurer registry
    docType: "PDS" | "SPDS" | "FAQ" | "GUIDE";
    key: string;                      // R2 key per corpus-codec path resolver
    section?: string;                 // heading text; omitted = any section of that document
  };
  ```

- **Matching rule:** a retrieved chunk is a hit for a `GoldSource` when the insurer code, doc type, and key match, and (if specified) the chunk's section heading matches after case and whitespace normalization.
- Gold sources that resolve to synthesized baseline sections are rejected by the validator.
- Insurer codes resolve through the canonical insurer registry, so bancassurance aliases are normalized to issuing underwriters (ADR-0004).

### FAQ miner

- Parses the raw FAQ archive (`## Category` / `### Question` / answer body) for all insurers and emits candidates with the gold source pointing at that insurer's FAQ R2 key and question heading as the section. The answer body becomes `referenceAnswer`.
- Sampling is stratified by insurer category and capped per insurer to avoid domination by large FAQ files. Sampling is deterministic, driven by a seed.
- Filesystem access is confined to `scripts/` (Engineering Rule 1).

### Scoring

- **Deterministic checks run first** and reuse the existing deterministic judge: GAW verbatim presence, citation pattern presence, advice-leak phrasing, emergency hotline presence. Hard-invariant failures are recorded regardless of LLM judge output.
- **Claim-level LLM judge:**
  - Runs on Workers AI with a different model family from the generator (default: Llama 3.3 70B judging Llama 4 Scout), configured by an eval-only variable so it can be changed without code edits.
  - Step 1 splits the answer into atomic factual claims (statutory boilerplate excluded).
  - Step 2 labels each claim `supported | contradicted | unsupported` against the retrieved chunks, with a cited chunk index and a short rationale.
  - Output is strict JSON validated by Zod. Malformed judge output is retried once and then recorded as `judge_error` (excluded from averages, counted separately).
- **Metric definitions:**
  - `recall@k`: fraction of answer cases with at least one gold hit in the top k.
  - `MRR`: mean of 1/rank of the first gold hit (0 if none).
  - `nDCG@5`: binary relevance against gold sources.
  - `cross_insurer_leakage`: fraction of cases with an insurer filter or detected insurer where any top-k chunk belongs to another insurer.
  - `faithfulness`: supported claims ÷ total claims, macro-averaged over cases.
  - `citation_accuracy`: citations whose referenced chunk was retrieved and judged supporting ÷ total citations.
  - `refusal_precision` and `refusal_recall`: per refusal code over the whole dataset.
  - `silent_pds_accuracy`: fraction of `silent_pds` cases where no claim affirms cover.
  - `answer_relevance`: judge score in [0, 1] versus `referenceAnswer` (FAQ-mined cases only).
  - `source_fidelity`: fraction of top-k chunks (and separately, of cited chunks) with `provenance = extracted`.
  - Latency: p50 and p95 of metadata `latency_ms`, time to first token, and total.

### Reports, baseline, and gating

- Each run writes a JSON report (all metrics, slices, per-case records, run fingerprint) and a Markdown summary (headline table, slice tables, 20 worst cases with sources and judge rationale).
- The run fingerprint records the git SHA, generator model, judge model, retrieval mode, dataset hash, corpus fingerprint (hash of compiled corpus data), and timestamp.
- Per-case records store the golden case ID and scores. Golden queries are synthetic or public FAQ text, so storing them in reports is permitted. No reports are written to D1 (Engineering Rule 5 is unaffected).
- A committed baseline report exists per retrieval mode. The promote command copies a run report to the baseline after the maintainer confirms.
- **Regression policy:** a run fails if any headline metric drops by more than 2 absolute points versus the baseline, or if any hard invariant breaks:
  - cross-insurer leakage > 0 on `cross_insurer_trap` cases
  - advice leakage > 0
  - GAW missing on any answer
  - any emergency case not intercepted
- No absolute targets are set until a first baseline exists.

### Commands and CI

- `npm run eval:quality` runs the harness against a local Worker. Flags: `--mode`, `--tag`, `--insurer`, `--case`, `--concurrency`, `--resume`.
- `npm run eval:mine` generates FAQ candidates into the review queue.
- `npm run eval:validate` validates the golden dataset. This one is offline and is added to `npm run verify`.
- `npm run eval:baseline` promotes a report to baseline.
- A separate nightly GitHub Actions workflow starts a local Worker with remote bindings using a repository Cloudflare API token secret, runs `eval:quality` in `auto` and `local_only` modes, uploads reports as artifacts, and fails on regression. It does not run on pull requests.

## Testing Decisions

- **What makes a good test here:** tests assert observable behaviour at module boundaries. Examples: given this SSE stream, these metrics come out; given this case file, these validation errors appear; given this mode, these backends appear in metadata. No assertions on internal helpers or prompt wording.
- **Metric math:** table-driven tests over hand-built retrieval results and gold labels (known recall@k, MRR, nDCG values, including no-hit and multi-gold cases).
- **SSE parsing and scoring pipeline:** a fixture SSE transcript (metadata, tokens, done, and error variants) is fed through the scorer with a stubbed judge returning canned JSON; assert the per-case record and aggregate report.
- **Judge contract:** malformed JSON → one retry → `judge_error`. Schema-valid output maps to claim labels.
- **Dataset schema and validator:** valid fixtures pass. Unknown insurer, duplicate ID, history > 4, missing gold for `answer`, and gold pointing at a synthesized section each fail with a specific message.
- **FAQ miner:** a small fixture FAQ file yields deterministic candidates for a fixed seed with correct gold keys.
- **Provenance:** normalizer output for a forced-baseline manifest entry contains the marker. The codec parses it. The compiler sets `provenance`. The Worker strips the marker from emitted content and prompts.
- **Runtime additions (integration, existing seam):** extend the existing Worker integration tests (the mocked-`Env` `worker.fetch` pattern) to assert that `retrievalBackend` and `provenance` appear on every metadata chunk and that `RETRIEVAL_MODE=local_only` never calls the AI Search binding. Existing SSE and frontend tests must pass unchanged.
- **Regression gate:** baseline comparison tests for metric drops above and below the 2-point threshold and for each hard invariant.
- **Prior art:** the AFCA eval suite (mocked-`Env` Worker fetch), the local retriever tests (retrieval assertions), and the corpus linter and compiler tests.
- **Not tested in CI:** the live harness itself. It is exercised by the nightly workflow and manual runs.

## Out of Scope

- Fixing the normalizer's synthesized baseline sections (stopping template attribution to specific insurers, tightening the product-line regex). This is a follow-up spec informed by the source fidelity numbers.
- Reranking, metadata filter forwarding (G11), query rewriting, and parent/child chunking. These are follow-up specs that this harness will evaluate.
- Runtime groundedness scoring in D1 telemetry (G4) and the streaming post-generation gate (G5).
- Durable rate limiting, server-side Turnstile hardening, and other Phase 8 runtime items.
- Running the harness against production or preview deployments.
- A UI dashboard for eval results. Markdown summaries and CI artifacts suffice for now.
- Changing the generator model or prompt.

## Further Notes

- **Expect the first baseline to look worse than the current "0.98 groundedness" claim.** That is the point. Communicate the change in methodology in the roadmap and README rather than presenting it as a regression.
- **Workers AI cost:** about 250 cases × (1 generation + 2 judge calls) × 2 modes per nightly run. Concurrency defaults should stay well inside Workers AI rate limits, and the summary should report token usage per run.
- **Synthetic-template prevalence** found while writing this spec: 26 of 430 compiled chunks are the Home Flood template, including one attributed to a life product. The source fidelity metric will quantify this across the full R2 corpus once re-sync is approved.
- **Roadmap:** add this as a Phase 8 item.
- **Spec 04:** cross-reference so the "Groundedness / Faithfulness Score" glossary entry points at the claim-level definition here.
