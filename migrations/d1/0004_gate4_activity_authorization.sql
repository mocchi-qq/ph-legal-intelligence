-- Migration: 0004_gate4_activity_authorization
-- Target: Cloudflare D1 (SQLite)
-- Purpose: append-only, activity-specific source authorization and its audit
-- trail. Additive only; no existing row is rewritten or deleted.
--
-- A decision applies to exactly one (source_id, activity) pair. Later rows
-- supersede earlier rows for runtime checks; earlier rows remain readable.
-- AUTHORIZED / RESTRICTED decisions require evidence, reviewer and date.
-- AUTHORIZED_WITH_CONDITIONS requires at least one recorded condition.

CREATE TABLE IF NOT EXISTS source_activity_authorizations (
  id                  TEXT PRIMARY KEY NOT NULL,
  source_id           TEXT NOT NULL,
  activity            TEXT NOT NULL CHECK (activity IN (
                        'viewing', 'downloading', 'temporary_processing',
                        'persistent_storage', 'text_extraction', 'ocr',
                        'search_indexing', 'embedding_generation',
                        'ai_assisted_analysis', 'citation_display',
                        'quotation', 'redistribution', 'commercial_use',
                        'retention'
                      )),
  status              TEXT NOT NULL CHECK (status IN (
                        'UNKNOWN', 'NOT_REVIEWED', 'REVIEW_REQUIRED',
                        'AUTHORIZED', 'AUTHORIZED_WITH_CONDITIONS',
                        'RESTRICTED', 'PROHIBITED'
                      )),
  basis               TEXT NOT NULL CHECK (basis IN (
                        'COUNSEL_DETERMINATION', 'OWNER_RISK_ACCEPTANCE',
                        'SYNTHETIC_FIXTURE', 'NONE'
                      )),
  evidence_ref        TEXT,
  evidence_location   TEXT,
  counsel_decision_ref TEXT,
  reviewer            TEXT,
  decision_date       TEXT,
  conditions_json     TEXT,
  expires_at          TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    status NOT IN ('AUTHORIZED', 'AUTHORIZED_WITH_CONDITIONS', 'RESTRICTED')
    OR (basis != 'NONE' AND evidence_ref IS NOT NULL
        AND reviewer IS NOT NULL AND decision_date IS NOT NULL)
  ),
  CHECK (
    status != 'AUTHORIZED_WITH_CONDITIONS'
    OR (conditions_json IS NOT NULL AND length(trim(conditions_json)) > 2)
  ),
  CHECK (
    status NOT IN ('AUTHORIZED', 'AUTHORIZED_WITH_CONDITIONS')
    OR basis != 'COUNSEL_DETERMINATION'
    OR (counsel_decision_ref IS NOT NULL AND length(trim(counsel_decision_ref)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_source_activity_auth_source_activity
  ON source_activity_authorizations (source_id, activity, created_at);
CREATE INDEX IF NOT EXISTS idx_source_activity_auth_status
  ON source_activity_authorizations (status);

CREATE TABLE IF NOT EXISTS source_authorization_audit (
  id                  TEXT PRIMARY KEY NOT NULL,
  source_id           TEXT NOT NULL,
  activity            TEXT NOT NULL CHECK (activity IN (
                        'viewing', 'downloading', 'temporary_processing',
                        'persistent_storage', 'text_extraction', 'ocr',
                        'search_indexing', 'embedding_generation',
                        'ai_assisted_analysis', 'citation_display',
                        'quotation', 'redistribution', 'commercial_use',
                        'retention'
                      )),
  previous_status     TEXT,
  new_status          TEXT NOT NULL CHECK (new_status IN (
                        'UNKNOWN', 'NOT_REVIEWED', 'REVIEW_REQUIRED',
                        'AUTHORIZED', 'AUTHORIZED_WITH_CONDITIONS',
                        'RESTRICTED', 'PROHIBITED'
                      )),
  basis               TEXT NOT NULL CHECK (basis IN (
                        'COUNSEL_DETERMINATION', 'OWNER_RISK_ACCEPTANCE',
                        'SYNTHETIC_FIXTURE', 'NONE'
                      )),
  actor               TEXT NOT NULL,
  actor_role          TEXT,
  changed_at          TEXT NOT NULL,
  decision_ref        TEXT NOT NULL,
  evidence_ref        TEXT,
  conditions_json     TEXT,
  reason              TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (decision_ref) REFERENCES source_activity_authorizations (id)
);

CREATE INDEX IF NOT EXISTS idx_source_auth_audit_source
  ON source_authorization_audit (source_id, activity, changed_at);

-- Append-only: decided history and its audit events cannot be rewritten.
CREATE TRIGGER IF NOT EXISTS trg_source_activity_auth_no_update
BEFORE UPDATE ON source_activity_authorizations
BEGIN
  SELECT RAISE(ABORT, 'source_activity_authorizations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_source_activity_auth_no_delete
BEFORE DELETE ON source_activity_authorizations
BEGIN
  SELECT RAISE(ABORT, 'source_activity_authorizations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_source_auth_audit_no_update
BEFORE UPDATE ON source_authorization_audit
BEGIN
  SELECT RAISE(ABORT, 'source_authorization_audit is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_source_auth_audit_no_delete
BEFORE DELETE ON source_authorization_audit
BEGIN
  SELECT RAISE(ABORT, 'source_authorization_audit is append-only');
END;

-- Gate 4 audit linkage on the existing append-only ingestion run. Additive
-- columns only; the legacy authorization_basis enum is left untouched.
ALTER TABLE ingestion_runs ADD COLUMN authorization_decision_ref TEXT;
ALTER TABLE ingestion_runs ADD COLUMN authorization_decision_refs TEXT;
ALTER TABLE ingestion_runs ADD COLUMN authorization_basis_detail TEXT
  CHECK (authorization_basis_detail IN (
    'COUNSEL_DETERMINATION', 'OWNER_RISK_ACCEPTANCE', 'SYNTHETIC_FIXTURE'
  ));

PRAGMA foreign_keys = ON;
