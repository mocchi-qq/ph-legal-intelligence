-- Migration: 0007_gate7_authorization_audit
-- Target: Cloudflare D1 (SQLite)
-- Purpose: centralized append-only authorization decision/denial audit for
-- implemented content paths. Additive only; no prior migration is rewritten.

CREATE TABLE IF NOT EXISTS authorization_audit_events (
  id                TEXT PRIMARY KEY NOT NULL,
  event_type        TEXT NOT NULL CHECK (event_type IN (
                      'AUTHORIZATION_REQUESTED', 'AUTHORIZATION_GRANTED',
                      'AUTHORIZATION_DENIED', 'PROJECTION_REJECTED',
                      'EVIDENCE_UNAVAILABLE', 'CONDITION_UNMET',
                      'DECISION_EXPIRED', 'DECISION_REVOKED',
                      'DECISION_SUPERSEDED', 'CONFLICT_DETECTED',
                      'REGISTRY_UNAVAILABLE', 'OPERATION_ABORTED',
                      'RETRY_DENIED'
                    )),
  outcome           TEXT NOT NULL CHECK (outcome IN (
                      'GRANTED', 'DENIED', 'ERROR'
                    )),
  occurred_at       TEXT NOT NULL,
  source_id         TEXT NOT NULL,
  document_id       TEXT,
  activity          TEXT NOT NULL,
  operation         TEXT NOT NULL,
  reason_code       TEXT NOT NULL,
  determination_id  TEXT,
  correlation_id    TEXT,
  registry_status   TEXT,
  context_json      TEXT NOT NULL DEFAULT '{}' CHECK (
                      json_valid(context_json) = 1
                      AND json_type(context_json) = 'object'
                    ),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (date(occurred_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_source_activity
  ON authorization_audit_events (source_id, activity, occurred_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_determination
  ON authorization_audit_events (determination_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_correlation
  ON authorization_audit_events (correlation_id);

CREATE TRIGGER IF NOT EXISTS trg_auth_audit_no_update
BEFORE UPDATE ON authorization_audit_events
BEGIN
  SELECT RAISE(ABORT, 'authorization_audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_auth_audit_no_delete
BEFORE DELETE ON authorization_audit_events
BEGIN
  SELECT RAISE(ABORT, 'authorization_audit_events is append-only');
END;

PRAGMA foreign_keys = ON;
