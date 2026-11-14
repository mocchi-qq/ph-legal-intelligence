-- Migration: 0009_authority_core
-- Target: Cloudflare D1 (SQLite)
-- Gate 8 authority core; append-only; no existing row is rewritten.

-- ---------------------------------------------------------------------------
-- Object: provision_identities
-- Logical provision identity, stable across document versions and renumbering.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provision_identities (
  id               TEXT PRIMARY KEY NOT NULL,
  document_id      TEXT NOT NULL REFERENCES legal_documents(id),
  provision_type   TEXT NOT NULL CHECK (provision_type IN (
                     'PREAMBLE', 'ARTICLE', 'SECTION', 'RULE', 'PARAGRAPH',
                     'SUBPARAGRAPH', 'CLAUSE', 'ITEM'
                   )),
  canonical_label  TEXT NOT NULL CHECK (length(trim(canonical_label)) > 0),
  created_at       TEXT NOT NULL CHECK (
                     created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                     AND datetime(created_at) IS NOT NULL
                   ),
  UNIQUE (document_id, canonical_label)
);

CREATE INDEX IF NOT EXISTS idx_provision_identities_document_id
  ON provision_identities (document_id);

-- ---------------------------------------------------------------------------
-- Object: citation_aliases
-- Alternative citation strings that resolve to a document.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citation_aliases (
  id                TEXT PRIMARY KEY NOT NULL,
  document_id       TEXT NOT NULL REFERENCES legal_documents(id),
  alias_text        TEXT NOT NULL CHECK (length(trim(alias_text)) > 0),
  normalized_alias  TEXT NOT NULL CHECK (length(trim(normalized_alias)) > 0),
  alias_type        TEXT NOT NULL CHECK (alias_type IN (
                      'TITLE', 'SHORT_TITLE', 'CITATION', 'ABBREVIATION'
                    )),
  created_at        TEXT NOT NULL CHECK (
                      created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                      AND datetime(created_at) IS NOT NULL
                    ),
  UNIQUE (document_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_citation_aliases_normalized_alias
  ON citation_aliases (normalized_alias);

-- ---------------------------------------------------------------------------
-- Object: legal_effect_assertions
-- One claimed legal effect by one source on one target. Never updated in place;
-- corrections and supersession are new rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_effect_assertions (
  id                           TEXT PRIMARY KEY NOT NULL,
  effect_type                  TEXT NOT NULL CHECK (effect_type IN (
                                 'ENACTMENT', 'AMENDMENT', 'PARTIAL_AMENDMENT',
                                 'REPEAL', 'PARTIAL_REPEAL', 'SUSPENSION',
                                 'JUDICIAL_INVALIDATION', 'REINSTATEMENT',
                                 'EFFECTIVITY', 'CONSOLIDATION', 'RENUMBERING',
                                 'OTHER'
                               )),
  source_document_id           TEXT NOT NULL REFERENCES legal_documents(id),
  source_version_id            TEXT REFERENCES document_versions(id),
  source_provision_id          TEXT REFERENCES legal_provisions(id),
  target_document_id           TEXT NOT NULL REFERENCES legal_documents(id),
  target_provision_identity_id TEXT REFERENCES provision_identities(id),
  target_version_id            TEXT REFERENCES document_versions(id),
  scope                        TEXT NOT NULL CHECK (length(trim(scope)) > 0),
  claimed_date                 TEXT CHECK (
                                 claimed_date IS NULL OR (
                                   claimed_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                                   AND date(claimed_date) IS claimed_date
                                 )
                               ),
  claimed_effective_date       TEXT CHECK (
                                 claimed_effective_date IS NULL OR (
                                   claimed_effective_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                                   AND date(claimed_effective_date) IS claimed_effective_date
                                 )
                               ),
  evidence_id                  TEXT NOT NULL CHECK (length(trim(evidence_id)) > 0),
  source_locator               TEXT,
  assertion_origin             TEXT NOT NULL CHECK (length(trim(assertion_origin)) > 0),
  recorded_at                  TEXT NOT NULL CHECK (
                                 recorded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                                 AND datetime(recorded_at) IS NOT NULL
                               ),
  recorded_by                  TEXT NOT NULL CHECK (length(trim(recorded_by)) > 0),
  state                        TEXT NOT NULL CHECK (state IN (
                                 'UNREVIEWED', 'PENDING_REVIEW', 'CONFLICTED',
                                 'SUPERSEDED', 'UNKNOWN'
                               )),
  supersedes_assertion_id      TEXT REFERENCES legal_effect_assertions(id),
  conflict_group_id            TEXT,
  CHECK (supersedes_assertion_id IS NULL OR supersedes_assertion_id != id)
);

CREATE INDEX IF NOT EXISTS idx_effect_assertions_target_date
  ON legal_effect_assertions (target_document_id, claimed_effective_date);
CREATE INDEX IF NOT EXISTS idx_effect_assertions_target_provision
  ON legal_effect_assertions (target_provision_identity_id);
CREATE INDEX IF NOT EXISTS idx_effect_assertions_state
  ON legal_effect_assertions (state);
CREATE INDEX IF NOT EXISTS idx_effect_assertions_source_document
  ON legal_effect_assertions (source_document_id);
CREATE INDEX IF NOT EXISTS idx_effect_assertions_evidence
  ON legal_effect_assertions (evidence_id);

-- ---------------------------------------------------------------------------
-- Object: legal_effect_evidence
-- Supporting material for an assertion. Immutable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_effect_evidence (
  id                    TEXT PRIMARY KEY NOT NULL,
  assertion_id          TEXT NOT NULL REFERENCES legal_effect_assertions(id),
  document_version_id   TEXT REFERENCES document_versions(id),
  provision_version_id  TEXT REFERENCES legal_provisions(id),
  artifact_id           TEXT REFERENCES source_manifestations(id),
  content_hash          TEXT CHECK (content_hash IS NULL OR (
                          length(content_hash) = 64
                          AND content_hash GLOB '*[^0-9A-Fa-f]*' = 0
                        )),
  passage               TEXT,
  locator               TEXT,
  evidence_date         TEXT CHECK (
                          evidence_date IS NULL OR (
                            evidence_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                            AND date(evidence_date) IS evidence_date
                          )
                        ),
  classification        TEXT NOT NULL CHECK (classification IN (
                          'OFFICIAL_PRIMARY', 'OFFICIAL_SECONDARY', 'UNOFFICIAL',
                          'EDITORIAL', 'INFERENCE', 'UNKNOWN'
                        )),
  availability          TEXT NOT NULL CHECK (availability IN (
                          'AVAILABLE', 'UNAVAILABLE', 'NOT_RECEIVED'
                        )),
  checked_at            TEXT CHECK (
                          checked_at IS NULL OR (
                            checked_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                            AND datetime(checked_at) IS NOT NULL
                          )
                        )
);

CREATE INDEX IF NOT EXISTS idx_legal_effect_evidence_assertion_id
  ON legal_effect_evidence (assertion_id);

-- ---------------------------------------------------------------------------
-- Object: legal_effect_reviews
-- Substantive review of one proposition. Revocation and supersession are new
-- rows; the reviewed assertion is never rewritten.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_effect_reviews (
  id                    TEXT PRIMARY KEY NOT NULL,
  assertion_id          TEXT NOT NULL REFERENCES legal_effect_assertions(id),
  outcome               TEXT NOT NULL CHECK (outcome IN (
                          'CONFIRMED', 'CONFIRMED_WITH_CONDITIONS', 'REJECTED',
                          'INCONCLUSIVE', 'CONFLICTED'
                        )),
  reviewer_id           TEXT NOT NULL CHECK (length(trim(reviewer_id)) > 0),
  reviewer_capacity     TEXT NOT NULL CHECK (length(trim(reviewer_capacity)) > 0),
  decision_date         TEXT NOT NULL CHECK (
                          decision_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                          AND date(decision_date) IS decision_date
                        ),
  scope                 TEXT NOT NULL CHECK (length(trim(scope)) > 0),
  proposition_reviewed  TEXT NOT NULL CHECK (length(trim(proposition_reviewed)) > 0),
  conditions_json       TEXT NOT NULL DEFAULT '[]' CHECK (
                          json_valid(conditions_json) = 1
                          AND json_type(conditions_json) = 'array'
                        ),
  evidence_refs_json    TEXT NOT NULL DEFAULT '[]' CHECK (
                          json_valid(evidence_refs_json) = 1
                          AND json_type(evidence_refs_json) = 'array'
                        ),
  notes                 TEXT,
  supersedes_review_id  TEXT REFERENCES legal_effect_reviews(id),
  status                TEXT NOT NULL CHECK (status IN (
                          'ACTIVE', 'SUPERSEDED', 'REVOKED'
                        )),
  recorded_at           TEXT NOT NULL CHECK (
                          recorded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                          AND datetime(recorded_at) IS NOT NULL
                        ),
  CHECK (outcome != 'CONFIRMED_WITH_CONDITIONS'
         OR json_array_length(conditions_json) > 0),
  CHECK (supersedes_review_id IS NULL OR supersedes_review_id != id)
);

CREATE INDEX IF NOT EXISTS idx_effect_reviews_assertion_status
  ON legal_effect_reviews (assertion_id, status);
CREATE INDEX IF NOT EXISTS idx_effect_reviews_outcome
  ON legal_effect_reviews (outcome);

-- ---------------------------------------------------------------------------
-- Object: provision_version_mappings
-- Maps a logical identity to one concrete provision version.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provision_version_mappings (
  id                     TEXT PRIMARY KEY NOT NULL,
  provision_identity_id  TEXT NOT NULL REFERENCES provision_identities(id),
  provision_version_id   TEXT NOT NULL REFERENCES legal_provisions(id),
  document_version_id    TEXT NOT NULL REFERENCES document_versions(id),
  mapping_type           TEXT NOT NULL CHECK (mapping_type IN (
                           'SAME', 'RENUMBERED', 'SPLIT', 'MERGED', 'DELETED',
                           'NEW', 'UNCERTAIN', 'NONE'
                         )),
  rationale              TEXT NOT NULL CHECK (length(trim(rationale)) > 0),
  review_status          TEXT NOT NULL CHECK (review_status IN (
                           'UNREVIEWED', 'REVIEWED', 'CONFLICTED'
                         )),
  created_at             TEXT NOT NULL CHECK (
                           created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                           AND datetime(created_at) IS NOT NULL
                         ),
  UNIQUE (provision_identity_id, provision_version_id)
);

CREATE INDEX IF NOT EXISTS idx_provision_version_mappings_provision_identity_id
  ON provision_version_mappings (provision_identity_id);
CREATE INDEX IF NOT EXISTS idx_provision_version_mappings_provision_version_id
  ON provision_version_mappings (provision_version_id);

-- ---------------------------------------------------------------------------
-- Object: citation_resolution_events
-- Audit of every citation resolution attempt, including failures.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citation_resolution_events (
  id                    TEXT PRIMARY KEY NOT NULL,
  original_text         TEXT NOT NULL,
  normalized_text       TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN (
                          'EXACT', 'ALIAS', 'MULTIPLE_CANDIDATES', 'PARTIAL',
                          'NO_MATCH', 'INVALID_FORMAT', 'UNSUPPORTED_TYPE',
                          'UNCERTAIN'
                        )),
  matched_document_id   TEXT REFERENCES legal_documents(id),
  matched_provision_id  TEXT REFERENCES provision_identities(id),
  candidates_json       TEXT NOT NULL DEFAULT '[]' CHECK (
                          json_valid(candidates_json) = 1
                          AND json_type(candidates_json) = 'array'
                        ),
  provenance_json       TEXT NOT NULL DEFAULT '[]' CHECK (
                          json_valid(provenance_json) = 1
                          AND json_type(provenance_json) = 'array'
                        ),
  created_at            TEXT NOT NULL CHECK (
                          created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
                          AND datetime(created_at) IS NOT NULL
                        )
);

CREATE INDEX IF NOT EXISTS idx_citation_resolution_events_created_at
  ON citation_resolution_events (created_at);

-- ---------------------------------------------------------------------------
-- Append-only enforcement: corrections are new rows, never edits or deletes.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_provision_identities_no_update
BEFORE UPDATE ON provision_identities
BEGIN
  SELECT RAISE(ABORT, 'provision_identities is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_provision_identities_no_delete
BEFORE DELETE ON provision_identities
BEGIN
  SELECT RAISE(ABORT, 'provision_identities is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_aliases_no_update
BEFORE UPDATE ON citation_aliases
BEGIN
  SELECT RAISE(ABORT, 'citation_aliases is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_aliases_no_delete
BEFORE DELETE ON citation_aliases
BEGIN
  SELECT RAISE(ABORT, 'citation_aliases is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_assertions_no_update
BEFORE UPDATE ON legal_effect_assertions
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_assertions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_assertions_no_delete
BEFORE DELETE ON legal_effect_assertions
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_assertions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_evidence_no_update
BEFORE UPDATE ON legal_effect_evidence
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_evidence_no_delete
BEFORE DELETE ON legal_effect_evidence
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_reviews_no_update
BEFORE UPDATE ON legal_effect_reviews
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_reviews is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_reviews_no_delete
BEFORE DELETE ON legal_effect_reviews
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_reviews is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_provision_version_mappings_no_update
BEFORE UPDATE ON provision_version_mappings
BEGIN
  SELECT RAISE(ABORT, 'provision_version_mappings is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_provision_version_mappings_no_delete
BEFORE DELETE ON provision_version_mappings
BEGIN
  SELECT RAISE(ABORT, 'provision_version_mappings is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_resolution_events_no_update
BEFORE UPDATE ON citation_resolution_events
BEGIN
  SELECT RAISE(ABORT, 'citation_resolution_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_resolution_events_no_delete
BEFORE DELETE ON citation_resolution_events
BEGIN
  SELECT RAISE(ABORT, 'citation_resolution_events is append-only');
END;

-- ---------------------------------------------------------------------------
-- Append-only enforcement: INSERT OR REPLACE / REPLACE must not resurrect or
-- rewrite an existing id. A BEFORE INSERT trigger still sees the conflicting
-- row (SQLite applies REPLACE conflict resolution after BEFORE triggers), so a
-- duplicate id aborts while a genuinely new id inserts normally.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_provision_identities_no_replace
BEFORE INSERT ON provision_identities
WHEN EXISTS (SELECT 1 FROM provision_identities WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'provision_identities is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_aliases_no_replace
BEFORE INSERT ON citation_aliases
WHEN EXISTS (SELECT 1 FROM citation_aliases WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'citation_aliases is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_assertions_no_replace
BEFORE INSERT ON legal_effect_assertions
WHEN EXISTS (SELECT 1 FROM legal_effect_assertions WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_assertions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_evidence_no_replace
BEFORE INSERT ON legal_effect_evidence
WHEN EXISTS (SELECT 1 FROM legal_effect_evidence WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_evidence is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_legal_effect_reviews_no_replace
BEFORE INSERT ON legal_effect_reviews
WHEN EXISTS (SELECT 1 FROM legal_effect_reviews WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'legal_effect_reviews is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_provision_version_mappings_no_replace
BEFORE INSERT ON provision_version_mappings
WHEN EXISTS (SELECT 1 FROM provision_version_mappings WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'provision_version_mappings is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_citation_resolution_events_no_replace
BEFORE INSERT ON citation_resolution_events
WHEN EXISTS (SELECT 1 FROM citation_resolution_events WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'citation_resolution_events is append-only');
END;

-- Foreign keys are enforced by the runner (Cloudflare D1 / the migration
-- runner) that owns the connection; this PRAGMA keeps local SQLite honest.
PRAGMA foreign_keys = ON;
