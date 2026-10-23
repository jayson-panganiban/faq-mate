import type { TelemetryRecord } from "../types/chat";

/**
 * Deep Module: Edge Telemetry & Compliance Auditor
 *
 * Implements PRD § 6.4 and Spec 02:
 * Conceals D1 statement preparation, JSON serialization, and error recovery
 * behind a single non-blocking interface.
 */
export async function recordTelemetry(
  db: D1Database | undefined,
  record: TelemetryRecord
): Promise<void> {
  if (!db) {
    // In local dev without mock D1 binding, log cleanly without throwing
    console.debug("[Telemetry::DryRun]", JSON.stringify(record));
    return;
  }

  const searchMs = record.latency.hybridRetrievalLatencyMs ?? record.latency.searchMs ?? 0;
  const ttftMs = record.latency.inferenceTtftMs ?? record.latency.ttftMs ?? 0;
  const groundedness = record.groundednessScore ?? 1.0;

  try {
    await db
      .prepare(
        `INSERT INTO rag_telemetry_audit (
          id, pop_location, query_hash, retrieved_chunk_ids,
          hybrid_retrieval_latency_ms, inference_ttft_ms, total_duration_ms,
          groundedness_score, advice_flag_triggered
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.popLocation,
        record.queryHash,
        JSON.stringify(record.retrievedChunkIds),
        searchMs,
        ttftMs,
        record.latency.totalMs,
        groundedness,
        record.adviceFlagTriggered ? 1 : 0
      )
      .run();
  } catch (err) {
    // Never allow telemetry failures to bubble up or disrupt client SSE streams
    console.error("[Telemetry::WriteError]", err);
  }
}
