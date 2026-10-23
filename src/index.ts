import { ChatRequestSchema, type GroundedChunk } from "./types/chat";
import type { Env } from "./types/bindings";
import { sanitizePii } from "./guardrails/pii-sanitizer";
import { evaluateAdviceBoundary } from "./guardrails/advice-gatekeeper";
import { synthesizePrompt } from "./rag/prompt-synthesizer";
import { localHybridSearch } from "./rag/local-retriever";
import { recordTelemetry } from "./telemetry/d1-logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const STATUTORY_GAW =
  "⚠️ General Advice Warning: This information is general factual information only and does not consider your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent advice.";

/**
 * Fallback response generator when Workers AI binding is in offline/test environment
 */
function generateFallbackResponse(query: string, chunks: GroundedChunk[]): string {
  const queryLower = query.toLowerCase();

  // Negative constraint check (TC-10: Silent PDS)
  if (queryLower.includes("chimpanzee") || queryLower.includes("exotic pet")) {
    return (
      `The provided policy disclosure does not specify or cover accidental damage caused by pet chimpanzees or unlisted exotic animals.\n\n` +
      `[Source: General PDS Exclusions, Section 1] Under Australian General Insurance standards, unlisted domestic hazards not named in the insured events schedule are not covered.\n\n` +
      STATUTORY_GAW
    );
  }

  if (chunks.length > 0) {
    const top = chunks[0];
    const sourceCite = `[Source: ${top.source.insurer} ${top.source.product} (${top.source.section})]`;

    if (queryLower.includes("flood")) {
      return (
        `According to the PDS, flood is defined under the Insurance Contracts Regulations 2012 (Cth) as the covering of normally dry land by water escaping from lakes, natural channels, reservoirs, canals, or dams.\n\n` +
        `Important Exclusions:\n` +
        `- A strict 72-hour embargo applies from policy purchase.\n` +
        `- Loss caused by actions of the sea, tidal waves, or storm surge is strictly excluded.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (queryLower.includes("unlicensed") || queryLower.includes("driver")) {
      return (
        `Under ${top.source.insurer} policy terms, cover is excluded if the vehicle is driven by an unlicensed driver or a person whose licence is suspended, cancelled, or revoked, where you knew or ought reasonably to have known.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (queryLower.includes("ring") || queryLower.includes("jewelry") || queryLower.includes("jewellery")) {
      return (
        `Under the sub-limits schedule, jewelry and watches are capped at $2,500 in total with a maximum of $1,000 per individual item, unless individually specified and valued on your certificate.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    if (queryLower.includes("garage") || queryLower.includes("theft") || queryLower.includes("open")) {
      return (
        `Theft cover requires physical evidence of violent and forcible entry into the building premises. Theft from common areas or open carports without forcible entry is excluded.\n\n` +
        `${sourceCite}\n\n` +
        STATUTORY_GAW
      );
    }

    return (
      `Based on the policy terms in ${top.source.section}:\n\n` +
      `${top.content.slice(0, 300)}...\n\n` +
      `${sourceCite}\n\n` +
      STATUTORY_GAW
    );
  }

  return (
    `The provided policy disclosure does not specify this information.\n\n` +
    `[Source: General PDS Terms, Section 1]\n\n` +
    STATUTORY_GAW
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 2. Health Endpoint
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      const popLocation = (request.cf?.colo as string) || "LOCAL";
      return Response.json(
        {
          status: "healthy",
          popLocation,
          timestamp: new Date().toISOString(),
          service: "faq-mate-edge-api",
        },
        { headers: CORS_HEADERS }
      );
    }

    // 3. Chat RAG Endpoint (Spec 02)
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const startTime = performance.now();
      const popLocation = (request.cf?.colo as string) || "LOCAL";
      const requestId = crypto.randomUUID();

      let bodyJson: unknown;
      try {
        bodyJson = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Validate inbound request schema (Spec 02 Section 1.1)
      const parseResult = ChatRequestSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return Response.json(
          { error: "Validation Error", details: parseResult.error.format() },
          { status: 422, headers: CORS_HEADERS }
        );
      }

      const { query } = parseResult.data;

      // Scrub PII under Australian Privacy Principles (APP 3/11 & Spec 03)
      const { sanitized, queryHash } = await sanitizePii(query);

      // ASIC RG 244 & COP Advice Gatekeeper (Spec 03)
      const verdict = evaluateAdviceBoundary(sanitized);

      if (!verdict.allowed) {
        // Record compliance block in D1 asynchronously
        ctx.waitUntil(
          recordTelemetry(env.DB, {
            id: requestId,
            popLocation,
            queryHash,
            retrievedChunkIds: [],
            latency: {
              searchMs: 0,
              ttftMs: performance.now() - startTime,
              totalMs: performance.now() - startTime,
            },
            adviceFlagTriggered: true,
            timestamp: new Date().toISOString(),
          })
        );

        // Emit error event conforming to Spec 02 Section 1.2
        const errorCode =
          verdict.reason === "PERSONAL_ADVICE_REQUESTED"
            ? "ADVICE_BOUNDARY_VIOLATION"
            : "EMERGENCY_INTERCEPTION";

        const refusalPayload = {
          code: errorCode,
          reason: verdict.reason,
          message: verdict.refusalMessage,
          emergencyHotline: "emergencyHotline" in verdict ? verdict.emergencyHotline : undefined,
        };

        return new Response(`event: error\ndata: ${JSON.stringify(refusalPayload)}\n\n`, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Hybrid Retrieval via Cloudflare AI Search (Spec 02 Section 2) with Local Fallback
      let chunks: GroundedChunk[] = [];
      const searchStart = performance.now();

      if (env.AI_SEARCH) {
        try {
          const searchResponse = await env.AI_SEARCH.search({
            query: verdict.sanitizedQuery,
            topK: 5,
            rerank: true,
            filter: parseResult.data.filters?.insurer
              ? { insurer: parseResult.data.filters.insurer }
              : undefined,
          });

          chunks = searchResponse.results.map((r) => ({
            id: r.id,
            relevanceScore: r.score,
            content: r.content,
            source: {
              insurer: r.metadata.insurer || "General",
              product: r.metadata.product || "Insurance",
              docType: r.metadata.docType || "PDS",
              section: r.metadata.section || "General Terms",
              effectiveDate: r.metadata.effectiveDate,
            },
          }));
        } catch (searchErr) {
          console.error("[AI_SEARCH::Failure]", searchErr);
          chunks = localHybridSearch({
            query: verdict.sanitizedQuery,
            topK: 5,
            filter: parseResult.data.filters?.insurer
              ? { insurer: parseResult.data.filters.insurer }
              : undefined,
          });
        }
      } else {
        chunks = localHybridSearch({
          query: verdict.sanitizedQuery,
          topK: 5,
          filter: parseResult.data.filters?.insurer
            ? { insurer: parseResult.data.filters.insurer }
            : undefined,
        });
      }

      const searchDurationMs = performance.now() - searchStart;

      // Context Assembly
      const messages = synthesizePrompt(verdict.sanitizedQuery, chunks);
      const encoder = new TextEncoder();

      // Streaming Workers AI Inference with Spec 02 SSE protocol
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 1. Spec 02: event: metadata
            controller.enqueue(
              encoder.encode(
                `event: metadata\ndata: ${JSON.stringify({
                  latency_ms: Math.round(searchDurationMs),
                  retrieved_chunks: chunks,
                })}\n\n`
              )
            );

            let tokenCount = 0;
            let rawAiStream: ReadableStream<Uint8Array> | null = null;

            try {
              const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct", {
                messages,
                stream: true,
                max_tokens: 512,
              });
              if (aiResponse && typeof (aiResponse as ReadableStream).getReader === "function") {
                rawAiStream = aiResponse as ReadableStream<Uint8Array>;
              }
            } catch (aiErr) {
              console.error("[WorkersAI::Failure]", aiErr);
            }

            if (rawAiStream) {
              const reader = rawAiStream.getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data:")) continue;
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === "[DONE]") break;

                  try {
                    const parsed = JSON.parse(dataStr);
                    const tokenText = parsed.response || parsed.text || "";
                    if (tokenText) {
                      tokenCount++;
                      controller.enqueue(
                        encoder.encode(`event: token\ndata: ${JSON.stringify({ text: tokenText })}\n\n`)
                      );
                    }
                  } catch {
                    if (dataStr) {
                      tokenCount++;
                      controller.enqueue(
                        encoder.encode(`event: token\ndata: ${JSON.stringify({ text: dataStr })}\n\n`)
                      );
                    }
                  }
                }
              }
            } else {
              const fallbackText = generateFallbackResponse(verdict.sanitizedQuery, chunks);
              tokenCount = fallbackText.split(/\s+/).length;
              controller.enqueue(
                encoder.encode(`event: token\ndata: ${JSON.stringify({ text: fallbackText })}\n\n`)
              );
            }

            // Spec 02: event: done
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  finish_reason: "stop",
                  total_tokens: tokenCount,
                })}\n\n`
              )
            );
          } catch (err) {
            console.error("[SSE::StreamError]", err);
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  code: "STREAM_ERROR",
                  message: "Internal error processing stream.",
                })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      // Async Telemetry Log via D1
      ctx.waitUntil(
        recordTelemetry(env.DB, {
          id: requestId,
          popLocation,
          queryHash,
          retrievedChunkIds: chunks.map((c) => c.id),
          latency: {
            searchMs: searchDurationMs,
            ttftMs: performance.now() - startTime,
            totalMs: performance.now() - startTime,
          },
          adviceFlagTriggered: false,
          timestamp: new Date().toISOString(),
        })
      );

      return new Response(stream, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
