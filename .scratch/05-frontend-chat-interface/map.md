# Wayfinding Map: Frontend Chat Interface (Spec 05)

**Spec Reference:** [`spec.md`](spec.md)  
**Integration Branch:** `feat/spec-05-pages-frontend`

## Notes & Decisions
- React 19 UI with Tailwind CSS and Lucide icons running on Cloudflare Pages.
- Client SSE state machine, grounding inspector, regulatory disclaimer cards, citation drawer.

## Task Graph

```mermaid
graph TD
    T1[Ticket 1: UI Scaffolding & Build Pipeline] --> T2[Ticket 2: useChatStream Hook & SSE State Machine]
    T1 --> T3[Ticket 3: Regulatory & Safety Guardrail Cards]
    T1 --> T4[Ticket 4: Grounding Inspector & Citation Drawer]
    T4 --> T5[Ticket 5: Markdown Canvas & Sub-limit Table Renderer]
    T2 --> T6[Ticket 6: Edge Telemetry Header, Abuse Shield & Input Bar]
    T2 --> T7[Ticket 7: Full Application Assembly & E2E Integration]
    T3 --> T7
    T4 --> T7
    T5 --> T7
    T6 --> T7
```

## Decisions So Far
- All tickets 01–07 completed and verified against Cloudflare Pages edge build.
