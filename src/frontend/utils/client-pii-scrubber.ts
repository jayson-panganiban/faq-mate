/**
 * Client-Side PII Scrubber (Spec 05 User Story 13)
 * Implements Australian Privacy Principles (APPs 3, 6, 11) pre-ingress redaction.
 * Redacts Tax File Numbers (TFN), Medicare cards, Payment Cards, Australian Phones,
 * and Driver Licences in the browser BEFORE edge network dispatch.
 */

export const TFN_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
export const MEDICARE_PATTERN = /\b[2-6]\d{9}\s?\d?\b/g;
export const CREDIT_CARD_PATTERN = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
export const AU_PHONE_PATTERN = /\b(?:\+?61\s?|0)[2-478](?:[\s-]?\d){8}\b/g;
export const DRIVER_LICENCE_PATTERN = /\b(?:licence|license|lic|dl)[\s#:]*([a-zA-Z0-9]{6,10})\b/gi;

export interface ClientPiiSanitizeResult {
  sanitized: string;
  wasRedacted: boolean;
  redactedTypes: string[];
}

/**
 * Synchronously redacts sensitive Australian PII entities client-side before network ingress.
 */
export function sanitizeClientPii(input: string): ClientPiiSanitizeResult {
  let text = input;
  const redactedTypes: string[] = [];

  if (DRIVER_LICENCE_PATTERN.test(text)) {
    text = text.replace(DRIVER_LICENCE_PATTERN, "licence [REDACTED_LICENCE]");
    redactedTypes.push("DRIVER_LICENCE");
  }

  if (CREDIT_CARD_PATTERN.test(text)) {
    text = text.replace(CREDIT_CARD_PATTERN, "[REDACTED_CARD]");
    redactedTypes.push("CREDIT_CARD");
  }

  if (MEDICARE_PATTERN.test(text)) {
    text = text.replace(MEDICARE_PATTERN, "[REDACTED_MEDICARE]");
    redactedTypes.push("MEDICARE");
  }

  if (TFN_PATTERN.test(text)) {
    text = text.replace(TFN_PATTERN, "[REDACTED_TFN]");
    redactedTypes.push("TFN");
  }

  if (AU_PHONE_PATTERN.test(text)) {
    text = text.replace(AU_PHONE_PATTERN, "[REDACTED_PHONE]");
    redactedTypes.push("PHONE");
  }

  return {
    sanitized: text,
    wasRedacted: redactedTypes.length > 0,
    redactedTypes,
  };
}
