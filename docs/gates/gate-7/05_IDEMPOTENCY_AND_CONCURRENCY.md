# Gate 7 — Idempotency and Concurrency

**Date:** 2026-11-14
**Enforcement:** database constraints + explicit repository checks. No in-memory
lock is relied on for correctness.

## 1. Idempotency contract

| Operation             | Identity                                       | Retry behaviour                                                                                                     | Overwrite?        |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Register professional | `counsel_professionals.id`                     | duplicate → `duplicate_counsel_id`                                                                                  | never             |
| Record determination  | `counsel_determinations.id`                    | identical payload → `ALREADY_COMMITTED` (existing audit returned); different payload → `duplicate_determination_id` | never             |
| Activity decision     | `(determination_id, activity)` unique          | duplicate → `duplicate_activity_decision`                                                                           | never             |
| Commit/operation      | `counsel_registry_commits.operation_id` unique | duplicate operation → `duplicate_operation_id`                                                                      | never             |
| Revocation            | one `REVOKED` event per determination          | second → `already_revoked`                                                                                          | never             |
| Supersession          | one `SUPERSEDED` event per determination       | second → `already_superseded`                                                                                       | never             |
| Status change         | append-only `STATUS_CHANGED`                   | appended; terminal states refuse further change                                                                     | history preserved |

**Same operation** means the same determination id with a payload that is equal
after normalisation (sorted condition/limitation/permitted-user lists, sorted
activities). Two different counsel determinations always have different ids; the
adapter never treats two ids as the same event.

**Retry detection** is by primary/unique key in the database, not by a memory
map. `ALREADY_COMMITTED` is returned only when the stored payload hash matches,
so a retry can never mask a changed decision.

**Recovery** for a partially written determination is recording it under a new id;
the same id is refused (`incomplete_record_exists`). See 04 §4.

## 2. Concurrency

| Race                                   | Defence                                                | Observed result (shim)                                            |
| -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Two identical determination writes     | primary key + commit unique index                      | exactly one `RECORDED`; the other `ALREADY_COMMITTED` or rejected |
| Two different determinations, same id  | payload comparison                                     | `duplicate_determination_id`                                      |
| Two revocations                        | `ux_counsel_audit_single_terminal`                     | second rejected (constraint or pre-check)                         |
| Two supersessions                      | `ux_counsel_audit_single_terminal`                     | second rejected                                                   |
| Concurrent revoke + supersede          | `ux_counsel_audit_single_terminal` (one terminal slot) | exactly one succeeds; the database rejects the other              |
| Revoke while a projection is in flight | every decision re-reads state; no cache                | next decision denies                                              |
| Audit retried                          | `authorization_audit_events.id` primary key            | duplicate id rejected, not silently duplicated                    |

Concurrency tests run through `Promise.all` and assert the invariants above; they
exercise the adapter, not a database engine's isolation.

## 3. Supersession conflicts

Two different replacement determinations for the same scope are both `ACTIVE`.
Projection counts matching active determinations and denies with
`conflicting_determinations`. Superseding an old determination twice is rejected
at write time. A replacement cannot supersede a revoked determination.

## 4. Stale authorization

There is no authorization cache in Gate 7. `CounselAuthorizationService` calls
`loadState` for every decision, so a revocation committed before the next decision
is always seen. A decision that was already returned can still be acted on by a
long-running caller: the contract is **re-authorize before each content access**,
and the decision carries `evaluatedAt` and `registryRevision` so callers can
detect that state moved.

## 5. Observable conflicts

Conflicts are observable through:

- `listIncompleteDeterminations(sourceId)` — partial writes;
- projection reasons (`conflicting_determinations`, `already_superseded`,
  `duplicate_*`);
- the centralized audit trail (`CONFLICT_DETECTED`, `RETRY_DENIED`,
  `REGISTRY_UNAVAILABLE`).

## 6. Residual risk

- D1's real isolation and retry behaviour is unverified.
- `changed_at` ordering resolves simultaneous status changes; with identical
  timestamps `rowid` breaks the tie. This is deterministic on SQLite/D1 but not a
  distributed consensus.
- A caller that ignores `allowed: false` is outside this gate's control; no
  content path in this repository does.
