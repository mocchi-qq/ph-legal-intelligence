-- Migration: 0006_gate6_counsel_validation
-- Target: Cloudflare D1 (SQLite)
-- Purpose: additive validation triggers for Gate 5 counsel records. It does not
-- rewrite 0001–0005 or any existing row.
--
-- SQLite cannot add CHECK constraints with ALTER TABLE, so semantic validation
-- that needs JSON/HEX/date checks is enforced with BEFORE INSERT triggers.

CREATE TRIGGER IF NOT EXISTS trg_counsel_determination_validate_insert
BEFORE INSERT ON counsel_determinations
WHEN
  json_valid(NEW.document_scope_json) = 0
  OR json_type(NEW.document_scope_json) != 'array'
  OR json_valid(NEW.evidence_refs_json) = 0
  OR json_type(NEW.evidence_refs_json) != 'array'
  OR date(NEW.date_received) IS NULL
  OR (NEW.date_issued IS NOT NULL AND date(NEW.date_issued) IS NULL)
  OR (NEW.effective_date IS NOT NULL AND date(NEW.effective_date) IS NULL)
  OR (NEW.expiry_date IS NOT NULL AND date(NEW.expiry_date) IS NULL)
  OR (
    NEW.decision_document_hash IS NOT NULL
    AND (
      length(NEW.decision_document_hash) != 64
      OR NEW.decision_document_hash GLOB '*[^0-9A-Fa-f]*'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid_counsel_determination_evidence_or_date');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_activity_validate_insert
BEFORE INSERT ON counsel_activity_decisions
WHEN
  (NEW.conditions_json IS NOT NULL
    AND (json_valid(NEW.conditions_json) = 0
      OR json_type(NEW.conditions_json) != 'array'))
  OR (NEW.limitations_json IS NOT NULL
    AND (json_valid(NEW.limitations_json) = 0
      OR json_type(NEW.limitations_json) != 'array'))
  OR (NEW.permitted_users_json IS NOT NULL
    AND (json_valid(NEW.permitted_users_json) = 0
      OR json_type(NEW.permitted_users_json) != 'array'))
  OR (NEW.effective_date IS NOT NULL AND date(NEW.effective_date) IS NULL)
  OR (NEW.expiry_date IS NOT NULL AND date(NEW.expiry_date) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid_counsel_activity_evidence_or_date');
END;

CREATE TRIGGER IF NOT EXISTS trg_counsel_professional_validate_insert
BEFORE INSERT ON counsel_professionals
WHEN
  NEW.verification_status = 'VERIFIED'
  AND (NEW.verified_at IS NULL OR date(NEW.verified_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid_counsel_verification_date');
END;

PRAGMA foreign_keys = ON;
