-- Migration: 0001_legal_documents
-- Target: Cloudflare D1 (SQLite)
-- Purpose: Core four-object legal data model — source, canonical, extracted, chunks.
--
-- The TEXT CHECK IN (...) constraints below are the database-level mirror of the
-- enumerations in packages/legal-schema/src/taxonomy.ts. Keep them in lockstep.
-- See docs/architecture/LEGAL_DATA_MODEL.md and LEGAL_TEMPORAL_MODEL.md.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Object 2 (canonical): legal_documents
-- The identity of a legal instrument, independent of any file or source.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_documents (
  id                  TEXT PRIMARY KEY NOT NULL,
  document_type       TEXT NOT NULL CHECK (document_type IN (
                        'CONSTITUTION', 'STATUTE', 'REPUBLIC_ACT', 'COMMONWEALTH_ACT',
                        'PRESIDENTIAL_DECREE', 'BATAS_PAMBANSA', 'EXECUTIVE_ORDER',
                        'ADMINISTRATIVE_ORDER', 'COURT_DECISION', 'SIGNED_RESOLUTION',
                        'COURT_RULE', 'COURT_CIRCULAR', 'AGENCY_REGULATION',
                        'ADMINISTRATIVE_DECISION', 'TREATY', 'LOCAL_ORDINANCE',
                        'LEGAL_REFERENCE'
                      )),
  title               TEXT NOT NULL,
  short_title         TEXT,
  citation_text       TEXT,
  docket_number       TEXT,
  issuing_body        TEXT,
  jurisdiction        TEXT,
  promulgation_date   TEXT,
  approval_date       TEXT,
  publication_date    TEXT,
  effectivity_date    TEXT,
  amendment_date      TEXT,
  repeal_date         TEXT,
  legal_status        TEXT NOT NULL CHECK (legal_status IN (
                        'UNKNOWN', 'IN_FORCE', 'PARTIALLY_AMENDED', 'AMENDED',
                        'REPEALED', 'SUPERSEDED', 'EXPIRED', 'NOT_YET_EFFECTIVE',
                        'UNDER_REVIEW'
                      )) DEFAULT 'UNKNOWN',
  verification_status TEXT NOT NULL CHECK (verification_status IN (
                        'UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED',
                        'CONFLICT_DETECTED', 'DEFECTIVE_EXTRACTION'
                      )) DEFAULT 'UNVERIFIED',
  authority_level     TEXT NOT NULL CHECK (authority_level IN (
                        'official_primary', 'official_secondary', 'unofficial'
                      )) DEFAULT 'unofficial',
  source_id           TEXT,
  identity_key        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_document_type
  ON legal_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_source_id
  ON legal_documents (source_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_promulgation_date
  ON legal_documents (promulgation_date);
CREATE INDEX IF NOT EXISTS idx_legal_documents_docket_number
  ON legal_documents (docket_number);
CREATE INDEX IF NOT EXISTS idx_legal_documents_verification_status
  ON legal_documents (verification_status);
CREATE INDEX IF NOT EXISTS idx_legal_documents_legal_status
  ON legal_documents (legal_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_identity_key
  ON legal_documents (identity_key) WHERE identity_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Object 2 (canonical): document_versions
-- Authoritative, immutable versions of a document. Amendments add rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_versions (
  id              TEXT PRIMARY KEY NOT NULL,
  document_id     TEXT NOT NULL,
  version_number  INTEGER NOT NULL,
  version_label   TEXT,
  content_hash    TEXT NOT NULL,
  effective_from  TEXT,
  effective_to    TEXT,
  is_current      INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  change_summary  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (document_id, version_number),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
  ON document_versions (document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_effective_from
  ON document_versions (effective_from);
CREATE INDEX IF NOT EXISTS idx_document_versions_is_current
  ON document_versions (document_id, is_current);

-- ---------------------------------------------------------------------------
-- Object 1 (source): source_manifestations
-- One retrieval of a document from one source. Many per canonical document.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_manifestations (
  id                  TEXT PRIMARY KEY NOT NULL,
  document_id         TEXT,
  source_id           TEXT NOT NULL,
  source_url          TEXT NOT NULL,
  source_type         TEXT NOT NULL,
  authority_level     TEXT NOT NULL CHECK (authority_level IN (
                        'official_primary', 'official_secondary', 'unofficial'
                      )) DEFAULT 'unofficial',
  acquisition_status  TEXT NOT NULL CHECK (acquisition_status IN (
                        'Approved', 'Restricted', 'Manual', 'Pending', 'Rejected'
                      )) DEFAULT 'Pending',
  mime_type           TEXT,
  file_size_bytes     INTEGER,
  storage_key         TEXT,
  content_hash        TEXT,
  is_primary          INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  retrieved_at        TEXT NOT NULL,
  retrieved_by        TEXT,
  retrieval_status    TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_manifestations_document_id
  ON source_manifestations (document_id);
CREATE INDEX IF NOT EXISTS idx_source_manifestations_source_id
  ON source_manifestations (source_id);
CREATE INDEX IF NOT EXISTS idx_source_manifestations_content_hash
  ON source_manifestations (content_hash);

-- ---------------------------------------------------------------------------
-- Edges: document_citations
-- source_document_id cites target_document_id, with the raw citation text.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_citations (
  id                  TEXT PRIMARY KEY NOT NULL,
  source_document_id  TEXT NOT NULL,
  target_document_id  TEXT NOT NULL,
  citation_text       TEXT NOT NULL,
  location            TEXT,
  page_number         INTEGER,
  context             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (target_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_citations_source_document_id
  ON document_citations (source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_citations_target_document_id
  ON document_citations (target_document_id);

-- ---------------------------------------------------------------------------
-- Edges: document_relationships
-- Typed, directed edges (amends, repeals, implements, interprets, ...).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_relationships (
  id                  TEXT PRIMARY KEY NOT NULL,
  from_document_id    TEXT NOT NULL,
  to_document_id      TEXT NOT NULL,
  relationship_type   TEXT NOT NULL CHECK (relationship_type IN (
                        'AMENDS', 'REPEALS', 'SUPERSEDES', 'IMPLEMENTS', 'INTERPRETS',
                        'CITES', 'CONSOLIDATES', 'DERIVES_FROM', 'RELATED'
                      )),
  scope               TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (from_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (to_document_id) REFERENCES legal_documents (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_relationships_from_document_id
  ON document_relationships (from_document_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_to_document_id
  ON document_relationships (to_document_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_type
  ON document_relationships (relationship_type);

-- ---------------------------------------------------------------------------
-- Object 3 (extracted): legal_provisions
-- The unit of provision-level amendment tracking. Each row belongs to a version.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_provisions (
  id                      TEXT PRIMARY KEY NOT NULL,
  document_id             TEXT NOT NULL,
  version_id              TEXT NOT NULL,
  provision_type          TEXT NOT NULL CHECK (provision_type IN (
                            'PREAMBLE', 'ARTICLE', 'SECTION', 'RULE', 'PARAGRAPH',
                            'SUBPARAGRAPH', 'CLAUSE', 'ITEM'
                          )),
  label                   TEXT NOT NULL,
  heading                 TEXT,
  text                    TEXT NOT NULL,
  ordinal                 INTEGER NOT NULL,
  parent_provision_id     TEXT,
  legal_status            TEXT NOT NULL CHECK (legal_status IN (
                            'UNKNOWN', 'IN_FORCE', 'PARTIALLY_AMENDED', 'AMENDED',
                            'REPEALED', 'SUPERSEDED', 'EXPIRED', 'NOT_YET_EFFECTIVE',
                            'UNDER_REVIEW'
                          )) DEFAULT 'UNKNOWN',
  effective_from          TEXT,
  effective_to            TEXT,
  amended_by_document_id  TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES document_versions (id) ON DELETE CASCADE,
  FOREIGN KEY (parent_provision_id) REFERENCES legal_provisions (id) ON DELETE SET NULL,
  FOREIGN KEY (amended_by_document_id) REFERENCES legal_documents (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_legal_provisions_document_id
  ON legal_provisions (document_id);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_version_id
  ON legal_provisions (version_id);
CREATE INDEX IF NOT EXISTS idx_legal_provisions_amended_by_document_id
  ON legal_provisions (amended_by_document_id);

-- ---------------------------------------------------------------------------
-- Extraction: extraction_jobs
-- Tracks the extraction (and OCR) of one manifestation into text.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id                  TEXT PRIMARY KEY NOT NULL,
  manifestation_id    TEXT NOT NULL,
  document_id         TEXT,
  status              TEXT NOT NULL CHECK (status IN (
                        'queued', 'running', 'succeeded', 'failed', 'quarantined'
                      )) DEFAULT 'queued',
  parser_version      TEXT,
  ocr_used            INTEGER NOT NULL DEFAULT 0 CHECK (ocr_used IN (0, 1)),
  ocr_confidence      REAL,
  page_count          INTEGER,
  error_message       TEXT,
  started_at          TEXT,
  finished_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (manifestation_id) REFERENCES source_manifestations (id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_manifestation_id
  ON extraction_jobs (manifestation_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status
  ON extraction_jobs (status);

-- ---------------------------------------------------------------------------
-- Verification: verification_records
-- Immutable audit of trust state changes for a document.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_records (
  id                      TEXT PRIMARY KEY NOT NULL,
  document_id             TEXT NOT NULL,
  verification_status     TEXT NOT NULL CHECK (verification_status IN (
                            'UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED',
                            'CONFLICT_DETECTED', 'DEFECTIVE_EXTRACTION'
                          )),
  method                  TEXT NOT NULL CHECK (method IN (
                            'automated', 'manual', 'cross_source', 'operator_asserted'
                          )),
  source_manifestation_id TEXT,
  verified_by             TEXT,
  verified_at             TEXT,
  findings                TEXT,
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES legal_documents (id) ON DELETE CASCADE,
  FOREIGN KEY (source_manifestation_id) REFERENCES source_manifestations (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_records_document_id
  ON verification_records (document_id);
CREATE INDEX IF NOT EXISTS idx_verification_records_status
  ON verification_records (verification_status);
