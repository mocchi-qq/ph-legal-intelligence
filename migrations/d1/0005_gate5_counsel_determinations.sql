-- Migration: 0005_gate5_counsel_determinations
-- Target: Cloudflare D1 (SQLite)
-- Purpose: durable counsel identity, determination, activity-decision and audit
-- records for Gate 5. Additive only; no Gate 1–4 row is rewritten or deleted.
--
-- Records are immutable. Status transitions, supersession and revocation are
-- appended to counsel_audit_events. A determination is usable only when it is
-- VERIFIED_FOR_RECORDING and its counsel identity is VERIFIED.

CREATE TABLE IF NOT EXISTS counsel_professionals (
  id                        TEXT PRIMARY KEY NOT NULL,
  name                      TEXT NOT NULL,
  firm                      TEXT,
  jurisdiction              TEXT NOT NULL,
  capacity                  TEXT NOT NULL,
  verification_status       TEXT NOT NULL CHECK (verification_status IN (
                              'UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'
                            )),
  verification_evidence_ref TEXT,
  verified_by               TEXT,
  verified_at               TEXT,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    verification_status != 'VERIFIED'
    OR (verification_evidence_ref IS NOT NULL AND verified_by IS NOT NULL
        AND verified_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS counsel_determinations (
  id                     TEXT PRIMARY KEY NOT NULL,
  source_id              TEXT NOT NULL,
  document_scope_json    TEXT NOT NULL,
  counsel_id             TEXT NOT NULL,
  date_received          TEXT NOT NULL,
  date_issued            TEXT,
  effective_date         TEXT,
  expiry_date            TEXT,
  status                 TEXT NOT NULL CHECK (status IN (
                           'NOT_RECEIVED', 'RECEIVED_UNVERIFIED',
                           'IDENTITY_UNVERIFIED', 'EVIDENCE_INCOMPLETE',
                           'SCOPE_AMBIGUOUS', 'REVIEW_REQUIRED',
                           'VERIFIED_FOR_RECORDING', 'SUPERSEDED', 'REVOKED'
                         )),
  scope                  TEXT NOT NULL,
  evidence_refs_json     TEXT NOT NULL,
  decision_document_ref  TEXT,
  decision_document_hash TEXT,
  recorded_by            TEXT NOT NULL,
  supersedes_id          TEXT,
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (expiry_date IS NULL OR effective_date IS NULL
         OR expiry_date > effective_date),
  CHECK (decision_document_hash IS NULL OR length(decision_document_hash) = 64),
  CHECK (
    status != 'VERIFIED_FOR_RECORDING'
    OR (date_issued IS NOT NULL AND decision_document_ref IS NOT NULL
        AND evidence_refs_json IS NOT NULL AND length(trim(evidence_refs_json)) > 2)
  ),
  FOREIGN KEY (counsel_id) REFERENCES counsel_professionals (id),
  FOREIGN KEY (supersedes_id) REFERENCES counsel_determinations (id)
);

CREATE INDEX IF NOT EXISTS idx_counsel_determinations_source
  ON counsel_determinations (source_id, status);
CREATE INDEX IF NOT EXISTS idx_counsel_determinations_counsel
  ON counsel_determinations (counsel_id);

CREATE TABLE IF NOT EXISTS counsel_activity_decisions (
  id              TEXT PRIMARY KEY NOT NULL,
  determination_id TEXT NOT NULL,
  activity        TEXT NOT NULL CHECK (activity IN (
                    'viewing', 'downloading', 'temporary_processing',
                    'temporary_local_storage', 'persistent_storage',
                    'text_extraction', 'ocr', 'search_indexing',
                    'embedding_generation', 'ai_assisted_analysis',
                    'citation_display', 'quotation', 'substantial_reproduction',
                    'redistribution', 'commercial_use', 'retention'
                  )),
  status          TEXT NOT NULL CHECK (status IN (
                    'APPROVED', 'APPROVED_WITH_CONDITIONS', 'RESTRICTED',
                    'PROHIBITED', 'UNRESOLVED'
                  )),
  scope           TEXT,
  conditions_json TEXT,
  limitations_json TEXT,
  permitted_users_json TEXT,
  effective_date  TEXT,
  expiry_date     TEXT,
  evidence_ref    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    status != 'APPROVED_WITH_CONDITIONS'
    OR (conditions_json IS NOT NULL AND length(trim(conditions_json)) > 2)
  ),
  UNIQUE (determination_id, activity),
  FOREIGN KEY (determination_id) REFERENCES counsel_determinations (id)
);

CREATE INDEX IF NOT EXISTS idx_counsel_activity_determination
  ON counsel_activity_decisions (determination_id);
CREATE INDEX IF NOT EXISTS idx_counsel_activity_activity
  ON counsel_activity_decisions (activity, status);

CREATE TABLE IF NOT EXISTS counsel_audit_events (
  id                TEXT PRIMARY KEY NOT NULL,
  determination_id  TEXT,
  counsel_id        TEXT,
  action            TEXT NOT NULL CHECK (action IN (
                      'COUNSEL_REGISTERED', 'DETERMINATION_RECORDED',
                      'STATUS_CHANGED', 'SUPERSEDED', 'REVOKED'
                    )),
  previous_status   TEXT,
  new_status        TEXT,
  actor             TEXT NOT NULL,
  changed_at        TEXT NOT NULL,
  reason            TEXT NOT NULL,
  evidence_ref      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_counsel_audit_determination
  ON counsel_audit_events (determination_id, changed_at);

-- Immutable records and append-only audit. No normal SQL may rewrite history.
CREATE TRIGGER IF NOT EXISTS trg_counsel_professionals_no_update
BEFORE UPDATE ON counsel_professionals
BEGIN
  SELECT RAISE(ABORT, 'counsel_professionals is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_professionals_no_delete
BEFORE DELETE ON counsel_professionals
BEGIN
  SELECT RAISE(ABORT, 'counsel_professionals is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_determinations_no_update
BEFORE UPDATE ON counsel_determinations
BEGIN
  SELECT RAISE(ABORT, 'counsel_determinations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_determinations_no_delete
BEFORE DELETE ON counsel_determinations
BEGIN
  SELECT RAISE(ABORT, 'counsel_determinations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_activity_no_update
BEFORE UPDATE ON counsel_activity_decisions
BEGIN
  SELECT RAISE(ABORT, 'counsel_activity_decisions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_activity_no_delete
BEFORE DELETE ON counsel_activity_decisions
BEGIN
  SELECT RAISE(ABORT, 'counsel_activity_decisions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_audit_no_update
BEFORE UPDATE ON counsel_audit_events
BEGIN
  SELECT RAISE(ABORT, 'counsel_audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_audit_no_delete
BEFORE DELETE ON counsel_audit_events
BEGIN
  SELECT RAISE(ABORT, 'counsel_audit_events is append-only');
END;

PRAGMA foreign_keys = ON;
