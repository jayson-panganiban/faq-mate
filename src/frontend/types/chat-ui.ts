import type { GroundedChunk } from "../../types/chat";

export type StreamState =
  | "IDLE"
  | "CONNECTING"
  | "METADATA_RECEIVED"
  | "STREAMING"
  | "COMPLETED"
  | "REFUSAL_BLOCKED"
  | "THROTTLED";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface TelemetryInfo {
  latencyMs?: number;
  ttftMs?: number;
  popLocation?: string;
  hybrid_retrieval_latency_ms?: number;
  inference_ttft_ms?: number;
}

export interface RefusalPayload {
  code: "ADVICE_BOUNDARY_VIOLATION" | "EMERGENCY_INTERCEPTION" | string;
  message: string;
  reason?: string;
  emergencyHotline?: string | string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  insurer?: string;
  metadata?: {
    latencyMs?: number;
    retrievedChunks?: GroundedChunk[];
    popLocation?: string;
    suggestedFollowUps?: string[];
  };
  refusal?: RefusalPayload | null;
}

export interface UseChatStreamOptions {
  apiEndpoint?: string;
  initialMessages?: ChatMessage[];
}

export interface SendMessageOptions {
  insurer?: string;
  turnstileToken?: string;
}

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  status: StreamState;
  rateLimit: RateLimitInfo;
  telemetry: TelemetryInfo;
  citations: GroundedChunk[];
  selectedCitation: GroundedChunk | null;
  setSelectedCitation: (chunk: GroundedChunk | null) => void;
  activeRefusal: RefusalPayload | null;
  sendMessage: (query: string, options?: SendMessageOptions) => Promise<void>;
  reset: () => void;
}

export type { GroundedChunk };
