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
});
