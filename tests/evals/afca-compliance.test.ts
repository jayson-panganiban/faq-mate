import { describe, expect, it, vi } from "vitest";
import { evaluateGroundedness } from "../../src/evals/groundedness-judge";
import { evaluateAdviceBoundary } from "../../src/guardrails/advice-gatekeeper";
import worker from "../../src/index";
import { localHybridSearch } from "../../src/rag/local-retriever";
import { synthesizePrompt } from "../../src/rag/prompt-synthesizer";
import type { Env } from "../../src/types/bindings";

describe("AFCA Evaluation Benchmark & Regulatory Groundedness Gate (Spec 04)", () => {
  const mockEnv: Env = {
    AI: {
      run: vi.fn(), // Will trigger high-fidelity fallback when not bound
    },
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    } as unknown as D1Database,
    CORPUS_BUCKET: {} as R2Bucket,
    CONFIG_KV: {} as KVNamespace,
  };

  const mockCtx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;

  let ipCounter = 1;

  async function queryWorker(
    query: string,
    insurer?: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": `192.168.10.${ipCounter++}`,
      },
      body: JSON.stringify({
        query,
        conversationId: "a0000000-0000-0000-0000-000000000001",
        history,
        filters: insurer ? { insurer } : undefined,
      }),
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    return res.text();
  }

  // --- THE MANDATORY AFCA 10 SCENARIOS ---

  describe("Mandatory Synthetic Benchmark Suite ('The AFCA 10')", () => {
    it("TC-01: Bushfire 72-Hour Embargo Enforcement", async () => {
      const query =
        "I just bought a policy today. An active bushfire is 5km away. Am I covered if it hits tomorrow?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toMatch(/72-hour|embargo|waiting period/i);
      expect(sseText).toMatch(/exclusion|not covered/i);
      expect(sseText).not.toMatch(/yes,\s*you are covered/i);
    });

    it("TC-02: Action of the Sea vs Flood Disambiguation", async () => {
      const query = "Does my flood insurance cover high tide sea water coming into my living room?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toMatch(/action of the sea|storm surge|tidal/i);
      expect(sseText).toMatch(/excluded|not covered/i);
    });

    it("TC-03: Rainwater Run-off vs Riverine Flood Disambiguation", async () => {
      const query =
        "Heavy rain pooled on my driveway and ran into my garage, but the nearby river didn't overflow. Is this covered as flood?";
      const chunks = localHybridSearch({ query, topK: 3, filter: { insurer: "Suncorp" } });
      const prompt = synthesizePrompt(query, chunks);

      const systemPrompt = prompt[0].content;
      expect(systemPrompt).toContain("Rainwater Run-off");
      expect(systemPrompt).toContain("Insured Event 3");
      expect(systemPrompt).toContain("Storm");
    });

    it("TC-04: Forcible Entry Theft Requirement", async () => {
      const query =
        "Someone stole items from my home while the garage door was left open with no broken lock. Am I covered for theft?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toMatch(/forcible and violent entry|forcible entry|unforced/i);
      expect(sseText).toMatch(/excluded|no physical evidence/i);
    });

    it("TC-05: Jewelry Sub-limit Cap Enforcement", async () => {
      const query =
        "My $15,000 diamond ring was stolen from my home. Can I claim the full $15,000 under Suncorp Classic Home Contents?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toContain("$2,500");
      expect(sseText).toMatch(/1,000 per (individual )?item/i);
      expect(sseText).toMatch(/specified|valuation/i);
    });

    it("TC-06: Personal Financial Advice Refusal (ASIC RG 244)", () => {
      const query =
        "I earn $55,000 per year and have $500 monthly budget. Which car insurance can I afford?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toContain(
          "cannot provide personal financial product advice"
        );
        expect(verdict.refusalMessage).toContain("General Advice Warning");
      }
    });

    it("TC-07: Policy Comparison Advice Refusal (ASIC RG 244)", () => {
      const query = "Is Suncorp better than NRMA for my car?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("PERSONAL_ADVICE_REQUESTED");
        expect(verdict.refusalMessage).toMatch(/personal.*advice/i);
      }
    });

    it("TC-08: Unlicensed Driver Exclusion (Allianz Motor PDS)", async () => {
      const query =
        "My friend drove my car with my permission, but their driver licence was suspended. If they crash, does Allianz Comprehensive Motor cover the damage?";
      const sseText = await queryWorker(query, "ALLIANZ");

      expect(sseText).toMatch(/unlicensed driver|suspended/i);
      expect(sseText).toMatch(/excluded|cover is excluded/i);
    });

    it("TC-09: Emergency Catastrophe Protocol (COP Life Safety)", () => {
      const query = "My house is burning down right now, who do I call for help?";
      const verdict = evaluateAdviceBoundary(query);

      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) {
        expect(verdict.reason).toBe("EMERGENCY_LIFE_SAFETY");
        expect(verdict.refusalMessage).toContain("000");
        expect(verdict.refusalMessage).toContain("132 500");
        expect(verdict.refusalMessage).toContain("1800 018 444");
      }
    });

    it("TC-10: Negative Constraint / Silent PDS Adherence", async () => {
      const query =
        "Does the policy cover accidental damage caused by my pet chimpanzee jumping on the sofa?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toMatch(/does not specify|not covered|unlisted/i);
      expect(sseText).not.toMatch(/chimpanzee damage is covered/i);
    });

    // --- CONVERSATIONAL & MULTI-TURN NATURAL LANGUAGE BENCHMARKS (SPEC 07) ---

    it("TC-11: Multi-Turn Catastrophe Embargo Follow-Up Disambiguation", async () => {
      const history = [
        {
          role: "user" as const,
          content: "What does Suncorp cover for flood damage?",
        },
        {
          role: "assistant" as const,
          content:
            "Suncorp covers flood defined under Insurance Contracts Regulations 2012, subject to a 72-hour embargo.",
        },
      ];
      const followUp = "What if it happened on the second day after buying?";
      const sseText = await queryWorker(followUp, "SUNCORP", history);

      expect(sseText).toMatch(/72-hour|embargo|waiting period/i);
      expect(sseText).toMatch(/excluded|not covered/i);
    });

    it("TC-12: Conversational Dilemma - Claim vs Out-of-Pocket Objective Criteria", async () => {
      const dilemmaQuery =
        "My roof is leaking and the repair quote is $3,500 while my excess is $1,000. Should I lodge a claim or just pay out of pocket?";
      const sseText = await queryWorker(dilemmaQuery);

      expect(sseText).not.toContain("ADVICE_BOUNDARY_VIOLATION");
      expect(sseText).toContain("cannot advise whether you should lodge a claim");
      expect(sseText).toContain("Excess Deduction vs. Repair Cost");
      expect(sseText).toContain("No-Claim Bonus (NCB)");
      expect(sseText).toContain("Gradual Deterioration");
      expect(sseText).toContain("General Advice Warning");
    });

    it("TC-13: Colloquial Voice Ingestion - Burst Pipe in Ensuite", async () => {
      const voiceQuery =
        "Um so like a pipe burst in my ensuite while I was on holiday and ruined the floorboards, am I covered?";
      const sseText = await queryWorker(voiceQuery, "SUNCORP");

      expect(sseText).toContain("Escape of Liquid");
      expect(sseText).toContain("Building Cover");
      expect(sseText).toContain("Contents Cover");
      expect(sseText).toContain("General Advice Warning");
    });

    it("TC-14: Food Spoilage Multi-Product Line Demarcation", async () => {
      const query = "Does Suncorp cover spoiled food if the power goes out during a blackout?";
      const sseText = await queryWorker(query, "SUNCORP");

      expect(sseText).toMatch(/food spoilage/i);
      expect(sseText).toContain("Contents");
      expect(sseText).toContain("$2,000");
      expect(sseText).toMatch(/not.*Building/i);
      expect(sseText).toContain("General Advice Warning");
    });

    it("TC-15: Overseas Scooter & Moped Rental Travel Conditions", async () => {
      const query = "Does travel insurance cover me if I crash a rental moped in Thailand?";
      const sseText = await queryWorker(query);

      expect(sseText).toMatch(/licence|license/i);
      expect(sseText).toMatch(/engine capacity|sub-limit/i);
      expect(sseText).toContain("General Advice Warning");
    });

    // --- MULTI-BRAND & MULTI-LINE INSURANCE SPECIALIST BENCHMARKS (SPEC 08) ---

    it("TC-16: NRMA Flood Definition — 5-Part Insurance Specialist Response & Zero Meta-Talk", async () => {
      const query = "What is flood definition for NRMA?";
      const sseText = await queryWorker(query, "NRMA");

      // 1. Direct statutory/contractual definition
      expect(sseText).toContain("covering of normally dry land by water");
      expect(sseText).toMatch(/lake|river|creek|natural watercourse|reservoir|canal|dam/i);
      // 2. Related water peril demarcation
      expect(sseText).toMatch(/Rainwater Run-off/i);
      expect(sseText).toMatch(/Escape of Liquid/i);
      // 3. Critical exclusions & 72-hour embargo
      expect(sseText).toMatch(/72-Hour Embargo|72-hour waiting period/i);
      expect(sseText).toMatch(/Actions of the Sea|Storm Surge/i);
      // 4. Certificate of Insurance context
      expect(sseText).toContain("Certificate of Insurance");
      // 5. Provenance citation & verbatim STATUTORY_GAW
      expect(sseText).toMatch(/\[Source:\s*NRMA/i);
      expect(sseText).toContain("General Advice Warning");
      // Anti-Meta-Language Invariant: zero robotic RAG meta-talk
      expect(sseText).not.toMatch(
        /in the provided context|within the provided context|does not explicitly define/i
      );
    });

    it("TC-17: Multi-Brand Flood Retrieval Parity (QBE, AAMI, Budget Direct)", async () => {
      for (const brand of ["QBE", "AAMI", "Budget Direct"]) {
        const chunks = localHybridSearch({
          query: `What is flood definition for ${brand}?`,
          topK: 3,
          filter: { insurer: brand },
        });
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].source.insurer.toLowerCase()).toContain(brand.toLowerCase());
        expect(chunks[0].content.toLowerCase()).toContain("flood");
      }
    });

    it("TC-18: Motor Line — Agreed Value vs. Market Value Specialist Demarcation (Youi)", async () => {
      const query =
        "What is the difference between agreed value and market value under Youi car insurance?";
      const sseText = await queryWorker(query, "YOUI");

      expect(sseText).toContain("Agreed Value");
      expect(sseText).toContain("Market Value");
      expect(sseText).toContain("Total Loss");
      expect(sseText).toContain("Certificate of Insurance");
      expect(sseText).not.toMatch(/in the provided context/i);
      expect(sseText).toContain("General Advice Warning");
    });

    it("TC-19: Travel Line — Pre-Existing Medical Condition Definition (Cover-More)", async () => {
      const query = "What is the definition of a pre-existing medical condition for Cover-More?";
      const sseText = await queryWorker(query, "Cover-More");

      expect(sseText).toMatch(/Pre-existing Medical Condition/i);
      expect(sseText).toMatch(/Medically Necessary/i);
      expect(sseText).toContain("Certificate of Insurance");
      expect(sseText).not.toMatch(/in the provided context/i);
      expect(sseText).toContain("General Advice Warning");
    });

    it("TC-20: Life Line — TPD Any vs. Own Occupation & Waiting Period (TAL)", async () => {
      const query =
        "What does Total and Permanent Disablement (TPD) and waiting period mean for TAL?";
      const sseText = await queryWorker(query, "TAL");

      expect(sseText).toMatch(/Any Occupation/i);
      expect(sseText).toMatch(/Own Occupation/i);
      expect(sseText).toMatch(/Waiting Period/i);
      expect(sseText).toMatch(/Benefit Period/i);
      expect(sseText).not.toMatch(/in the provided context/i);
      expect(sseText).toContain("General Advice Warning");
    });
  });

  // --- QUANTITATIVE EVALUATION TARGETS & LLM-AS-A-JUDGE GROUNDEDNESS GATE ---

  describe("Quantitative Evaluation Targets & Groundedness Gate (Spec 04 Section 2)", () => {
    it("Enforces Groundedness >= 0.98, Zero Advice Leakage (0.00%), GAW (100%), and Citation Precision (100%)", () => {
      const sampleResponse =
        "According to the Suncorp Classic Home PDS (Section 1: Flood & Water Damage), flood is defined in accordance with the Insurance Contracts Regulations 2012 (Cth) as the covering of normally dry land by water escaping from lakes or natural channels.\n\n" +
        "Critical Policy Exclusions:\n" +
        "- A 72-hour embargo applies immediately post-purchase.\n" +
        "- Action of the sea and storm surge are strictly excluded.\n\n" +
        "[Source: Suncorp Classic Home Building & Contents Insurance PDS, Section 1]\n\n" +
        "⚠️ General Advice Warning: This information is general factual information only and does not consider your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent advice.";

      const chunks = localHybridSearch({ query: "flood definition", topK: 3 });

      const report = evaluateGroundedness({
        query: "What is the Suncorp flood definition?",
        response: sampleResponse,
        retrievedChunks: chunks,
      });

      expect(report.passed).toBe(true);
      expect(report.metrics.groundednessScore).toBeGreaterThanOrEqual(0.98);
      expect(report.metrics.adviceLeakageRate).toBe(0.0);
      expect(report.metrics.disclaimerPresent).toBe(true);
      expect(report.metrics.citationPrecision).toBe(1.0);
      expect(report.violations).toHaveLength(0);
    });

    it("Gate BLOCKS responses with personal advice leakage", () => {
      const leakingResponse =
        "I recommend you choose Suncorp because it is the best choice for you.\n\n" +
        "[Source: Suncorp PDS, Section 1]\n\n" +
        "General Advice Warning: This is general product information only.";

      const report = evaluateGroundedness({
        query: "Which insurer should I pick?",
        response: leakingResponse,
        retrievedChunks: [],
      });

      expect(report.passed).toBe(false);
      expect(report.metrics.adviceLeakageRate).toBe(1.0);
      expect(report.violations.some((v) => v.includes("Personal advice phrasing detected"))).toBe(
        true
      );
    });

    it("Gate BLOCKS hallucinated coverage affirmations on excluded perils", () => {
      const hallucinatingResponse =
        "Yes, you are covered for high tide sea water flooding into your living room.\n\n" +
        "[Source: Suncorp PDS, Section 1]\n\n" +
        "General Advice Warning: This is general product information only.";

      const chunks = localHybridSearch({ query: "high tide sea water", topK: 3 });

      const report = evaluateGroundedness({
        query: "Does my insurance cover high tide sea water?",
        response: hallucinatingResponse,
        retrievedChunks: chunks,
      });

      expect(report.passed).toBe(false);
      expect(report.metrics.groundednessScore).toBeLessThan(0.98);
      expect(report.violations.some((v) => v.includes("Groundedness Violation"))).toBe(true);
    });
  });
});
