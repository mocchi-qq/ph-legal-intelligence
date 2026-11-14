-- Migration: 0008_gate7_registry_commit
-- Target: Cloudflare D1 (SQLite)
-- Purpose: durable commit marker that makes a counsel determination visible to
-- authorization projection only after every related record was written.
-- Additive only; migrations 0001–0007 are not rewritten.
--
-- Why a marker: D1 batch atomicity cannot be verified on this host. The marker is
-- the LAST statement of a determination write. Under atomic batch execution it is
-- all-or-nothing. Under non-atomic execution it can only exist if every earlier
-- statement succeeded. Either way, a determination with no marker, or with a
-- marker whose payload hash does not match the stored rows, is never projected.
--
-- The table is append-only. Recovery of an incomplete operation is an explicit
-- new commit insert, never an update of history.
--
-- Dependency: this migration requires counsel_determinations from migration 0005
-- (foreign key). It is applied after 0001–0007 and is not a standalone schema.

CREATE TABLE IF NOT EXISTS counsel_registry_commits (
  determination_id TEXT PRIMARY KEY NOT NULL,
  source_id        TEXT NOT NULL,
  operation_id     TEXT NOT NULL,
  payload_hash     TEXT NOT NULL,
  committed_at     TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (length(payload_hash) = 64),
  CHECK (payload_hash GLOB '*[^0-9A-Fa-f]*' = 0),
  CHECK (date(committed_at) IS NOT NULL),
  FOREIGN KEY (determination_id) REFERENCES counsel_determinations (id)
);

CREATE INDEX IF NOT EXISTS idx_counsel_commit_source
  ON counsel_registry_commits (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_counsel_commit_operation
  ON counsel_registry_commits (operation_id);

-- A determination may be recorded, revoked and superseded at most once. This is
-- the database-level defence against two concurrent reviewers appending
-- conflicting terminal events; the repository also checks before writing.
CREATE UNIQUE INDEX IF NOT EXISTS ux_counsel_audit_single_recorded
  ON counsel_audit_events (determination_id)
  WHERE action = 'DETERMINATION_RECORDED';

-- One terminal event total. Separate REVOKED and SUPERSEDED indexes would still
-- allow a concurrent revocation and supersession to coexist; this single index
-- makes "terminal" a single slot at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS ux_counsel_audit_single_terminal
  ON counsel_audit_events (determination_id)
  WHERE action IN ('REVOKED', 'SUPERSEDED');

CREATE TRIGGER IF NOT EXISTS trg_counsel_commit_no_update
BEFORE UPDATE ON counsel_registry_commits
BEGIN
  SELECT RAISE(ABORT, 'counsel_registry_commits is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_commit_no_delete
BEFORE DELETE ON counsel_registry_commits
BEGIN
  SELECT RAISE(ABORT, 'counsel_registry_commits is append-only');
END;

PRAGMA foreign_keys = ON;
