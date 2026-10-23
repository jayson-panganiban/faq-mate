import { z } from "zod";

/**
 * Validated Inbound Chat Request Schema (Spec 02 Section 1.1)
 */
export const ChatRequestSchema = z.object({
  query: z.string().trim().min(3, "Query must be at least 3 characters").max(500, "Query exceeds 500 characters"),
  conversationId: z.string().uuid("Invalid conversation UUID"),
  filters: z
    .object({
      insurer: z.enum(["NRMA", "SUNCORP", "ALLIANZ", "QBE", "YOUI"]).optional(),
      product: z.string().optional(),
      docType: z.enum(["PDS", "TMD", "SPDS"]).default("PDS"),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Gatekeeper Verdict for ASIC RG 244 Compliance
 */
export type GatekeeperVerdict =
  | {
      allowed: true;
      sanitizedQuery: string;
      detectedPeril?: string;
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
 * D1 Telemetry Audit Record Schema
 */
export interface TelemetryRecord {
  id: string;
  popLocation: string;
  queryHash: string;
  retrievedChunkIds: string[];
  latency: {
    searchMs: number;
    ttftMs: number;
    totalMs: number;
  };
  adviceFlagTriggered: boolean;
  timestamp: string;
}
