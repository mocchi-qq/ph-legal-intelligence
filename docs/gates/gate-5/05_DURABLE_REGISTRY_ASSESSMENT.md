# Gate 5 — Durable Registry Readiness Assessment

**Date:** 2026-11-13
**Schema:** `migrations/d1/0005_gate5_counsel_determinations.sql`
**Repository model:** `CounselDeterminationRepository`

## 1. Decision

A durable schema and repository model are **implemented and tested in memory**. A live D1 adapter is **not implemented**. The project is ready to receive and structure determinations, but it is not a production authorization store.

This is a bounded implementation, not a production ingestion service.

## 2. Schema

Migration 0005 adds four additive tables:

| Table                        | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `counsel_professionals`      | Counsel identity, capacity and verification evidence                            |
| `counsel_determinations`     | Determination scope, dates, status, evidence and supersession                   |
| `counsel_activity_decisions` | One row per determination × activity (16 activities)                            |
| `counsel_audit_events`       | Append-only registration, recording, status, supersession and revocation events |

Constraints:

- `UNIQUE (determination_id, activity)` prevents duplicate activity rows.
- Foreign keys link determinations to counsel and activity decisions to determinations.
- CHECK constraints enumerate the 16 activities, determination statuses and activity-decision statuses.
- `VERIFIED` counsel requires verification evidence, verifier and date.
- `VERIFIED_FOR_RECORDING` requires an issue date, decision document reference and evidence.
- Conditional approval requires conditions.
- Decision-document hash, if present, must be 64 hex characters.
- `BEFORE UPDATE` / `BEFORE DELETE` triggers abort on all four tables.

## 3. Repository model

`CounselDeterminationRepository` implements:

- counsel registration with verification status;
- immutable determination records;
- append-only status transitions, supersession and revocation;
- active-determination lookup filtered to `VERIFIED_FOR_RECORDING` and not revoked/superseded;
- fail-closed projection by exact source, activity, document scope, dates and conditions;
- conflict detection when multiple active determinations cover the same source/activity;
- projection into the Gate 4 enforcement registry, including a `PROHIBITED` override when a prior authorization is no longer supported;
- audit history.

## 4. Transaction and atomicity

The in-memory repository validates before mutating any array. A failed record does not add a determination or a determination event; only the earlier counsel-registration event remains. Tests cover this.

The SQL schema uses a primary key, unique activity constraint and foreign keys. A future D1 adapter must wrap determination + activity rows + audit event in one transaction. No such adapter exists yet, so transaction behavior against D1 is **not tested**.

## 5. Uniqueness and immutability

- Determination IDs are primary keys; duplicate recording is rejected.
- Activity rows are unique per determination/activity.
- Records and audit events are append-only in both the repository and the schema.
- Supersession and revocation add events; they do not delete the prior determination.

## 6. Migration and rollback

- Migration 0005 is additive and does not alter 0001–0004.
- Rollback would drop the four Gate 5 tables only if the project explicitly decides to discard Gate 5 records. No automated destructive rollback is provided; that is intentional.
- Migration 0004 already added the Gate 4 enforcement tables and ingestion-run columns.

## 7. Gaps

1. No D1 client or adapter; the SQL is not applied to a live database in this environment.
2. No production authentication or actor identity; `recordedBy`/`actor` are caller-supplied.
3. No signed-document verification; counsel identity verification is operational.
4. No transaction test against D1.
5. No deletion/retention policy; revocation does not automatically delete stored content. That consequence requires counsel and an approved retention policy.

## 8. Conclusion

The durable registry design is ready for a later, controlled D1 adapter. Gate 5 does not claim that persistence is operational.
