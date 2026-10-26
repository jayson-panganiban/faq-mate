import { z } from "zod";
import { resolveInsurer } from "../constants/insurers";

/**
 * Multi-Turn Conversation History Item (Spec 07 Section 1)
 */
export const ChatMessageHistorySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty")
    .max(1000, "Message content exceeds 1000 characters"),
});

export type ChatMessageHistory = z.infer<typeof ChatMessageHistorySchema>;

/**
 * Validated Inbound Chat Request Schema (Spec 02 Section 1.1 & Spec 07 Section 1)
 */
export const ChatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Query must be at least 2 characters")
    .max(500, "Query exceeds 500 characters"),
  conversationId: z.string().uuid("Invalid conversation UUID"),
  history: z.array(ChatMessageHistorySchema).max(4, "History cannot exceed 4 messages").optional(),
  filters: z
    .object({
      insurer: z
        .string()
        .trim()
        .refine((val) => resolveInsurer(val) !== null, {
          message: "Unsupported insurer brand or code",
        })
        .optional(),
      product: z.string().optional(),
      docType: z.enum(["PDS", "TMD", "SPDS", "FSG", "FAQ", "GUIDE"]).default("PDS"),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type GatekeeperIntent =
  | "FACTUAL_PRODUCT_INQUIRY"
  | "TMD_ELIGIBILITY_INQUIRY"
  | "CONVERSATIONAL_DILEMMA";

/**
 * Gatekeeper Verdict for ASIC RG 244 Compliance
 */
export type GatekeeperVerdict =
  | {
      allowed: true;
      sanitizedQuery: string;
      detectedPeril?: string;
      detectedIntent?: GatekeeperIntent;
    }
  | {
      allowed: false;
      reason: "PERSONAL_ADVICE_REQUESTED" | "EMERGENCY_LIFE_SAFETY" | "MALICIOUS_PROMPT";
      refusalMessage: string;
      emergencyHotline?: string;
    };

/**
 * Normalized Retrieval Chunk from Cloudflare AI Search
 */
export interface GroundedChunk {
  id: string;
  relevanceScore: number;
  content: string;
  source: {
    insurer: string;
    product: string;
    docType: string;
    section: string;
    clauseId?: string;
    effectiveDate?: string;
  };
}

/**
 * D1 Telemetry Audit Record Schema (PRD § 6.4)
 */
export interface TelemetryRecord {
  id: string;
  popLocation: string;
  queryHash: string;
  retrievedChunkIds: string[];
  latency: {
    hybridRetrievalLatencyMs: number;
    inferenceTtftMs: number;
    totalMs: number;
    searchMs?: number;
    ttftMs?: number;
  };
  groundednessScore?: number;
  adviceFlagTriggered: boolean;
  timestamp: string;
}
