# Gate 7 — D1 Adapter Implementation

**Date:** 2026-11-14
**Status:** `IMPLEMENTED_UNVERIFIED` — verified only against the SQLite shim.
**File:** `packages/legal-ingestion/src/counsel-d1-store.ts`
**Schema:** migrations `0005`, `0006`, `0008` (0001–0006 unchanged; 0007 adds audit)

## 1. Reads

All queries are parameterized. Nothing from a caller is concatenated into SQL;
the only dynamically built fragment is a list of `?` placeholders whose count
comes from an already-validated array length.

| Method                                 | Query shape                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `getProfessional(id)`                  | `WHERE id = ?`                                                                                        |
| `getDetermination(id)`                 | row by id + activities by determination id + commit by id                                             |
| `listByDocument(sourceId, documentId)` | `WHERE source_id = ? AND (document_scope_json = '[]' OR json_each(...) = ?)`                          |
| `statusOf(id)`                         | audit events for the determination, folded in order                                                   |
| `loadState(sourceId)`                  | determinations by source; activities/commits/audit via `IN (?…)`; professionals (bounded, tiny table) |
| `auditTrail(id?)`                      | filtered or full, ordered by `changed_at, rowid`                                                      |
| `listAuthorizationAudit(sourceId?)`    | filtered or full                                                                                      |

Scoped queries are used; the adapter never loads a whole table when a source or
determination filter is sufficient. `counsel_professionals` is the only table read
whole, because it is small and referenced by every determination.

### Read-time fail-closed rules

A row is returned only if **all** of these hold:

1. a `counsel_registry_commits` row exists for it;
2. the commit's `source_id` matches the determination;
3. `sha256(canonical payload)` of the stored determination + activities equals
   the commit's `payload_hash`.

Otherwise `getDetermination` returns `null` and `loadState` omits the record.
Rows left by a failed write are visible only through
`listIncompleteDeterminations(sourceId)`.

## 2. Writes

| Method                     | Statements                                                                 | Durability                                 |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| `registerProfessional`     | professional insert + counsel audit insert                                 | batch; a professional alone grants nothing |
| `recordDetermination`      | determination + one activity per decision + audit + **commit marker last** | batch; see 04                              |
| `transition`               | one `STATUS_CHANGED` audit insert                                          | single statement                           |
| `revoke`                   | one `REVOKED` audit insert                                                 | single statement                           |
| `supersede`                | one `SUPERSEDED` audit insert                                              | single statement                           |
| `appendAuthorizationAudit` | one audit insert                                                           | single statement                           |

Terminal events are single statements, so they need no marker. A failure leaves
the previous status in force (fail closed).

## 3. Deterministic identifiers

- Activity decision id: `act_<determinationId>_<activity>` — deterministic, so a
  retry cannot create a second row.
- Counsel audit id: `counsel_audit_<uuid>`.
- Authorization audit id: `auth_audit_<uuid>`.
- Commit operation id: caller-supplied or `counsel_op_<uuid>`; unique index.

UUIDs replace the draft adapter's per-process counter, which would have collided
against a durable primary key after a restart or across instances.

## 4. Validation

Two layers, as required:

1. **Domain boundary** — `validateDetermination` (Gate 5 rules): id, source,
   counsel, scope, dates, activity set, duplicate activity, conditional-without-
   conditions, hash format, and for `VERIFIED_FOR_RECORDING` a verified counsel,
   verification evidence, evidence refs, decision document and issue date.
   `registerProfessional` rejects a `VERIFIED` professional without evidence,
   verifier and date.
2. **Database** — foreign keys, `CHECK` constraints, JSON/hex/date triggers from
   `0006`, uniqueness from `0005`/`0008`, append-only triggers.

The database remains the final defence: the adapter maps constraint failures to
stable domain reasons (`duplicate_determination_id`, `duplicate_activity_decision`,
`foreign_key_violation`, `append_only_violation`, `constraint_violation`).

## 5. Error mapping

`classify()` converts storage errors into domain reasons instead of leaking
SQLite text. Unrecognised errors are re-thrown with their message, never
swallowed.

## 6. Schema changes

Only one migration was added: `0008_gate7_registry_commit.sql`.

| Object                                   | Why it is required                             |
| ---------------------------------------- | ---------------------------------------------- |
| `counsel_registry_commits`               | commit marker for safe atomicity/recovery (04) |
| `ux_counsel_commit_operation`            | idempotent retry detection                     |
| `ux_counsel_audit_single_recorded`       | one determination-recorded event               |
| `ux_counsel_audit_single_revocation`     | one revocation per determination               |
| `ux_counsel_audit_single_supersession`   | one supersession per determination             |
| `trg_counsel_commit_no_update/no_delete` | append-only history                            |

No field was added "for later". Migrations 0001–0007 are untouched.

## 7. What is not implemented

- No evidence store, upload or download path (Phase H is metadata only).
- No display, quotation, redistribution, commercial-use, retention or deletion
  feature.
- No production ingestion wiring.
- No live D1 verification.
