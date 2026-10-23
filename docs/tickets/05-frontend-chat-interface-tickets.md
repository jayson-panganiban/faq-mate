# Task Graph: Spec 05 — Cloudflare Pages Frontend Chat Interface

**Spec Reference:** [`docs/specs/05-frontend-chat-interface.md`](../specs/05-frontend-chat-interface.md)  
**Integration Branch:** `feat/spec-05-pages-frontend`

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

## Tickets

### Ticket 1: UI Scaffolding & Build Pipeline
- **Status:** COMPLETED
- **Dependencies:** None

### Ticket 2: useChatStream Hook & SSE State Machine
- **Status:** COMPLETED
- **Dependencies:** Ticket 1

### Ticket 3: Regulatory & Safety Guardrail Cards
- **Status:** COMPLETED
- **Dependencies:** Ticket 1

### Ticket 4: Grounding Inspector & Citation Drawer
- **Status:** COMPLETED
- **Dependencies:** Ticket 1

### Ticket 5: Markdown Canvas & Sub-limit Table Renderer
- **Status:** COMPLETED
- **Dependencies:** Ticket 1, Ticket 4

### Ticket 6: Edge Telemetry Header, Abuse Shield & Input Bar
- **Status:** COMPLETED
- **Dependencies:** Ticket 2

### Ticket 7: Full Application Assembly & E2E Integration
- **Status:** COMPLETED
- **Dependencies:** Tickets 2, 3, 4, 5, 6
