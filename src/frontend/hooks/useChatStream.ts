import { useCallback, useRef, useState } from "react";
import { stripStatutoryGaw } from "../../constants/statutory";
import type {
  ChatMessage,
  GroundedChunk,
  RateLimitInfo,
  RefusalPayload,
  SendMessageOptions,
  StreamState,
  TelemetryInfo,
  UseChatStreamOptions,
  UseChatStreamReturn,
} from "../types/chat-ui";
import { sanitizeClientPii } from "../utils/client-pii-scrubber";

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  limit: 10,
  remaining: 10,
  resetSeconds: 60,
};

export function useChatStream(options?: UseChatStreamOptions): UseChatStreamReturn {
  const apiEndpoint = options?.apiEndpoint || "/api/chat";

  const [messages, setMessages] = useState<ChatMessage[]>(options?.initialMessages || []);
  const [status, setStatus] = useState<StreamState>("IDLE");
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>(DEFAULT_RATE_LIMIT);
  const [telemetry, setTelemetry] = useState<TelemetryInfo>({});
  const [citations, setCitations] = useState<GroundedChunk[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<GroundedChunk | null>(null);
  const [activeRefusal, setActiveRefusal] = useState<RefusalPayload | null>(null);

  const statusRef = useRef<StreamState>("IDLE");
  statusRef.current = status;

  const reset = useCallback(() => {
    setStatus("IDLE");
    statusRef.current = "IDLE";
    setMessages([]);
    setCitations([]);
    setSelectedCitation(null);
    setActiveRefusal(null);
    setTelemetry({});
  }, []);

  const sendMessage = useCallback(
    async (query: string, sendOptions?: SendMessageOptions) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return;
      }

      if (statusRef.current === "CONNECTING" || statusRef.current === "STREAMING") {
        return;
      }

      // Pre-ingress client-side PII sanitization (APP 3 & 11)
      const { sanitized: cleanQuery } = sanitizeClientPii(trimmedQuery);

      // Clear previous refusal and citations for the new turn
      setActiveRefusal(null);
      setCitations([]);
      setSelectedCitation(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: cleanQuery,
        timestamp: Date.now(),
        insurer: sendOptions?.insurer,
      };

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setStatus("CONNECTING");
      statusRef.current = "CONNECTING";

      const dispatchTime = performance.now();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (sendOptions?.turnstileToken) {
        headers["X-Turnstile-Token"] = sendOptions.turnstileToken;
      }

      // Ephemeral multi-turn context carry-over (up to 4 turns, Spec 07 Section 1)
      const historyTurns = messages
        .filter((m) => m.content.trim().length > 0 && !m.refusal)
        .slice(-4)
        .map((m) => ({
          role: m.role,
          content: (m.role === "assistant" ? stripStatutoryGaw(m.content) : m.content).slice(
            0,
            1000
          ),
        }));

      const bodyPayload: Record<string, unknown> = {
        query: cleanQuery,
        conversationId: crypto.randomUUID(),
      };

      if (historyTurns.length > 0) {
        bodyPayload.history = historyTurns;
      }

      if (sendOptions?.insurer && sendOptions.insurer.toLowerCase() !== "all") {
        bodyPayload.filters = {
          insurer: sendOptions.insurer.toUpperCase(),
        };
      }

      if (sendOptions?.turnstileToken) {
        bodyPayload.turnstileToken = sendOptions.turnstileToken;
      }

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
        });

        // 1. Parse Rate-Limit headers
        const limitHeader = response.headers.get("X-RateLimit-Limit");
        const remainingHeader = response.headers.get("X-RateLimit-Remaining");
        const resetHeader = response.headers.get("X-RateLimit-Reset");

        if (limitHeader !== null || remainingHeader !== null || resetHeader !== null) {
          setRateLimit((prev) => ({
            limit: limitHeader !== null ? parseInt(limitHeader, 10) : prev.limit,
            remaining: remainingHeader !== null ? parseInt(remainingHeader, 10) : prev.remaining,
            resetSeconds: resetHeader !== null ? parseInt(resetHeader, 10) : prev.resetSeconds,
          }));
        }

        // 2. Extract Cloudflare Anycast PoP
        const cfRay = response.headers.get("cf-ray");
        const popFromRay = cfRay?.match(/-([A-Z]{3,4})$/)?.[1];
        const popLocation = response.headers.get("x-pop") || popFromRay;
        if (popLocation) {
          setTelemetry((prev) => ({ ...prev, popLocation }));
        }

        // 3. Handle Rate-Limit Throttling (HTTP 429)
        if (response.status === 429) {
          setStatus("THROTTLED");
          statusRef.current = "THROTTLED";
          return;
        }

        if (!response.body) {
          setStatus("COMPLETED");
          statusRef.current = "COMPLETED";
          return;
        }

        // 4. SSE Stream Processing
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let firstTokenReceived = false;

        const processEventBlock = (eventBlock: string) => {
          const lines = eventBlock.split(/\r?\n/);
          let eventType = "message";
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          const dataString = dataLines.join("\n");
          if (!dataString) return;

          let parsedData: any;
          try {
            parsedData = JSON.parse(dataString);
          } catch {
            parsedData = dataString;
          }

          if (eventType === "metadata") {
            setStatus("METADATA_RECEIVED");
            statusRef.current = "METADATA_RECEIVED";
            const retrievedChunks: GroundedChunk[] = parsedData.retrieved_chunks || [];
            const suggestedFollowUps: string[] = parsedData.suggested_follow_ups || [];
            setCitations(retrievedChunks);
            setTelemetry((prev) => ({
              ...prev,
              latencyMs: parsedData.latency_ms,
              popLocation: popLocation || prev.popLocation,
            }));
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        latencyMs: parsedData.latency_ms,
                        retrievedChunks,
                        popLocation: popLocation || msg.metadata?.popLocation,
                        suggestedFollowUps,
                      },
                    }
                  : msg
              )
            );
          } else if (eventType === "token") {
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              const ttftMs = Math.max(0, Math.round(performance.now() - dispatchTime));
              setTelemetry((prev) => ({ ...prev, ttftMs }));
              setStatus("STREAMING");
              statusRef.current = "STREAMING";
            }
            const tokenText =
              typeof parsedData === "object" && parsedData !== null
                ? (parsedData.text ?? "")
                : String(parsedData);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: msg.content + tokenText } : msg
              )
            );
          } else if (eventType === "done") {
            const suggestedFollowUps: string[] = parsedData.suggested_follow_ups || [];
            if (suggestedFollowUps.length > 0) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        metadata: {
                          ...msg.metadata,
                          suggestedFollowUps:
                            msg.metadata?.suggestedFollowUps &&
                            msg.metadata.suggestedFollowUps.length > 0
                              ? msg.metadata.suggestedFollowUps
                              : suggestedFollowUps,
                        },
                      }
                    : msg
                )
              );
            }
            setStatus("COMPLETED");
            statusRef.current = "COMPLETED";
          } else if (eventType === "error") {
            const refusalPayload: RefusalPayload =
              typeof parsedData === "object" && parsedData !== null
                ? (parsedData as RefusalPayload)
                : { code: "ERROR", message: String(parsedData) };

            if (
              refusalPayload.code === "ADVICE_BOUNDARY_VIOLATION" ||
              refusalPayload.code === "EMERGENCY_INTERCEPTION"
            ) {
              setStatus("REFUSAL_BLOCKED");
              statusRef.current = "REFUSAL_BLOCKED";
              setActiveRefusal(refusalPayload);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: refusalPayload.message,
                        refusal: refusalPayload,
                      }
                    : msg
                )
              );
            } else {
              setStatus("COMPLETED");
              statusRef.current = "COMPLETED";
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() ?? "";

          for (const eventBlock of parts) {
            processEventBlock(eventBlock);
          }
        }

        if (buffer.trim()) {
          processEventBlock(buffer.trim());
        }

        // Finalize status if still in transient streaming states
        if (
          statusRef.current === "CONNECTING" ||
          statusRef.current === "METADATA_RECEIVED" ||
          statusRef.current === "STREAMING"
        ) {
          setStatus("COMPLETED");
          statusRef.current = "COMPLETED";
        }
      } catch (err) {
        console.error("[useChatStream] Execution failed:", err);
        setStatus("COMPLETED");
        statusRef.current = "COMPLETED";
      }
    },
    [apiEndpoint]
  );

  return {
    messages,
    status,
    rateLimit,
    telemetry,
    citations,
    selectedCitation,
    setSelectedCitation,
    activeRefusal,
    sendMessage,
    reset,
  };
}
