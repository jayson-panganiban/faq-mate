/**
 * Deep Module: Edge PII Redaction & Anonymizer
 * Complies with Australian Privacy Principles (APPs 3, 6, 11) & Spec 03 Section 3.
 */

const TFN_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
const MEDICARE_PATTERN = /\b[2-6]\d{9}\s?\d?\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

// Australian Phone Numbers: Mobile (04xx xxx xxx), Landline (02/03/07/08 xxxx xxxx), and +61 international prefix
const AU_PHONE_PATTERN = /\b(?:\+?61\s?|0)[2-478](?:[\s-]?\d){8}\b/g;

// Australian State Driver Licences: NSW (8 digits or letter+7), VIC (9 digits), QLD/WA/SA/ACT/TAS (6-9 alphanumeric)
// Catches prefixed licences e.g. "licence 12345678", "DL: 987654321", "licence: 4567890"
const DRIVER_LICENCE_PATTERN = /\b(?:licence|license|lic|dl)[\s#:]*([a-zA-Z0-9]{6,10})\b/gi;

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

  if (DRIVER_LICENCE_PATTERN.test(text)) {
    text = text.replace(DRIVER_LICENCE_PATTERN, "licence [REDACTED_LICENCE]");
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
