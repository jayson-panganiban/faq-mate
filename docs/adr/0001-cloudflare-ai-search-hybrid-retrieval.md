# ADR-0001: Adopt Cloudflare AI Search for Hybrid Retrieval

## Status
Accepted (2026-10-23)

## Context
The system requires an edge-deployed search mechanism to retrieve relevant passages from Australian General Insurance Product Disclosure Statements (PDS) and Target Market Determinations (TMD).

Insurance disclosure documents present unique information-retrieval challenges:
1. Queries frequently reference exact statutory phrasing (*"Prescribed Flood Definition"*, *"72-hour embargo"*), section codes (*"Insured Event 4"*), or numerical monetary caps (*"$2,500 jewelry sub-limit"*).
2. Pure dense vector embeddings (e.g., Cosine similarity over 1024-dimension float arrays in Cloudflare Vectorize) frequently suffer from semantic dilution, missing exact keyword constraints or numerical thresholds.
3. Building a custom BM25 index inside Cloudflare D1/SQLite introduces high maintenance overhead, synchronization lag, and extra database roundtrips.

## Decision
We adopt **Cloudflare AI Search** (the evolution of AutoRAG) as the authoritative edge retrieval primitive, connecting it directly to our Cloudflare R2 corpus bucket.

Cloudflare AI Search provides:
* Managed **Hybrid Retrieval** combining BM25 lexical keyword matching with `@cf/baai/bge-large-en-v1.5` dense vector embeddings.
* Built-in **Cross-Encoder Reranking** to score and re-order the top retrieved chunks before returning them to the Worker.
* Native Worker bindings (`env.AI_SEARCH.search()`), drastically simplifying Worker logic.
* A zero-cost operational profile under Cloudflare's free tier (5,000,000 ingestion tokens and 1,000 semantic queries per month).

## Consequences
### Positive
* Solves the lexical failure mode of pure vector search for statutory insurance terms.
* Eliminates custom embedding generation workers, Vectorize upsert scripts, and manual vector chunking loops.
* Keeps retrieval latency under 40ms directly at the Anycast edge.

### Negative / Trade-Offs
* Standard AI Search ingestion uses naive token-based chunking by default, which risks severing exclusions from base covers.
* *Mitigation:* We mandate ADR-0002 (Pre-Normalized Markdown Ingestion into R2) to control chunk boundaries before AI Search indexes them.
