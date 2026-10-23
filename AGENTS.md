# FAQ-Mate Agent Guide

Australian General Insurance FAQ Edge RAG system running on Cloudflare Workers, Workers AI (Llama 3.3 70B), AI Search, R2, and D1.

## Context Pointers
- **Roadmap & Phase Tracker:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Living Specifications:** [`docs/specs/`](docs/specs/) (01 Ingestion, 02 Edge Runtime, 03 Regulatory, 04 AFCA Evals)
- **Domain Invariants & Legal Terms:** [`GLOSSARY.md`](GLOSSARY.md)
- **System Architecture & PRD:** [`docs/PRD.md`](docs/PRD.md)
- **Coding Standards & Review Rules:** [`CODING_STANDARDS.md`](CODING_STANDARDS.md)

## Development Verification
- Typecheck: `npm run typecheck`
- Test suite: `npm test`
- Regulatory evals: `npm run test:evals`
- Normalize PDS: `npm run normalize`
- R2 upload audit: `npm run upload:r2`
