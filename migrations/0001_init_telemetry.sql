-- Cloudflare D1 Telemetry & Compliance Audit Schema
-- Migration: 0001_init_telemetry.sql
-- Specification: docs/specs/02-edge-rag-runtime.md & docs/specs/04-afca-eval-benchmarks.md

CREATE TABLE IF NOT EXISTS rag_telemetry_audit (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    pop_location TEXT NOT NULL,         -- e.g. "SYD", "MEL", "BNE", "PER"
    query_hash TEXT NOT NULL,           -- SHA-256 salted query hash for k-anonymity
    retrieved_chunk_ids TEXT NOT NULL,  -- JSON Array of chunk IDs
    search_latency_ms REAL,             -- Time spent in Cloudflare AI Search
    ttft_ms REAL,                       -- Time to first token
    total_duration_ms REAL,             -- End-to-end response stream duration
    groundedness_score REAL,            -- Automated or post-hoc groundedness confidence
    advice_flag_triggered INTEGER DEFAULT 0, -- 1 if ASIC RG 244 boundary was triggered
    user_feedback_score INTEGER         -- 1 (Helpful) or -1 (Disputed / Report Issue)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON rag_telemetry_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_pop ON rag_telemetry_audit(pop_location);
CREATE INDEX IF NOT EXISTS idx_telemetry_advice ON rag_telemetry_audit(advice_flag_triggered);
