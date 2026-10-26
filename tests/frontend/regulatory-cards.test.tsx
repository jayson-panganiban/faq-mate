import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { STATUTORY_GAW, STATUTORY_SAFE_HARBOR_REFUSAL } from "../../src/constants/statutory";
import { EmergencyBanner } from "../../src/frontend/components/EmergencyBanner";
import { RefusalCard } from "../../src/frontend/components/RefusalCard";
import { StatutoryGaw } from "../../src/frontend/components/StatutoryGaw";

describe("Regulatory & Safety Guardrail Cards (Ticket 3)", () => {
  describe("StatutoryGaw Component", () => {
    it("renders the exact canonical General Advice Warning copy under Corporations Act s.949A", () => {
      render(<StatutoryGaw />);

      const gawElement = screen.getByTestId("statutory-gaw");
      expect(gawElement).toBeInTheDocument();
      // Must contain canonical text verbatim without any paraphrase
      expect(gawElement).toHaveTextContent(STATUTORY_GAW);
    });

    it("has accessible role and label for screen readers", () => {
      render(<StatutoryGaw />);

      const gawElement = screen.getByRole("note", { name: /general advice warning/i });
      expect(gawElement).toBeInTheDocument();
    });

    it("renders an accessible shield icon", () => {
      render(<StatutoryGaw />);

      const gawElement = screen.getByTestId("statutory-gaw");
      const icon = gawElement.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("applies disclaimer styling and custom className", () => {
      render(<StatutoryGaw className="custom-test-class" />);

      const gawElement = screen.getByTestId("statutory-gaw");
      expect(gawElement).toHaveClass("custom-test-class");
      expect(gawElement.className).toMatch(/border/);
      expect(gawElement.className).toMatch(/text-xs|text-sm/);
    });
  });

  describe("RefusalCard Component", () => {
    it("renders when code is ADVICE_BOUNDARY_VIOLATION", () => {
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" />);

      const card = screen.getByTestId("refusal-card");
      expect(card).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("does not render when code is different", () => {
      const { container } = render(<RefusalCard code="OTHER_CODE" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders default safe harbor message and references ASIC RG 244 and AFSL adviser", () => {
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" />);

      const card = screen.getByTestId("refusal-card");
      // Must mention ASIC RG 244
      expect(card).toHaveTextContent(/ASIC RG 244/i);
      // Must advise consulting an AFSL licensed adviser
      expect(card).toHaveTextContent(/AFSL/i);
      // Must explain advice boundary
      expect(card).toHaveTextContent(/personal financial (product )?advice/i);
    });

    it("renders custom message if provided in payload", () => {
      const customMessage = "Custom refusal: Please seek an AFSL adviser.";
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" message={customMessage} />);

      const card = screen.getByTestId("refusal-card");
      expect(card).toHaveTextContent(customMessage);
    });

    it("includes the canonical statutory GAW notice", () => {
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" />);

      const card = screen.getByTestId("refusal-card");
      expect(card).toHaveTextContent(STATUTORY_GAW);
    });

    it("deduplicates statutory GAW copy from default safe harbor refusal message without duplication", () => {
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" />);

      const card = screen.getByTestId("refusal-card");
      const text = card.textContent ?? "";
      // Must contain statutory GAW
      expect(text).toContain(STATUTORY_GAW);
      // General Advice Warning must only appear once in total within the card
      const gawCount = (text.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("deduplicates statutory GAW copy when custom message contains unformatted GAW", () => {
      const customMessage =
        "Custom refusal: I cannot provide personal financial product advice.\n\nGeneral Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs.";
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" message={customMessage} />);

      const card = screen.getByTestId("refusal-card");
      const text = card.textContent ?? "";
      expect(text).toContain("Custom refusal: I cannot provide personal financial product advice.");
      expect(text).toContain(STATUTORY_GAW);
      const gawCount = (text.match(/General Advice Warning/g) || []).length;
      expect(gawCount).toBe(1);
    });

    it("applies amber warning styling and contains warning icon", () => {
      render(<RefusalCard code="ADVICE_BOUNDARY_VIOLATION" />);

      const card = screen.getByTestId("refusal-card");
      expect(card.className).toMatch(/amber/);
      const icon = card.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("EmergencyBanner Component", () => {
    it("renders when code is EMERGENCY_INTERCEPTION", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const banner = screen.getByTestId("emergency-banner");
      expect(banner).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("does not render when code is different", () => {
      const { container } = render(<EmergencyBanner code="OTHER_CODE" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders high-contrast emergency styling", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const banner = screen.getByTestId("emergency-banner");
      expect(banner.className).toMatch(/red/);
    });

    it("provides one-touch dial buttons for Triple Zero (000), SES (132 500), and Disaster Welfare (1800 018 444)", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const tripleZeroLink = screen.getByRole("link", { name: /triple zero|000/i });
      expect(tripleZeroLink).toBeInTheDocument();
      expect(tripleZeroLink).toHaveAttribute("href", "tel:000");

      const sesLink = screen.getByRole("link", { name: /ses|132\s?500/i });
      expect(sesLink).toBeInTheDocument();
      expect(sesLink).toHaveAttribute("href", "tel:132500");

      const disasterLink = screen.getByRole("link", { name: /disaster welfare|1800\s?018\s?444/i });
      expect(disasterLink).toBeInTheDocument();
      expect(disasterLink).toHaveAttribute("href", "tel:1800018444");
    });

    it("ensures all dial links have minimum 44px tap targets for mobile usability", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThanOrEqual(3);

      for (const link of links) {
        // Must contain Tailwind classes ensuring minimum 44px height (min-h-[44px] or h-11 or py-3/similar)
        expect(link.className).toMatch(/min-h-\[44px\]|min-h-11|h-11|h-12|min-w-\[44px\]/);
      }
    });

    it("includes accessible aria-labels with service name and purpose", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const tripleZero = screen.getByLabelText(/Triple Zero/i);
      expect(tripleZero).toBeInTheDocument();

      const ses = screen.getByLabelText(/SES|State Emergency Service/i);
      expect(ses).toBeInTheDocument();

      const disaster = screen.getByLabelText(/Disaster Welfare/i);
      expect(disaster).toBeInTheDocument();
    });

    it("renders emergency message warning users of life safety peril", () => {
      render(<EmergencyBanner code="EMERGENCY_INTERCEPTION" />);

      const banner = screen.getByTestId("emergency-banner");
      expect(banner).toHaveTextContent(/immediate life danger|emergency/i);
    });
  });
});
