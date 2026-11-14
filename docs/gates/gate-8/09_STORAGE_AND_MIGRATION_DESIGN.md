# 09 — Storage and Migration Design

**Date:** 2026-11-14
**Status:** additive migration `0009`, validated on the SQLite shim; D1 level
reported separately in `11`.

## 1. Principles

- Reuse the existing four-object model (`legal_documents`, `document_versions`,
  `legal_provisions`, `source_manifestations`). No parallel registry.
- New tables only for genuinely new concepts: assertions, evidence, substantive
  reviews, logical provision identities, mappings, citation aliases, resolution
  audit.
- Append-only history. Every new table has BEFORE UPDATE, BEFORE DELETE and
  BEFORE INSERT-when-id-exists (`no_replace`) triggers.
- Relational constraints over JSON blobs. Lists (conditions, evidence refs) are
  stored as validated JSON arrays where a child table would add no constraint.
- No graph database, no vector store, no R2, no Queues.

## 2. Migration 0009 — additive only

### `legal_effect_assertions`

| Column                         | Type | Constraint                            |
| ------------------------------ | ---- | ------------------------------------- |
| `id`                           | TEXT | PK                                    |
| `effect_type`                  | TEXT | CHECK in 12 values                    |
| `source_document_id`           | TEXT | FK → `legal_documents`                |
| `source_version_id`            | TEXT | FK → `document_versions`, nullable    |
| `source_provision_id`          | TEXT | FK → `legal_provisions`, nullable     |
| `target_document_id`           | TEXT | FK → `legal_documents`                |
| `target_provision_identity_id` | TEXT | FK → `provision_identities`, nullable |
| `target_version_id`            | TEXT | FK → `document_versions`, nullable    |
| `scope`                        | TEXT | non-empty                             |
| `claimed_date`                 | TEXT | date check, nullable                  |
| `claimed_effective_date`       | TEXT | date check, nullable                  |
| `evidence_id`                  | TEXT | FK → `legal_effect_evidence`          |
| `source_locator`               | TEXT | nullable                              |
| `assertion_origin`             | TEXT | non-empty                             |
| `recorded_at`                  | TEXT | date-time check                       |
| `recorded_by`                  | TEXT | non-empty                             |
| `state`                        | TEXT | CHECK in 5 values                     |
| `supersedes_assertion_id`      | TEXT | FK → self, nullable                   |
| `conflict_group_id`            | TEXT | nullable                              |

Circular FK risk: `evidence_id` references evidence, which references the
assertion. Resolve by creating assertions and evidence with deferred checks or by
declaring the FK on evidence only, and making `evidence_id` a non-FK indexed text
column validated by the service plus a `CHECK` on non-empty. **Decision:** keep the
FK on `legal_effect_evidence.assertion_id`; on the assertion, store `evidence_id`
as an indexed TEXT with a service-level existence check. This avoids a circular
foreign key and keeps evidence ownership unambiguous.

### `legal_effect_evidence`

`id` PK; `assertion_id` FK; `document_version_id` FK nullable;
`provision_version_id` FK nullable; `artifact_id` FK → `source_manifestations`
nullable; `content_hash` 64-hex check nullable; `passage` nullable; `locator`
nullable; `evidence_date` date check nullable; `classification` CHECK 6 values;
`availability` CHECK 3 values; `checked_at` date-time nullable.

### `legal_effect_reviews`

`id` PK; `assertion_id` FK; `outcome` CHECK 5; `reviewer_id` non-empty;
`reviewer_capacity` non-empty; `decision_date` date; `scope` non-empty;
`proposition_reviewed` non-empty; `conditions_json` JSON array; `evidence_refs_json`
JSON array; `notes` nullable; `supersedes_review_id` FK self nullable; `status`
CHECK 3; `recorded_at` date-time.

Trigger: `CONFIRMED_WITH_CONDITIONS` requires a non-empty conditions array.

### `provision_identities`

`id` PK; `document_id` FK; `provision_type` CHECK existing 8 values;
`canonical_label` non-empty; `created_at`; UNIQUE `(document_id, canonical_label)`.

### `provision_version_mappings`

`id` PK; `provision_identity_id` FK; `provision_version_id` FK;
`document_version_id` FK; `mapping_type` CHECK 8; `rationale` non-empty;
`review_status` CHECK 3; `created_at`; UNIQUE
`(provision_identity_id, provision_version_id)`.

### `citation_aliases`

`id` PK; `document_id` FK; `alias_text` non-empty; `normalized_alias` non-empty;
`alias_type` CHECK (`TITLE`,`SHORT_TITLE`,`CITATION`,`ABBREVIATION`);
`created_at`; UNIQUE `(document_id, normalized_alias)`.

### `citation_resolution_events`

`id` PK; `original_text`; `normalized_text`; `status` CHECK 8;
`matched_document_id` nullable; `matched_provision_id` nullable;
`candidates_json`; `provenance_json`; `created_at`.

## 3. Append-only triggers

For each new table: `BEFORE UPDATE`, `BEFORE DELETE`, and a `BEFORE INSERT ...
WHEN EXISTS (same id)` trigger that rejects `INSERT OR REPLACE` / `REPLACE`
(SQLite conflict resolution deletes the old row without firing delete triggers
unless `recursive_triggers` is on, so the extra trigger is required). Each raises
`RAISE(ABORT, '<table> is append-only')`. Corrections are new rows;
supersession/revocation are new review rows.

## 4. Indexes

- `legal_effect_assertions(target_document_id, claimed_effective_date)`
- `legal_effect_assertions(target_provision_identity_id)`
- `legal_effect_assertions(state)`
- `legal_effect_evidence(assertion_id)`
- `legal_effect_reviews(assertion_id, status)`
- `provision_version_mappings(provision_identity_id)`
- `provision_version_mappings(provision_version_id)`
- `citation_aliases(normalized_alias)`
- `citation_resolution_events(created_at)`

## 5. Rollback

Migration 0009 is additive; rollback is dropping the seven new tables and their
triggers. No existing table or row is modified. The rollback must not be applied to
a database containing records that other gates depend on.

## 6. D1 compatibility

- All types are SQLite affinity compatible; JSON arrays use `json_valid` checks.
- Foreign keys are enabled by the runner; D1 enforces them. The trailing
  `PRAGMA foreign_keys = ON` in the migration is a reminder, not a guarantee for
  later connections.
- `BEFORE UPDATE/DELETE` triggers are supported by both SQLite and D1.
- The shim applies migrations 0001–0009 on `node:sqlite`.
- Remote D1 execution is optional and must be reported separately; the Gate 7
  binding-level limitation remains.

## 7. What is deliberately absent

- No table for "current law"; current state is a projection.
- No `is_in_force` boolean on assertions.
- No review outcome stored as a document status.
- No reuse/authorization columns in Plane C tables.
