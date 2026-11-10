-- Migration: 0003_owner_authorization
-- Target: Cloudflare D1 (SQLite)
-- Purpose: record the basis on which an artifact was ingested.
--
--   source_authorization  — a written source approval exists
--   owner_authorization   — project owner accepted the risk for a bounded pilot;
--                           this is NOT a legal reuse determination
--   synthetic_fixture     — test fixture
--
-- Additive only; no data is rewritten.

ALTER TABLE ingestion_runs ADD COLUMN authorization_basis TEXT
  CHECK (authorization_basis IN (
    'source_authorization', 'owner_authorization', 'synthetic_fixture'
  ));

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_authorization_basis
  ON ingestion_runs (authorization_basis);
