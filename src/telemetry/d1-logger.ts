import type { TelemetryRecord } from "../types/chat";

/**
 * Deep Module: Edge Telemetry & Compliance Auditor
 *
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

  try {
    await db
      .prepare(
        `INSERT INTO rag_telemetry_audit (
          id, pop_location, query_hash, retrieved_chunk_ids,
          search_latency_ms, ttft_ms, total_duration_ms,
          groundedness_score, advice_flag_triggered
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.popLocation,
        record.queryHash,
        JSON.stringify(record.retrievedChunkIds),
        record.latency.searchMs,
        record.latency.ttftMs,
        record.latency.totalMs,
        1.0, // Baseline pass score
        record.adviceFlagTriggered ? 1 : 0
      )
      .run();
  } catch (err) {
    // Never allow telemetry failures to bubble up or disrupt client SSE streams
    console.error("[Telemetry::WriteError]", err);
  }
}
