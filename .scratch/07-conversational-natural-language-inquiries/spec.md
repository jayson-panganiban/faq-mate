# Specification: Conversational Natural Language Inquiries, Multi-Turn Context & Edge Intent Expansion

**Module:** Edge RAG Pipeline / Conversational Understanding  
**Status:** Ready for Implementation  
**Label:** `ready-for-agent`  
**Associated ADRs:** ADR-0001 (Cloudflare AI Search Hybrid Retrieval), ADR-0003 (Static AST Edge Fallback), ADR-0004 (Insurer Registry & Brand Resolution)  
**Associated Specs:** Spec 02 (Edge RAG Runtime), Spec 03 (Regulatory Compliance), Spec 04 (AFCA Evals), Spec 05 (Frontend Chat Interface), Spec 06 (Corpus Refinement)  

---

## Problem Statement

Australian retail insurance consumers and policyholders rarely articulate insurance questions using exact statutory clauses or Product Disclosure Statement (PDS) terminology. A consumer does not ask for the *"Insurance Contracts Amendment (Prescribed Flood Definition) Regulations 2012"* or *"Clause 4.1 Escape of Liquid from Fixed Internal Apparatus"*. Instead, consumers submit colloquial, multi-part, and narrative-driven inquiries such as:
- *"A pipe burst in my ensuite while I was on holiday and ruined the floorboards, am I covered?"*
- *"What kinds of water damage are included in basic home insurance?"*
- *"Someone smashed my passenger window parked outside my flat and took my laptop, can I claim for both?"*
- *"My roof is leaking and the repair quote is $3,500 while my excess is $1,000. Should I lodge a claim or just pay out of pocket?"*
- *"Does Suncorp cover spoiled food if the power goes out during a blackout?"*

Currently, our retrieval relies predominantly on single-turn exact lexical matching and BM25 token overlap. When consumers ask conversational, follow-up, or multi-turn questions:
1. **Lexical Retrieval Failure on Colloquial Phrasing:** Colloquial terms (*"ruined"*, *"busted"*, *"outside my flat"*, *"scooter hire"*) fail to score against statutory clauses (*"escape of liquid"*, *"forcible and violent entry"*, *"common property"*, *"motorcycle endorsement"*).
2. **Context Amnesia Across Turns:** Users asking natural follow-up questions (*"What about rainwater run-off?"* or *"Does that 72-hour rule apply if I renewed?"*) receive ungrounded or disjointed responses because the API evaluates queries in isolation without prior conversational turns.
3. **The "Helpful Assistant" Unlicensed Financial Advice Trap (ASIC RG 244):** Conversational LLMs naturally seek to resolve consumer dilemmas by offering direct recommendations (*"You should lodge a claim because you will save $2,500..."*). Under Corporations Act 2001 s.766B, this represents illegal personal financial advice without an AFSL.
4. **Product Line Ambiguity:** Users rarely specify whether they hold Building, Contents, Landlord, or Motor cover. Inquiries like *"Does Suncorp cover food spoilage?"* risk confusing Building and Contents terms.
5. **Latency Budget vs. Query Rewriting:** Multi-step LLM query expansion chains add $300\text{--}500\text{ ms}$ of latency, violating our sub-350ms Time-to-First-Token (TTFT) budget.
6. **Dead-End Explorations:** Broad inquiries (*"What water damage is covered?"*) provide a wall of text without guided, statutory follow-up options for deeper exploration.

---

## Solution

A multi-turn conversational comprehension and deterministic intent expansion layer operating directly at the edge:

1. **Sub-Millisecond Deterministic Intent & Voice Normalization:** A lightweight, rule-driven AST mapper ($< 1\text{ ms}$) that strips voice transcription noise (*"um"*, *"like"*, *"so basically"*) and maps Australian colloquialisms to canonical statutory insurance concepts before retrieval.
2. **Client-Managed Multi-Turn Window with Zero-Persistence Privacy:** The browser manages an ephemeral conversation history (last 2–3 turns) and passes it in the request payload. The edge Worker scrubs PII across all inbound turns under Australian Privacy Principles (APPs 3 & 11) while logging only the daily-salted hash of the active prompt for k-anonymity.
3. **ASIC RG 244 Conversational Decision-Factor Framing:** Prompts and edge gatekeepers explicitly intercept conversational recommendation traps (*"Should I claim or pay myself?"*, *"Which insurer is better for me?"*) and reframe responses to objective decision factors (e.g. comparing basic excess, no-claim bonus impacts, and gradual deterioration carve-outs) with zero personal advice leakage.
4. **Product-Line Disambiguation Engine:** When a conversational inquiry touches ambiguous product boundaries (Building vs. Contents vs. Landlord vs. Motor), the synthesis engine structures answers with explicit product-line demarcations.
5. **Dual-Tier Hybrid Retrieval Activation:** Active Cloudflare AI Search (`env.AI_SEARCH`) integration leveraging dense vector embeddings (`@cf/baai/bge-large-en-v1.5`) and cross-encoder reranking over the 1,268-document R2 tripartite corpus (`292` PDS/SPDS, `39` FAQ, and `937` Curated Guides), backed seamlessly by the local in-isolate AST index.
6. **Dynamic Follow-Up Suggestions:** Each completed response emits 2–3 structured statutory follow-up chips (e.g. `["What is the 72-hour flood embargo?", "How does escape of liquid differ from storm run-off?"]`) in the SSE stream to guide user discovery.

---

## User Stories

1. As a homeowner whose bathroom flooded from a ruptured pipe, I want to ask *"My bathroom flooded from a broken pipe under the sink, will insurance cover this?"* and receive a clear answer distinguishing *"Escape of Liquid"* from statutory *"Flood"*, so that I understand my policy cover despite using non-legal phrasing.
2. As a renter inquiring broadly about storm events, I want to ask *"What counts as water damage?"* and receive a categorized summary comparing Riverine Flood, Storm Run-off, Actions of the Sea, and Escape of Liquid, so that I understand the specific boundaries of water-related perils.
3. As a vehicle owner whose car was vandalized in an apartment driveway, I want to ask *"Someone stole items from my car parked in the driveway, am I covered?"* and learn about forcible and violent entry requirements and common property exclusions, so that I know what documentation or evidence is necessary.
4. As a retail policyholder reviewing renewal documents, I want to ask *"What is the difference between basic excess and unlisted driver excess?"* in plain terms, so that I understand my out-of-pocket liabilities without reading 120 pages of disclosure schedules.
5. As a traveler planning an overseas trip, I want to ask *"Does travel insurance cover me if I crash a rental moped in Thailand?"* and receive factual disclosures regarding international motorcycle engine capacity sub-limits and Australian motorcycle license requirements, so that I avoid uninsurable travel activities.
6. As a consumer asking a broad question across multiple insurers (*"How do Suncorp and Allianz treat storm surge?"*), I want to receive an objective, side-by-side factual comparison of their respective PDS clauses without any recommendation of which is better, so that I can compare policies without receiving unlawful personal advice under ASIC RG 244.
7. As a consumer asking a dilemma question (*"Should I claim for a $3,500 roof leak if my excess is $1,000?"*), I want the assistant to refuse to make the choice for me while objectively outlining the decision factors (excess deduction, no-claim bonus rating impact, and gradual wear exclusions), so that I am empowered to decide without the service violating ASIC RG 244.
8. As a customer asking a conversational follow-up question (*"What if it happened on the second day after buying?"*), I want the system to understand that I am asking about the 72-hour catastrophe embargo without having to repeat the whole context, so that my dialogue feels natural.
9. As a privacy-conscious user, I want multi-turn conversations to be processed without my past queries or personal details being permanently logged in the database, so that my privacy is preserved under APPs 3 & 11.
10. As a customer inquiring about contents items (*"Does Suncorp cover food spoilage during a blackout?"*), I want the assistant to clarify that this is covered under Contents Insurance (Insured Event 11) up to $2,000 but not Home Building, so that I understand product-line distinctions.
11. As a mobile user using speech-to-text dictation (*"Um so like my fence blew down in the wind yesterday what do I do"*), I want the system to clean verbal fillers and retrieve relevant boundary fence storm clauses, so that my voice input works effortlessly.
12. As an emergency-affected customer typing in panic (*"My house is flooding right now water is rising what should I do?"*), I want an immediate high-priority safety interception displaying Triple Zero (000) and SES (132 500) hotlines rather than a delayed legal policy analysis, so that life safety is prioritized in compliance with the General Insurance Code of Practice.
13. As a consumer holding a policy through a supermarket bank (*"What does Coles cover for hail?"*), I want the system to automatically recognize Coles as an alias underwritten by Insurance Australia Limited (CGU/IAG) and retrieve the correct underwriter PDS terms, so that I do not need to know the statutory underwriter structure.
14. As an inquisitive user reading an answer, I want to see 2–3 clickable follow-up chips at the bottom of the response, so that I can easily drill into related statutory exclusions like embargoes and sub-limits.
15. As a policyholder asking about silent perils (*"Does my home policy cover damage caused by my pet cockatoo chew marks?"*), I want an explicit negative constraint answer confirming that unlisted domestic animal hazards are excluded under general exclusions, so that I am not given false expectations of coverage.
16. As a customer asking about high-value personal effects (*"My engagement ring was lost at the beach, how much can I get?"*), I want an immediate explanation of the per-item ($1,000) and total ($2,500) jewelry sub-limits schedules and the requirement for separate certificate listing, so that I understand my claim caps.
17. As a broker or compliance auditor, I want every conversational answer to terminate with the mandatory Corporations Act s.949A General Advice Warning verbatim, so that regulatory compliance is 100% auditable.
18. As an engineer running test suites, I want all conversational query expansion scenarios to execute deterministically against the test contract with $\ge 0.98$ groundedness, so that edge regressions are prevented before deployment.

---

## Implementation Decisions

### 1. Inbound Schema & Multi-Turn Context Contract
The inbound chat schema is updated to support an optional, bounded conversation history array while strictly limiting payload size to prevent edge memory inflation:

```typescript
export const ChatMessageHistorySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});

export const ChatRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  conversationId: z.string().uuid(),
  history: z.array(ChatMessageHistorySchema).max(6).optional(),
  turnstileToken: z.string().optional(),
  filters: z.object({
    insurer: z.string().trim().optional(),
    product: z.string().trim().optional(),
    docType: z.enum(["PDS", "TMD", "SPDS", "FSG", "FAQ", "GUIDE"]).default("PDS"),
  }).optional(),
});
```

### 2. Multi-Turn PII Scrubbing & k-Anonymity Hashing
- The pre-ingress privacy scrubber processes both the primary `query` and all historical `history` messages before prompt synthesis.
- To maintain strict APP 3 & 11 compliance and zero raw query storage in D1, only the latest query is hashed with `getDailySalt()` for telemetry logging. No past message history is persisted in database tables.

### 3. Sub-Millisecond Deterministic Intent & Voice Normalizer
- Operates in $< 1\text{ ms}$ at the edge before retrieval to protect the $< 350\text{ ms}$ TTFT target.
- Strips speech-to-text filler words (`"um"`, `"uh"`, `"like"`, `"so basically"`, `"actually"`).
- Maps common Australian colloquial expressions to statutory policy concepts:
  - *"broken pipe"* / *"soaked floor"* / *"leaking shower"* $\rightarrow$ `Escape of Liquid`, `Gradual Deterioration`, `Fixed Apparatus`
  - *"break in"* / *"smashed window"* / *"stolen from driveway"* $\rightarrow$ `Theft`, `Violent and Forcible Entry`, `Common Property Exclusion`
  - *"blackout"* / *"fridge stopped"* / *"spoiled meat"* $\rightarrow$ `Food Spoilage`, `Power Interruption`, `Contents Insurance`
  - *"hired scooter"* / *"moped crash overseas"* $\rightarrow$ `Motorcycle Endorsement`, `Engine Capacity Sub-limit`, `License Requirement`

### 4. Conversational Boundary Refinement for ASIC RG 244
- Distinguish between:
  - **Permissible Factual Education:** Explaining how policy mechanics work (*"How does a flood excess work?"*, *"What factors affect claim excess?"*).
  - **Conversational Dilemma Inquiries:** Reframing questions like *"Should I claim or pay myself?"* into objective decision criteria (deductible vs cost of repairs, no-claim discount impacts, gradual wear exclusions) without advising on the action to take.
  - **Prohibited Personal Advice:** Explicit switching or recommendation requests (*"Which policy is best for my budget?"*) trigger deterministic safe-harbor refusals (`STATUTORY_SAFE_HARBOR_REFUSAL`).

### 5. Product Line Delineation, Structured Disambiguation & Insurance Specialist Persona
- All conversational answers adopt the **Australian Insurance Product & Claims Specialist Persona** and follow the **5-Part Specialist Response Anatomy** ([`GLOSSARY.md § 2`](../../GLOSSARY.md#2-regulatory--compliance-invariants)):
  1. **Direct Definition or Coverage Position:** State the operative contractual/statutory rule immediately and delineate between Building, Contents, Landlord, Motor, Travel, and Life policies when an inquiry is broad.
  2. **Related Event & Policy Structure Demarcation:** Structure responses using dedicated Markdown headings or bulleted groups comparing related insured events (*Flood* vs. *Rainwater Run-off* vs. *Storm Surge / Actions of the Sea* vs. *Escape of Liquid*).
  3. **Critical Exclusions, Waiting Periods & Sub-Limits:** Call out 48h/72h embargoes, high tide / actions of the sea exclusions, unforced theft exclusions, gradual deterioration, and monetary sub-limits.
  4. **Certificate of Insurance (Policy Schedule) Context:** Explain where optional cover elections, specified portable valuables, and Excess tiers appear on the customer's *Certificate of Insurance*.
  5. **Dual-Provenance Citations & Verbatim `STATUTORY_GAW`:** Attach inline citations (`[Source: Insurer Product (Section)]`) to each section and close with `STATUTORY_GAW`.
- **Zero Meta-Language Invariant:** Never emit internal RAG meta-talk (`"in the provided context"`, `"based on the provided passages"`). Address the policyholder directly with authoritative policy precision (*"Under the {Insurer} {Product} PDS..."*).

### 6. Dynamic Follow-Up Prompt Suggestions
- In the SSE stream, the `metadata` or final `done` event emits an array of 2–3 contextual follow-up chips based on the retrieved policy chunks:
  ```json
  "suggested_follow_ups": [
    "What is the 72-hour flood embargo?",
    "How does escape of liquid differ from storm run-off?",
    "What sub-limits apply to jewelry and valuables?"
  ]
  ```
- The frontend renders these chips as interactive prompt pills below assistant messages.

---

## Testing Decisions

### What Makes a Good Test
- Tests must strictly test external observable behavior (the HTTP SSE stream, status codes, emitted event types, grounded chunks, and text content), never internal private variables or intermediate function state.
- Assert that conversational and colloquial queries successfully retrieve the authoritative statutory clauses.
- Assert that broad queries return multi-peril structured disambiguation.
- Assert that multi-turn context disambiguates follow-up pronouns (*"Does it apply to flood?"*).
- Assert that advice boundaries and emergency interceptions are preserved with 0% false negatives.
- Assert that every compliant conversational response contains 100% of the verbatim `STATUTORY_GAW`.

### Single Highest Test Seam
- **Primary Testing Seam:** `worker.fetch(request, env, ctx)` targeting `POST /api/chat`.
- All multi-turn conversation payloads, colloquial expansion, gatekeeper decisions, streaming SSE frames (`metadata`, `token`, `done`, `error`), and telemetry audit writes are exercised through this single boundary.

### Prior Art in the Codebase
- Integration test suite: `tests/integration/worker.test.ts` (exercises `worker.fetch` with mock environment and validates SSE protocol sequence).
- AFCA red-teaming benchmarks: `tests/evals/afca-compliance.test.ts` (TC-01 through TC-10 validating exact clause disambiguation and advice boundary gatekeeping).

---

## Out of Scope

1. **User Authentication & Policy Number Binding:** The application will not connect to live insurer policyholder portals or verify active insurance certificate numbers.
2. **Personal Financial Advice:** Recommending specific policies, calculating custom premiums, or advising users on policy switching is strictly prohibited under ASIC RG 244.
3. **Automated Claim Lodgement:** Lodging claims directly with underwriters or initiating insurer claims workflows.
4. **Permanent Raw Query Storage:** Persisting raw user conversational text in Cloudflare D1 or R2 is prohibited under Australian Privacy Principles 3 & 11 (all audit logs store daily-salted SHA-256 hashes).

---

## Further Notes

- Maintains pure Cloudflare Workers V8 isolate portability (`workerd`): zero Node.js filesystem APIs (`node:fs`) in the edge runtime.
- Preserves the 10 requests per minute per IP sliding-window rate limit and `X-RateLimit-*` response headers.
- Bundle budget remains strictly capped ($\le 1.5\text{ MB}$ uncompressed edge isolate).
