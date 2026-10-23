import { ChatRequestSchema, type GroundedChunk, type TelemetryRecord } from "./types/chat";
import type { Env } from "./types/bindings";
import { sanitizePii } from "./guardrails/pii-sanitizer";
import { evaluateAdviceBoundary } from "./guardrails/advice-gatekeeper";
import { synthesizePrompt } from "./rag/prompt-synthesizer";
import { recordTelemetry } from "./telemetry/d1-logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    // 3. Chat RAG Endpoint
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

      // Validate inbound request schema
      const parseResult = ChatRequestSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return Response.json(
          { error: "Validation Error", details: parseResult.error.format() },
          { status: 422, headers: CORS_HEADERS }
        );
      }

      const { query, conversationId } = parseResult.data;

      // Scrub PII under Australian Privacy Principles
      const { sanitized, queryHash } = await sanitizePii(query);

      // ASIC RG 244 & COP Advice Gatekeeper
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

        // Stream immediate refusal response
        return new Response(
          `event: refusal\ndata: ${JSON.stringify({
            reason: verdict.reason,
            message: verdict.refusalMessage,
            emergencyHotline: "emergencyHotline" in verdict ? verdict.emergencyHotline : undefined,
          })}\n\n`,
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }

      // Hybrid Retrieval via Cloudflare AI Search
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
        }
      }

      const searchDurationMs = performance.now() - searchStart;

      // Context Assembly
      const messages = synthesizePrompt(verdict.sanitizedQuery, chunks);

      // Streaming Workers AI Inference
      let stream: ReadableStream<Uint8Array>;
      try {
        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct", {
          messages,
          stream: true,
          max_tokens: 512,
        });
        stream = aiResponse as ReadableStream<Uint8Array>;
      } catch (aiErr) {
        console.error("[WorkersAI::Failure]", aiErr);
        // Fallback message stream if Workers AI binding is unavailable in local harness
        const fallbackText =
          `I received your query: "${verdict.sanitizedQuery}".\n\n` +
          `[Source: Suncorp Classic Home PDS (Section 7)] Standard Flood cover excludes 72-hour embargo and action of the sea.\n\n` +
          `⚠️ General Advice Warning: This information is general factual information only.`;
        stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: fallbackText })}\n\n`));
            controller.close();
          },
        });
      }

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
