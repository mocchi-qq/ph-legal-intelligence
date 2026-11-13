# Gate 6 — D1 Registry Design

**Date:** 2026-11-13
**Status:** schema validated on SQLite-compatible SQL; D1 adapter **not implemented**.

## 1. Decision

A live D1 adapter was **not** implemented or claimed. The exact blocker is documented in §6. Migrations 0001–0006 were executed against an actual SQLite engine (`node:sqlite`) and their constraints, triggers and transaction rollback were tested; that is **not** D1 runtime verification.

## 2. Architecture boundary

The intended separation is:

| Layer                    | Current state                                                   |
| ------------------------ | --------------------------------------------------------------- |
| Domain model             | `CounselDetermination`, activity decisions, audit events        |
| Repository interface     | `CounselDeterminationRepository` contract (in-memory reference) |
| In-memory implementation | Implemented and tested; deterministic unit tests                |
| D1-backed implementation | **Not implemented** (blocker below)                             |
| Authorization projection | `project`, `toGate4Decision`, `syncToAuthorizationRegistry`     |
| Audit recording          | Append-only repository events + SQL audit table                 |

Business logic is not written against raw SQL. A future D1 adapter must implement the same contract and hydrate the domain repository; it must not duplicate projection logic.

## 3. Schema

Migration 0005 defines the core tables. Migration 0006 adds additive validation triggers for JSON arrays, hex hashes and ISO dates.

- `counsel_professionals`
- `counsel_determinations`
- `counsel_activity_decisions`
- `counsel_audit_events`

Key constraints:

- 16 canonical activities; 9 determination statuses; 5 activity-decision statuses.
- `UNIQUE (determination_id, activity)`.
- Foreign keys to counsel and determinations.
- Verified counsel requires evidence, verifier and date.
- `VERIFIED_FOR_RECORDING` requires issue date, decision document reference and evidence.
- Conditional approval requires conditions.
- Decision-document hash, if present, must be 64 hex characters.
- `BEFORE UPDATE` / `BEFORE DELETE` triggers abort on all four tables.

## 4. Transaction plan

A logical determination write is:

1. Insert determination row.
2. Insert all activity-decision rows.
3. Insert evidence metadata references.
4. Insert audit event.

The adapter must make this atomic. For D1, the candidate is `db.batch([...])`, but **D1 batch failure semantics were not verified** in this environment. A partially written determination must never project authorization. If batch is not atomic for this workload, use a staging record with a `PENDING` status and only promote after all rows are present; projection must ignore pending records.

## 5. Append-only and evidence

- History is append-only; revocation/supersession add events, never delete rows.
- Evidence references and hashes are stored, not raw counsel documents.
- A hash proves byte integrity only; it does not prove author identity or authority.
- Projection must trace every decision to a determination ID and audit event.

## 6. Exact blocker

This host cannot start Wrangler's local D1 runtime:

```
wrangler d1 execute DB --local --command "SELECT 1"
...
TCMalloc: FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
... write EPIPE
```

The environment is a constrained ARM/PRoot container; no local D1 database binding is configured for this repository. Therefore:

- No actual D1 query was executed.
- No D1 transaction/batch failure behavior was verified.
- No adapter is claimed operational.

Implementing a blind adapter and testing it only against a mocked database would violate Gate 6's own rule against claiming D1 integration from mocks.

## 7. Safe next step

On a host with a working local D1/Miniflare environment:

1. Apply migrations 0001–0005 to a clean local D1 database.
2. Implement a `D1CounselRepository` against the domain contract.
3. Test determination + activities + audit atomicity, duplicate rejection, FK failure, revocation/supersession, and conflict detection.
4. Test projection consistency between the in-memory and D1 implementations.
5. Only then mark durable persistence operational.

## 8. Conclusion

The schema is ready for an adapter; the adapter is deliberately deferred. Gate 6 does not claim a complete durable registry.
