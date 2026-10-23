-- Cloudflare D1 Telemetry & Compliance Audit Schema
-- Migration: 0001_init_telemetry.sql
-- Specification: PRD.md § 6.4 & docs/specs/02-edge-rag-runtime.md

CREATE TABLE IF NOT EXISTS rag_telemetry_audit (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    pop_location TEXT NOT NULL,                  -- e.g. "SYD", "MEL", "BNE", "PER"
    query_hash TEXT NOT NULL,                    -- SHA-256 salted query hash for k-anonymity (PRD § 5.4)
    retrieved_chunk_ids TEXT NOT NULL,           -- JSON Array of chunk IDs
    hybrid_retrieval_latency_ms REAL,            -- Time spent in Cloudflare AI Search (ms)
    inference_ttft_ms REAL,                      -- Time to first token (ms)
    total_duration_ms REAL,                      -- End-to-end response stream duration (ms)
    groundedness_score REAL DEFAULT 1.0,         -- Groundedness confidence score [0.0 - 1.0]
    advice_flag_triggered INTEGER DEFAULT 0,     -- 1 if ASIC RG 244 boundary was triggered
    user_feedback_score INTEGER                  -- 1 (Helpful) or -1 (Disputed / Report Issue)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON rag_telemetry_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_pop ON rag_telemetry_audit(pop_location);
CREATE INDEX IF NOT EXISTS idx_telemetry_advice ON rag_telemetry_audit(advice_flag_triggered);
