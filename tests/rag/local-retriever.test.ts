import { describe, expect, it } from "vitest";
import { localHybridSearch } from "../../src/rag/local-retriever";

describe("Colloquial Retrieval via Local Hybrid Search (Spec 07)", () => {
  it("retrieves Escape of Liquid chunk for colloquial burst pipe inquiry", () => {
    const chunks = localHybridSearch({
      query: "A pipe burst in my ensuite while I was on holiday and ruined the floorboards",
      topK: 3,
    });

    expect(chunks.length).toBeGreaterThan(0);
    const topChunk = chunks[0];
    expect(topChunk.content.toLowerCase()).toMatch(/escape of liquid|liquid/i);
  });

  it("retrieves Food Spoilage chunk for blackout and spoiled fridge food", () => {
    const chunks = localHybridSearch({
      query: "Does insurance cover spoiled food if the power goes out during a blackout?",
      topK: 3,
    });

    expect(chunks.length).toBeGreaterThan(0);
    const hasFoodSpoilage = chunks.some(
      (c) =>
        c.content.toLowerCase().includes("spoilage") || c.content.toLowerCase().includes("food")
    );
    expect(hasFoodSpoilage).toBe(true);
  });

  it("retrieves Violent and Forcible Entry for driveway theft inquiry", () => {
    const chunks = localHybridSearch({
      query: "Someone smashed my passenger window parked outside my flat and took my laptop",
      topK: 3,
    });

    expect(chunks.length).toBeGreaterThan(0);
    const hasTheft = chunks.some(
      (c) =>
        c.content.toLowerCase().includes("theft") ||
        c.content.toLowerCase().includes("forcible") ||
        c.content.toLowerCase().includes("open")
    );
    expect(hasTheft).toBe(true);
  });

  it("returns relevant definition and coverage chunks as top results across Home, Motor, Travel, and Life queries (Spec 08 § 4)", () => {
    const homeChunks = localHybridSearch({
      query: "What is flood definition for NRMA?",
      topK: 3,
      filter: { insurer: "NRMA" },
    });
    expect(homeChunks.length).toBeGreaterThan(0);
    expect(homeChunks[0].source.section).toMatch(/Definitions\s*—\s*Flood/i);
    expect(homeChunks[0].content.toLowerCase()).toContain("normally dry land");

    const motorChunks = localHybridSearch({
      query: "What does agreed value vs market value mean for Youi?",
      topK: 3,
      filter: { insurer: "Youi" },
    });
    expect(motorChunks.length).toBeGreaterThan(0);
    expect(motorChunks[0].content.toLowerCase()).toMatch(/agreed value|market value/);

    const travelChunks = localHybridSearch({
      query: "What is pre-existing medical condition definition for Cover-More?",
      topK: 3,
      filter: { insurer: "Cover-More" },
    });
    expect(travelChunks.length).toBeGreaterThan(0);

    const lifeChunks = localHybridSearch({
      query: "What is TPD definition and waiting period for TAL?",
      topK: 3,
      filter: { insurer: "TAL" },
    });
    expect(lifeChunks.length).toBeGreaterThan(0);

    const unrelatedChunks = localHybridSearch({
      query: "What is adobo?",
      topK: 5,
    });
    expect(unrelatedChunks).toHaveLength(0);
  });
});
