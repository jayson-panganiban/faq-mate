# Specification: Phase 6 — Cloudflare Pages Frontend Chat Interface

**Module:** `packages/ui` / `src/frontend` (Cloudflare Pages)  
**Status:** Living Specification  
**Version:** 1.0.0  
**Associated Specs:** [Spec 02 (Edge Runtime)](02-edge-rag-runtime.md), [Spec 03 (Regulatory Compliance)](03-regulatory-compliance.md), [Spec 04 (AFCA Evals)](04-afca-eval-benchmarks.md)  
**Associated ADRs:** [ADR-0001](../adr/0001-cloudflare-ai-search-hybrid-retrieval.md), [ADR-0002](../adr/0002-pre-normalized-markdown-r2-ingestion.md)  

---

## Problem Statement

Australian retail insurance consumers and brokers navigating dense Product Disclosure Statements (PDS) often face impenetrable policy wording (80–140 pages), split across complex sub-limit schedules and statutory definitions. 

Currently, our Edge RAG backend (`POST /api/chat`) provides high-fidelity, grounded streaming answers with strict ASIC RG 244 advice boundaries and sub-40ms retrieval. However, users currently have no visual interface to:
1. Stream answers token-by-token with sub-350ms Time-to-First-Token (TTFT).
2. Inspect and verify the exact PDS clauses, sub-limits tables, and insurer metadata from which answers were synthesized.
3. Observe real-time edge performance metrics (retrieval latency, TTFT, and Cloudflare Anycast PoP location e.g., `SYD`, `MEL`).
4. Experience clear, unmissable regulatory boundaries: persistent statutory Section 949A General Advice Warnings (GAW), deterministic advice refusal guidance, and urgent life-safety emergency hotline banners.

---

## Solution

Deploy a high-density, low-latency single-page chat application on **Cloudflare Pages** (built with React 19, Vite, and Tailwind CSS).

The client consumes the Edge Worker's Server-Sent Events (`text/event-stream`) protocol, rendering:
- **Streaming Markdown Canvas**: Incremental token rendering with code syntax highlighting, tabular sub-limits display, and inline clickable citation pills (`[Source: Suncorp Classic Home PDS, Section 7]`).
- **Citation Drawer & Grounding Inspector**: An interactive slide-over drawer displaying retrieved chunks, similarity confidence scores, operative PDS section breadcrumbs, and raw source markdown.
- **Edge Performance & Telemetry Header**: Live pills indicating edge retrieval latency (`hybrid_retrieval_latency_ms`), TTFT badge, and current Cloudflare edge data center (`SYD`, `MEL`, `BNE`, `PER`).
- **Regulatory Safe Harbor & Emergency UI**: Non-dismissible Section 949A General Advice Warning banner, deterministic advice refusal cards with safe-harbor explanations, and high-visibility red emergency banners with one-touch dial buttons for Triple Zero (`000`), SES (`132 500`), and Disaster Welfare (`1800 018 444`).
- **Abuse & Rate-Limit Shield**: Cloudflare Turnstile bot protection widget and live rate-limit counter derived from `X-RateLimit-*` response headers.

---

## User Stories

1. As an insurance consumer, I want to type a natural language question about policy coverage (e.g., *"What is Suncorp's flood definition?"*), so that I can understand complex legal terms without reading a 120-page document.
2. As an insurance consumer, I want to filter my query by a specific insurer (NRMA, Suncorp, Allianz, QBE, Youi), so that the answer is grounded exclusively in the relevant Product Disclosure Statement.
3. As a user, I want the response to begin streaming within 350ms of hitting Enter, so that the interaction feels instantaneous and responsive.
4. As a retail policyholder, I want to click on inline citation pills (e.g. `[Suncorp Classic Home PDS, Section 1]`), so that a citation drawer opens showing the exact operative policy clause retrieved from R2.
5. As a compliance auditor, I want to view the retrieval relevance score and chunk ID for every citation in the drawer, so that I can audit why the passage was selected by Cloudflare AI Search.
6. As a policyholder, I want markdown tables in the PDS (such as jewelry sub-limits or excess tiers) to render cleanly as formatted HTML tables, so that monetary figures are readable and unambiguous.
7. As a retail consumer asking for personal advice (e.g., *"I have $500/month, which car insurance should I buy?"*), I want the system to clearly inform me that it cannot provide personal advice, so that I understand the statutory boundary under ASIC RG 244.
8. As a consumer experiencing an emergency (e.g., *"My house is on fire right now"*), I want the chat to immediately freeze policy generation and display prominent red emergency hotline buttons (000, 132 500), so that I get immediate life-safety assistance.
9. As a mobile phone user in a disaster area, I want one-tap `tel:000` and `tel:132500` call links, so that I can dial emergency services directly from the emergency banner.
10. As a financial services compliance officer, I want the Section 949A General Advice Warning to persistently appear in the application footer and at the bottom of every generated answer, so that statutory compliance is maintained across every user view.
11. As a technical evaluator, I want to see an Anycast PoP badge (e.g., `SYD` or `MEL`), retrieval latency (ms), and TTFT (ms), so that I can verify zero-origin edge compute performance.
12. As a user, I want to see how many requests I have remaining in my current rate-limit window (10 req/min), so that I understand why requests are throttled if I submit queries too quickly.
13. As a privacy-conscious user, I want client-side PII indicators to assure me that Tax File Numbers, Medicare numbers, and credit cards are scrubbed before storage, so that I feel secure entering claims questions.
14. As a user on a mobile device, I want the chat input and citation drawer to adapt seamlessly to viewport widths down to 360px with touch-friendly tap targets, so that I can inspect policy terms on my phone.
15. As a broker comparing policies, I want to toggle between multiple insurer answers side-by-side or inspect different section disclosures, so that I can compare coverage limits.
16. As a user entering an ungrounded or silent peril (e.g., pet chimpanzee damage), I want the UI to clearly present a negative constraint banner stating the PDS is silent, so that I am not misled into believing cover exists.
17. As an operator, I want Cloudflare Turnstile embedded invisibly or minimally on first submission, so that automated scrapers cannot exhaust edge inference tokens.

---

## Implementation Decisions

### 1. Architecture & Seam Placement
- **Frontend Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React icons.
- **Single Core Testing Seam:** A dedicated custom hook `useChatStream` concealing SSE parsing, rate-limit header tracking, and citation state. Testing the entire interface requires only mocking the `fetch` response with a synthetic `ReadableStream` emitting `event: metadata`, `event: token`, `event: done`, and `event: error`.
- **Runtime Environment:** Deployed on Cloudflare Pages, routing API requests to `/api/chat` via Pages Functions or native Worker proxy.

### 2. State & Streaming Protocol
- **SSE Stream State Machine:**
  - `IDLE`: Input active, rate-limit pills ready.
  - `CONNECTING`: Turnstile validated, `POST /api/chat` dispatched.
  - `METADATA_RECEIVED`: Chunks stored in citation store, TTFT timer captured.
  - `STREAMING`: Accumulating incoming tokens into message markdown.
  - `COMPLETED`: Done event received, final token count and total latency recorded.
  - `REFUSAL_BLOCKED`: Error event received with `ADVICE_BOUNDARY_VIOLATION` or `EMERGENCY_INTERCEPTION`.
  - `THROTTLED`: HTTP 429 received, countdown timer active until `X-RateLimit-Reset`.

### 3. Component Hierarchy
- `AppShell`: Persistent top navigation (PoP indicator, latency meter) and statutory Section 949A GAW footer.
- `ChatContainer`: Message list with auto-scroll and stream anchoring.
  - `UserMessage`: Sanitized user query bubble with insurer filter badge.
  - `AssistantMessage`: Markdown parser, tabular sub-limit renderer, inline citation chips, and copy action.
  - `RefusalCard`: ASIC safe-harbor explanation card for personal advice rejections.
  - `EmergencyBanner`: High-contrast red emergency interception card with call action buttons.
- `CitationDrawer`: Slide-over sheet showing chunk details, full source excerpt, document breadcrumbs, and relevance score.
- `InputBar`: Query textarea (auto-resizing), insurer selector dropdown (Allianz, Suncorp, NRMA, QBE, Youi), Turnstile widget, and submit button.

---

## Testing Decisions

### What Makes a Good Test
- **External Behavior Over Implementation Details:** Tests must verify what the user sees (rendered markdown, open drawer, emergency banners, active countdown timer) when specific SSE event sequences are received, rather than testing React internal state or hook internals.
- **Seam:** The `fetch` API response returning `text/event-stream`.

### Modules to Test
1. `useChatStream` hook: Verified with synthetic SSE event streams (`metadata`, `token`, `done`, `error`).
2. `CitationDrawer`: Verified opening on citation pill click and displaying matching chunk content.
3. `RefusalCard` & `EmergencyBanner`: Verified rendering upon receiving `ADVICE_BOUNDARY_VIOLATION` and `EMERGENCY_INTERCEPTION` codes.
4. `RateLimitBadge`: Verified updating from `X-RateLimit-*` headers and disabling submit when remaining reaches 0.

---

## Out of Scope

- User authentication / account management (system is public, anonymous, and unauthenticated).
- Persisting chat history to an external database (chat history is retained in browser `sessionStorage` only).
- Direct policy binding, quoting, or premium transactions (system is strictly general factual information).
- Multi-lingual audio transcription or speech-to-text.

---

## Further Notes

- **Compliance Rule:** The General Advice Warning in the application footer must use the canonical text from `GLOSSARY.md § 2` without any alteration.
- **Portability:** The Pages build must output static assets into `dist/` deployable via `wrangler pages deploy dist`.
