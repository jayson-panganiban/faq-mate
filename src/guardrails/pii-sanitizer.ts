/**
 * Deep Module: Edge PII Redaction & Anonymizer
 * Complies with Australian Privacy Principles (APPs 3, 6, 11).
 */

const TFN_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
const MEDICARE_PATTERN = /\b[2-6]\d{9}\s?\d?\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const AU_PHONE_PATTERN = /\b(?:\+?61|0)[2-478](?:[ -]?\d{4}){2}\b/g;

export interface SanitizerResult {
  sanitized: string;
  wasRedacted: boolean;
  queryHash: string;
}

export async function sanitizePii(input: string): Promise<SanitizerResult> {
  let text = input;
  let wasRedacted = false;

  if (TFN_PATTERN.test(text)) {
    text = text.replace(TFN_PATTERN, "[REDACTED_TFN]");
    wasRedacted = true;
  }

  if (MEDICARE_PATTERN.test(text)) {
    text = text.replace(MEDICARE_PATTERN, "[REDACTED_MEDICARE]");
    wasRedacted = true;
  }

  if (CREDIT_CARD_PATTERN.test(text)) {
    text = text.replace(CREDIT_CARD_PATTERN, "[REDACTED_CARD]");
    wasRedacted = true;
  }

  if (AU_PHONE_PATTERN.test(text)) {
    text = text.replace(AU_PHONE_PATTERN, "[REDACTED_PHONE]");
    wasRedacted = true;
  }

  // Generate SHA-256 hash using native Web Crypto for D1 k-anonymity logging
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const queryHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    sanitized: text,
    wasRedacted,
    queryHash,
  };
}
