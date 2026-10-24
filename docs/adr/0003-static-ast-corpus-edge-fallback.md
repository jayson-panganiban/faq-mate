# ADR-0003: Compiled Static AST Corpus as In-Isolate Retrieval Fallback

## Status
Accepted (2026-10-24)

## Context
[ADR-0001](0001-cloudflare-ai-search-hybrid-retrieval.md) made Cloudflare AI Search the primary retrieval primitive. In practice, three situations leave the Worker without a working `env.AI_SEARCH` binding:

1. **Local development & CI:** `wrangler dev`, Vitest, and the AFCA eval suite run without a provisioned AI Search index.
2. **Provisioning lag:** After `npm run upload:r2`, AI Search reindexing is asynchronous; newly normalized documents are briefly unsearchable.
3. **Runtime faults:** An AI Search outage or thrown error would otherwise leave the RAG path with zero context, pushing the LLM toward ungrounded answers. That is a direct AFCA misleading-conduct risk.

The Worker runtime cannot read the corpus from disk (`AGENTS.md` Rule 1 forbids `node:fs` in `src/`), and reading R2 per request adds latency and still needs a retrieval algorithm.

## Decision
We compile the normalized corpus into a **static TypeScript module** that ships inside the Worker bundle and serves as the retrieval fallback:

1. **Generation:** `npm run compile:corpus` (`scripts/compile-corpus.ts`) runs `lintCorpusBatch()` on `data/corpus/`, then `compileMarkdownToChunks()` and `compileCorpusToTypeScript()` (`src/ingest/corpus-compiler.ts`) to emit `src/rag/corpus-data.ts` (`STATIC_CORPUS_CHUNKS: IndexedChunk[]`).
2. **Chunking rules:** Heading-only sections are folded, never emitted. GFM tables stay atomic. Each chunk carries pre-extracted `keywords` and a `source` block (`insurer`, `product`, `docType`, `section`, `effectiveDate`).
3. **Budget:** Chunks are value-scored and capped (currently **480 chunks / ~1.0 MB** across all 39 insurers, guaranteeing AFCA-10 benchmark coverage) so the bundle stays well within Workers limits.
4. **Runtime:** `retrievePolicyChunks()` in `src/index.ts` calls `env.AI_SEARCH.search()` when bound. If the binding is absent or the call throws, it calls `localHybridSearch()` (`src/rag/local-retriever.ts`), which scores `STATIC_CORPUS_CHUNKS` in-isolate and applies the same `insurer` filter (resolved via `resolveInsurer()`).
5. **Ownership:** `src/rag/corpus-data.ts` is generated code. Manual edits are prohibited; it is regenerated whenever `data/corpus/` changes.

## Consequences
### Positive
* Retrieval always returns grounded context, even with AI Search unbound or failing.
* CI and the AFCA eval suite run deterministically against the real normalized corpus with no network dependency.
* The lint → compile step creates a hard gate: malformed corpus files cannot reach the edge bundle.

### Negative / Trade-Offs
* The fallback is lexical keyword scoring only: no dense vectors, no reranker. Recall on paraphrased queries is lower than AI Search.
* The static index covers a **budgeted subset** (480 chunks), not all 331 documents in full. Long-tail clauses are only reachable through AI Search.
* Bundle size grows with the corpus; the budget must be re-checked whenever the roster or edition policy changes (bundle-size CI check is a known gap; see [Spec 06](../../.scratch/06-corpus-refinement-and-compilation/spec.md#9-known-gaps)).
* Two retrieval paths can rank differently for the same query, so AFCA evals pin behaviour to the local path.
