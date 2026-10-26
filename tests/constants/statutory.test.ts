import { describe, expect, it } from "vitest";
import {
  isGawDisclaimerText,
  STATUTORY_GAW,
  STATUTORY_SAFE_HARBOR_REFUSAL,
  stripStatutoryGaw,
} from "../../src/constants/statutory";

describe("Statutory Notices & GAW Deduplication Utilities (Spec 03 & Spec 05)", () => {
  describe("isGawDisclaimerText", () => {
    it("identifies canonical STATUTORY_GAW", () => {
      expect(isGawDisclaimerText(STATUTORY_GAW)).toBe(true);
    });

    it("identifies disclaimers mentioning personal objectives, financial situation, or needs", () => {
      expect(
        isGawDisclaimerText(
          "This advice does not take into account your personal objectives, financial situation, or needs."
        )
      ).toBe(true);
      expect(
        isGawDisclaimerText(
          "General product info only: does not consider your personal objectives or budget."
        )
      ).toBe(true);
    });

    it("returns false for regular explanatory prose", () => {
      expect(isGawDisclaimerText("Flood cover is subject to a 72-hour waiting period.")).toBe(
        false
      );
      expect(
        isGawDisclaimerText("Under Section 949A, financial institutions must provide warnings.")
      ).toBe(false);
    });
  });

  describe("stripStatutoryGaw", () => {
    it("returns empty string for null, undefined, or empty string", () => {
      expect(stripStatutoryGaw("")).toBe("");
    });

    it("strips exact STATUTORY_GAW from end of message", () => {
      const input = `Flood damage is covered.\n\n${STATUTORY_GAW}`;
      expect(stripStatutoryGaw(input)).toBe("Flood damage is covered.");
    });

    it("strips preceding markdown horizontal rule dividers (---, ***)", () => {
      const input1 = `Flood damage is covered.\n\n---\n\n${STATUTORY_GAW}`;
      expect(stripStatutoryGaw(input1)).toBe("Flood damage is covered.");

      const input2 = `Flood damage is covered.\n\n***\n\n${STATUTORY_GAW}`;
      expect(stripStatutoryGaw(input2)).toBe("Flood damage is covered.");
    });

    it("strips GAW formatted without emoji", () => {
      const input =
        "Flood damage is covered.\n\nGeneral Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice.";
      expect(stripStatutoryGaw(input)).toBe("Flood damage is covered.");
    });

    it("strips GAW formatted with markdown bold and headers (###, **, **⚠️)", () => {
      const input1 =
        "Flood damage is covered.\n\n### General Advice Warning\nThis information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      expect(stripStatutoryGaw(input1)).toBe("Flood damage is covered.");

      const input2 =
        "Flood damage is covered.\n\n**⚠️ General Advice Warning:** This information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      expect(stripStatutoryGaw(input2)).toBe("Flood damage is covered.");

      const input3 =
        "Flood damage is covered.\n\n## ⚠️ General Advice Warning\nThis information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      expect(stripStatutoryGaw(input3)).toBe("Flood damage is covered.");
    });

    it("strips blockquoted GAW (> ⚠️ General Advice Warning:)", () => {
      const input =
        "Flood damage is covered.\n\n> ⚠️ General Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      expect(stripStatutoryGaw(input)).toBe("Flood damage is covered.");
    });

    it("strips multiple duplicate GAW disclaimers iteratively", () => {
      const input = `Flood damage is covered.\n\n${STATUTORY_GAW}\n\n${STATUTORY_GAW}`;
      expect(stripStatutoryGaw(input)).toBe("Flood damage is covered.");
    });

    it("strips bulleted, numbered, quoted, and section-5 headed GAW variations", () => {
      const bulleted = `Flood damage is covered.\n\n### 5. Statutory Disclaimer\n- ${STATUTORY_GAW}`;
      expect(stripStatutoryGaw(bulleted)).toBe("Flood damage is covered.");

      const numbered = `Flood damage is covered.\n\n5. **General Advice Warning:** This information is general product information only and does not take into account your personal objectives, financial situation, or needs.`;
      expect(stripStatutoryGaw(numbered)).toBe("Flood damage is covered.");

      const quoted = `Flood damage is covered.\n\n"${STATUTORY_GAW}"`;
      expect(stripStatutoryGaw(quoted)).toBe("Flood damage is covered.");
    });

    it("cleans STATUTORY_SAFE_HARBOR_REFUSAL to return only advice refusal text", () => {
      const cleanRefusal = stripStatutoryGaw(STATUTORY_SAFE_HARBOR_REFUSAL);
      expect(cleanRefusal).toContain("cannot provide personal financial product advice");
      expect(cleanRefusal).toContain("factual information regarding what is covered or excluded");
      expect(cleanRefusal).not.toContain("General Advice Warning");
    });

    it("preserves informational explanations of General Advice Warning in message body", () => {
      const input = `General Advice Warning (Corporations Act 2001 s.949A):\nUnder Section 949A, a General Advice Warning must be given whenever general advice is provided to retail clients.\n\n[Source: ASIC RG 244]\n\n${STATUTORY_GAW}`;
      const output = stripStatutoryGaw(input);
      expect(output).toContain(
        "Under Section 949A, a General Advice Warning must be given whenever general advice is provided"
      );
      expect(output).toContain("[Source: ASIC RG 244]");
      expect(output).not.toContain("This information is general product information only");
    });
  });
});
