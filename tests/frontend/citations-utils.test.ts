import { describe, expect, it } from "vitest";
import type { GroundedChunk } from "../../src/frontend/types/chat-ui";
import { findMatchingChunk, formatProductDoc } from "../../src/frontend/utils/citations";

describe("Citations Utility Functions", () => {
  describe("formatProductDoc", () => {
    it("appends docType when product does not contain it", () => {
      expect(formatProductDoc("Suncorp Classic Home", "PDS")).toBe("Suncorp Classic Home PDS");
      expect(formatProductDoc("NRMA Motor", "TMD")).toBe("NRMA Motor TMD");
    });

    it("avoids duplicating docType if product title already contains it", () => {
      expect(formatProductDoc("Suncorp Classic Home PDS", "PDS")).toBe("Suncorp Classic Home PDS");
      expect(formatProductDoc("NRMA Building PDS", "pds")).toBe("NRMA Building PDS");
    });

    it("provides clean defaults when product or docType is omitted", () => {
      expect(formatProductDoc(undefined, undefined)).toBe("Policy Document PDS");
      expect(formatProductDoc("Allianz Home", undefined)).toBe("Allianz Home PDS");
      expect(formatProductDoc(undefined, "SPDS")).toBe("Policy Document SPDS");
    });
  });

  describe("findMatchingChunk", () => {
    const mockChunks: GroundedChunk[] = [
      {
        id: "chunk-suncorp-flood-1",
        relevanceScore: 0.94,
        content: "Flood definition wording.",
        source: {
          insurer: "SUNCORP",
          product: "Suncorp Classic Home",
          docType: "PDS",
          section: "Section 2: Insured Events",
        },
      },
      {
        id: "chunk-allianz-jewel-2",
        relevanceScore: 0.88,
        content: "Jewellery sub-limits.",
        source: {
          insurer: "ALLIANZ",
          product: "Allianz Home & Contents",
          docType: "PDS",
          section: "Section 4: Valuables",
        },
      },
    ];

    it("matches chunk by exact chunk ID", () => {
      const match = findMatchingChunk("Refer to chunk-suncorp-flood-1", mockChunks);
      expect(match).toBeDefined();
      expect(match?.id).toBe("chunk-suncorp-flood-1");
    });

    it("matches chunk by combined product and section", () => {
      const match = findMatchingChunk(
        "[Source: Allianz Home & Contents PDS, Section 4: Valuables]",
        mockChunks
      );
      expect(match).toBeDefined();
      expect(match?.id).toBe("chunk-allianz-jewel-2");
    });

    it("matches chunk by section name or section prefix", () => {
      const match = findMatchingChunk("Section 2: Insured Events", mockChunks);
      expect(match).toBeDefined();
      expect(match?.id).toBe("chunk-suncorp-flood-1");
    });

    it("matches chunk by product name", () => {
      const match = findMatchingChunk("Allianz Home & Contents", mockChunks);
      expect(match).toBeDefined();
      expect(match?.id).toBe("chunk-allianz-jewel-2");
    });

    it("returns undefined when no chunk matches or chunk collection is empty", () => {
      expect(findMatchingChunk("Unknown Section", mockChunks)).toBeUndefined();
      expect(findMatchingChunk("chunk-1", [])).toBeUndefined();
      expect(findMatchingChunk("chunk-1", undefined)).toBeUndefined();
    });
  });
});
