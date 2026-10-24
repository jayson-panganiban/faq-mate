/**
 * Deep Module: Edge PII Redaction & Anonymizer
 * Complies with Australian Privacy Principles (APPs 3, 6, 11) & PRD § 5.4.
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

export interface MultiTurnSanitizerInput {
  query: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface MultiTurnSanitizerResult {
  sanitized: string;
  sanitizedQuery: string;
  sanitizedHistory: Array<{ role: "user" | "assistant"; content: string }>;
  wasRedacted: boolean;
  queryHash: string;
}

/**
 * Generates rotating daily salt for k-anonymity (PRD § 5.4).
 * Rotates every UTC midnight to guarantee query unlinkability across days.
 */
export function getDailySalt(date?: Date): string {
  const d = date ?? new Date();
  const dateStr = d.toISOString().slice(0, 10);
  return `faq-mate-daily-salt-${dateStr}`;
}

function redactText(raw: string): { text: string; wasRedacted: boolean } {
  let text = raw;
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

  return { text, wasRedacted };
}

async function computeQueryHash(text: string, customSalt?: string): Promise<string> {
  const salt = customSalt ?? getDailySalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${text}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sanitizePii(input: string, customSalt?: string): Promise<SanitizerResult>;
export async function sanitizePii(
  input: MultiTurnSanitizerInput,
  customSalt?: string
): Promise<MultiTurnSanitizerResult>;
export async function sanitizePii(
  input: string | MultiTurnSanitizerInput,
  customSalt?: string
): Promise<SanitizerResult | MultiTurnSanitizerResult> {
  if (typeof input === "string") {
    const { text, wasRedacted } = redactText(input);
    const queryHash = await computeQueryHash(text, customSalt);
    return {
      sanitized: text,
      wasRedacted,
      queryHash,
    };
  }

  const queryResult = redactText(input.query);
  let overallRedacted = queryResult.wasRedacted;

  const sanitizedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (input.history && input.history.length > 0) {
    for (const msg of input.history) {
      const msgResult = redactText(msg.content);
      if (msgResult.wasRedacted) {
        overallRedacted = true;
      }
      sanitizedHistory.push({
        role: msg.role,
        content: msgResult.text,
      });
    }
  }

  const queryHash = await computeQueryHash(queryResult.text, customSalt);

  return {
    sanitized: queryResult.text,
    sanitizedQuery: queryResult.text,
    sanitizedHistory,
    wasRedacted: overallRedacted,
    queryHash,
  };
}
