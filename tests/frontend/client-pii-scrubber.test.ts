import { describe, it, expect } from "vitest";
import { sanitizeClientPii } from "../../src/frontend/utils/client-pii-scrubber";

describe("Client-Side PII Scrubber (Spec 05 US-13 / APP 3 & 11)", () => {
  it("redacts Australian Tax File Numbers (TFN)", () => {
    const input = "My TFN is 123 456 789 and I want to lodge a claim.";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(true);
    expect(result.redactedTypes).toContain("TFN");
    expect(result.sanitized).toBe("My TFN is [REDACTED_TFN] and I want to lodge a claim.");
  });

  it("redacts Medicare card numbers", () => {
    const input = "Here is my Medicare card: 2345678901 1 for reference.";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(true);
    expect(result.redactedTypes).toContain("MEDICARE");
    expect(result.sanitized).toContain("[REDACTED_MEDICARE]");
    expect(result.sanitized).not.toContain("2345678901 1");
  });

  it("redacts Payment Cards (credit/debit PAN)", () => {
    const input = "Charged to card 4532 1234 5678 9010 on policy renewal.";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(true);
    expect(result.redactedTypes).toContain("CREDIT_CARD");
    expect(result.sanitized).toBe("Charged to card [REDACTED_CARD] on policy renewal.");
  });

  it("redacts Australian mobile and landline phone numbers", () => {
    const input = "Call me back on 0412 345 678 or landline +61 2 9876 5432 regarding my claim.";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(true);
    expect(result.redactedTypes).toContain("PHONE");
    expect(result.sanitized).toContain("[REDACTED_PHONE]");
    expect(result.sanitized).not.toContain("0412 345 678");
  });

  it("redacts Australian Driver Licence numbers with common prefixes", () => {
    const input = "My driver licence is NSW licence 12345678 and second is DL: 987654321 for identity verification.";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(true);
    expect(result.redactedTypes).toContain("DRIVER_LICENCE");
    expect(result.sanitized).toContain("licence [REDACTED_LICENCE]");
  });

  it("leaves standard policy queries unchanged with wasRedacted false", () => {
    const input = "What is the standard excess for flood damage under Suncorp Classic Home?";
    const result = sanitizeClientPii(input);

    expect(result.wasRedacted).toBe(false);
    expect(result.redactedTypes).toHaveLength(0);
    expect(result.sanitized).toBe(input);
  });
});
