# FAQ-Mate: Australian General Insurance Edge RAG

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg)](https://workers.cloudflare.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Compliance](https://img.shields.io/badge/ASIC-RG%20244%20%7C%20s.949A-green.svg)](GLOSSARY.md)

**FAQ-Mate** is an edge-native Retrieval-Augmented Generation (RAG) system specializing in Australian General Insurance policies (Home, Motor, Travel, Pet, Commercial, and Strata). Designed to execute directly inside Cloudflare Workers V8 isolates, FAQ-Mate delivers deterministic statutory compliance, real-time citation grounding across 39 Australian insurers, and streaming multi-turn conversational answers.

---

## Live Deployment

- **Production Frontend:** [https://faq-mate.pages.dev](https://faq-mate.pages.dev)
- **Edge API Worker:** [https://faq-mate-api.json-panganiban.workers.dev](https://faq-mate-api.json-panganiban.workers.dev)
- **Health Check:** `curl -s https://faq-mate.pages.dev/api/health`

---

## Key Architecture & Features

- **Pure Edge Isolate Architecture:** Zero Node.js runtime dependencies in production (`src/`). Runs entirely on Cloudflare Workers and Cloudflare Pages.
- **Deterministic Statutory Compliance:**
  - **Corporations Act 2001 (Cth) s.949A:** Immutable General Advice Warning (`STATUTORY_GAW`) attached to every policy response.
  - **ASIC RG 244 Safe Harbor:** Personal financial advice boundary gatekeeper intercepts requests attempting personal advice framing (`code: ADVICE_BOUNDARY_VIOLATION`).
  - **General Insurance Code of Practice (COP):** Emergency life-safety interception providing Triple Zero (`000`), SES (`132 500`), and Disaster Welfare (`1800 018 444`).
  - **Privacy Act 1988 (Cth) / APP 3 & 11:** Edge and client-side PII redactor (Driver Licences, TFNs, Medicare, Credit Cards) with rotating daily salt k-anonymity.
- **Hybrid Retrieval:** Cloudflare AI Search (BM25 + BGE Large Vector + Reranking) backed by Cloudflare R2 (`faq-mate-corpus`), with in-isolate local AST hybrid search fallback (`src/rag/corpus-data.ts`).
- **Streaming Workers AI:** Streaming inference via Llama 4 Scout 17B MoE (`@cf/meta/llama-4-scout-17b-16e-instruct`) with automated failover to Llama 3.1 8B.
- **OWASP Edge Security:** Dynamic CORS origin validation, strict security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy), and configurable Turnstile bot verification.

---

## Cloning & Local Development

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **npm:** v9.0.0 or higher
- *(Optional)* Cloudflare account for testing live remote Workers AI models.

### 2. Clone & Install
```bash
git clone https://github.com/jayson-panganiban/faq-mate.git
cd faq-mate
npm install
```

### 3. Verify Offline Test Suite & Evals
The test suite and AFCA regulatory evaluation benchmarks run **100% offline** without needing a Cloudflare account or network connection:
```bash
npm run verify
```
This executes:
- TypeScript typecheck (`tsc --noEmit`)
- Biome linter & formatting check (`biome check`)
- Corpus AST integrity linter (`scripts/compile-corpus.ts --lint-only`)
- Unit & integration tests (24 test suites / 272 tests)
- AFCA benchmark evals (20 mandatory scenarios + Groundedness Gate)

---

## Running the Development Server

To run the full stack locally:

### Terminal 1: Edge Worker API
```bash
npm run dev
```
Starts `wrangler dev` on `http://localhost:8787`.
> **Note on Workers AI & Cloudflare Login:**
> - In local mode, Wrangler emulates D1, R2, and KV in SQLite (`.wrangler/state/v3/`).
> - To test live Workers AI inference, log in with `npx wrangler login`.
> - If unauthenticated or offline, the Worker's built-in fallback engine automatically serves grounded responses and local hybrid search without throwing errors.

*(Optional)* To initialize the local telemetry table in Miniflare:
```bash
npx wrangler d1 migrations apply DB --local
```

### Terminal 2: React 19 Frontend
```bash
npm run dev:frontend
```
Starts the Vite dev server at `http://localhost:3000`. The frontend automatically proxies `/api` calls to `http://localhost:8787`.

---

## Deploying to Your Own Cloudflare Account

If you fork or deploy this project to your own Cloudflare account:

1. **Log in to Cloudflare:**
   ```bash
   npx wrangler login
   ```
2. **Create Cloudflare Resources:**
   ```bash
   # 1. D1 Database
   npx wrangler d1 create faq-mate-telemetry
   # 2. KV Namespace
   npx wrangler kv namespace create CONFIG_KV
   # 3. R2 Bucket
   npx wrangler r2 bucket create faq-mate-corpus
   # 4. Apply Database Migrations
   npx wrangler d1 migrations apply DB --remote
   ```
3. **Update `wrangler.jsonc`:**
   Replace the `database_id` and KV `id` with your newly generated resource IDs.
4. **Deploy Edge API Worker:**
   ```bash
   npm run deploy
   ```
5. **Deploy Frontend to Cloudflare Pages:**
   Update `public/_redirects` to point `/api/*` to your worker's `.workers.dev` URL, then deploy:
   ```bash
   npm run build:pages
   npx wrangler pages deploy dist --project-name=faq-mate
   ```

---

## Project Structure

```text
├── data/
│   ├── raw/                 # Curated raw policy manifests & FAQ/guide seeds
│   └── corpus/              # Normalized Markdown corpus (offloaded to R2 bucket)
├── migrations/              # D1 SQL schemas (rag_telemetry_audit)
├── public/                  # Static assets, Pages _redirects, and _headers
├── scripts/
│   ├── normalize-corpus.ts  # Normalizes raw policies to GFM Markdown with breadcrumbs
│   ├── compile-corpus.ts    # Compiles static edge fallback bundle (src/rag/corpus-data.ts)
│   └── upload-to-r2.ts      # Multi-threaded R2 corpus synchronization
├── src/
│   ├── constants/           # Insurer registries (39 insurers) & statutory legal notices
│   ├── frontend/            # React 19 UI, streaming hooks, citation drawer & comparison matrix
│   ├── guardrails/          # ASIC RG 244 gatekeeper & APP 3/11 PII scrubber
│   ├── rag/                 # Hybrid search, prompt synthesizer & static corpus bundle
│   ├── telemetry/           # Non-blocking D1 telemetry auditor
│   ├── types/               # TypeScript bindings & Zod chat schemas
│   └── index.ts             # Cloudflare Worker entrypoint & SSE streaming pipeline
└── tests/                   # Vitest unit, integration, and AFCA regulatory benchmarks
```

---

## License

Apache-2.0
