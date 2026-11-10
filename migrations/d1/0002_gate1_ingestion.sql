-- Migration: 0002_gate1_ingestion
-- Target: Cloudflare D1 (SQLite)
-- Purpose: Gate 1 legal-data foundation.
--
--   1. Extend document_relationships with the full Gate 1 relationship
--      vocabulary, plus the evidence, effective-date and verification fields
--      required to stop relationships being inferred from similarity alone.
--   2. Add document_chunks, the passage-level retrieval unit deferred from 0001.
--   3. Add ingestion_runs, so every pipeline execution is auditable and
--      idempotent.
--
-- Rebuild note: SQLite cannot alter a CHECK constraint, so the relationships
-- table is rebuilt and copied. Existing rows are preserved. No legal document
-- table is touched.

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------------
-- 1. document_relationships — extended vocabulary + evidence fields
-- ---------------------------------------------------------------------------
CREATE TABLE document_relationships_new (
  id                  TEXT PRIMARY KEY NOT NULL,
  from_document_id    TEXT NOT NULL,
  to_document_id      TEXT NOT NULL,
  relationship_type   TEXT NOT NULL CHECK (relationship_type IN (
                        'AMENDS', 'PARTIALLY_AMENDS', 'REPEALS', 'PARTIALLY_REPEALS',
                        'SUPERSEDES', 'IMPLEMENTS', 'INTERPRETS', 'APPLIES',
                        'DISTINGUISHES', 'REVERSES', 'MODIFIES', 'CITES',
                        'CONSOLIDATES', 'DERIVES_FROM', 'RELATED'
                      )),
  scope               TEXT,
  effective_date      TEXT,
  evidence_passage    TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN (
                        'UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED',
                        'CONFLICT_DETECTED', 'DEFECTIVE_EXTRACTION'
                      )) DEFAULT 'UNVERIFIED',
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (from_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (to_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE
);

INSERT INTO document_relationships_new
  (id, from_document_id, to_document_id, relationship_type, scope, notes, created_at)
SELECT id, from_document_id, to_document_id, relationship_type, scope, notes, created_at
FROM document_relationships;

DROP TABLE document_relationships;
ALTER TABLE document_relationships_new RENAME TO document_relationships;

CREATE INDEX IF NOT EXISTS idx_document_relationships_from_document_id
  ON document_relationships (from_document_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_to_document_id
  ON document_relationships (to_document_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_type
  ON document_relationships (relationship_type);

-- ---------------------------------------------------------------------------
-- 2. document_chunks — passage-level retrieval unit (deferred from 0001)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
  id              TEXT PRIMARY KEY NOT NULL,
  document_id     TEXT NOT NULL,
  version_id      TEXT,
  provision_id    TEXT,
  chunk_kind      TEXT NOT NULL CHECK (chunk_kind IN (
                    'provision', 'paragraph', 'table', 'footnote', 'page'
                  )),
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  token_count     INTEGER,
  char_start      INTEGER,
  char_end        INTEGER,
  page_number     INTEGER,
  embedding_id    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES document_versions (id) ON DELETE CASCADE,
  FOREIGN KEY (provision_id) REFERENCES legal_provisions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_version_id
  ON document_chunks (version_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_provision_id
  ON document_chunks (provision_id);

-- ---------------------------------------------------------------------------
-- 3. ingestion_runs — one auditable execution of the pipeline per artifact
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                  TEXT PRIMARY KEY NOT NULL,
  input_content_hash  TEXT NOT NULL,
  source_id           TEXT NOT NULL,
  pipeline_version    TEXT NOT NULL,
  extractor_version   TEXT NOT NULL,
  normalizer_version  TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN (
                        'SUCCEEDED', 'DUPLICATE', 'FAILED', 'IDENTITY_AMBIGUOUS'
                      )),
  document_id         TEXT,
  version_id          TEXT,
  manifest_id         TEXT,
  failure_reason      TEXT,
  started_at          TEXT NOT NULL,
  finished_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_input_hash
  ON ingestion_runs (input_content_hash, source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status
  ON ingestion_runs (status);

PRAGMA foreign_keys = ON;
