# Gate 7 — Atomicity and Failure Validation

**Date:** 2026-11-14
**Result:** design safe under atomic **and** non-atomic batch execution.
**D1 runtime:** **verified for safe recovery** on actual D1 (see §8); local workerd
remains blocked.

## 1. Why this is not a D1 atomicity claim

D1 documents `batch()` as one implicit transaction. That behaviour could not be
observed on this host, and the gate forbids asserting it. Therefore the design
assumes nothing about batch atomicity: it must be correct under either semantic.

## 2. Commit-last marker

A determination write is an ordered statement list:

```
1. INSERT counsel_determinations
2. INSERT counsel_activity_decisions   (one per activity)
3. INSERT counsel_audit_events         (DETERMINATION_RECORDED)
4. INSERT counsel_registry_commits     (payload_hash, LAST)
```

Projection trusts a determination only when statement 4 succeeded **and** the
stored payload hashes to the committed value.

| Batch semantics     | Crash before 4                                     | Crash after 4                       |
| ------------------- | -------------------------------------------------- | ----------------------------------- |
| Atomic (documented) | whole batch rolls back; nothing visible            | all rows visible, hash matches      |
| Non-atomic          | partial rows remain; no marker → invisible, denied | impossible unless 1–3 all succeeded |

Because the marker is last, its presence is evidence that every earlier statement
succeeded, even without a transaction. Because load re-computes the hash, a marker
cannot vouch for altered rows.

## 3. Partial state cannot authorize

`loadState` filters out:

- rows with no commit;
- rows whose commit points at a different source;
- rows whose canonical payload no longer matches `payload_hash`.

The projection then runs only over the filtered set. A partial determination is
therefore indistinguishable from no determination: `no_verified_determination`.

## 4. Recovery

Partial rows are append-only and cannot be deleted. They are inert and listable
via `listIncompleteDeterminations(sourceId)`.

Deterministic recovery:

1. an operator sees the incomplete id;
2. the determination is recorded again **under a new id** with a complete payload;
3. the incomplete row stays in history, permanently non-projecting.

A retry with the **same** id is refused (`incomplete_record_exists`). This is
deliberate: the adapter cannot know whether the original payload was complete, so
it refuses to guess. Nothing is silently replaced.

## 5. Failure injection matrix

Shim: `tests/helpers/d1-sqlite.ts`, options `atomicBatch` and `failBatchAt`.
Suite: `tests/integration/gate7-d1-registry.test.ts`.

Statements per determination write: 1 + 2 activities + 1 audit + 1 commit = 5.

| Failure point                 | Atomic shim      | Non-atomic shim               | D1         |
| ----------------------------- | ---------------- | ----------------------------- | ---------- |
| 1 before determination insert | rollback, 0 rows | 0 rows                        | not tested |
| 2 first activity              | rollback, 0 rows | determination only, no marker | not tested |
| 3 second activity             | rollback, 0 rows | det + 1 activity, no marker   | not tested |
| 4 audit insert                | rollback, 0 rows | det + 2 activities, no marker | not tested |
| 5 commit insert               | rollback, 0 rows | all rows, **no marker**       | not tested |

Assertions for every row: `getDetermination` → `null`; `loadState` → 0
determinations; `projectFromState` → `allowed === false`.

Non-atomic cases additionally assert exactly one incomplete id (except failure at
statement 1, which writes nothing).

## 6. Other atomicity tests

- duplicate determination id → whole batch rejected, audit count unchanged;
- duplicate activity decision → rejected, determination absent;
- append-only triggers reject UPDATE/DELETE on determinations, audit events and
  commits;
- audit insert failure denies the authorization decision (06);
- retry after success → `ALREADY_COMMITTED`, no duplicate audit row;
- retry after partial failure → `incomplete_record_exists`, no second write.

## 7. Residual risk

If D1 executes batch statements concurrently rather than in order, "last" would
not be an ordering guarantee. D1's documented behaviour is sequential within a
batch. The HTTP API cannot issue a transactional batch, so the binding-level
`batch()` path is still unexercised; the design does not depend on it.

## 8. Actual D1 verification

`tests/integration/gate7-d1-remote.test.ts` ran against real D1 through the
official HTTP API, with `batch()` executed sequentially (i.e. deliberately
non-atomic). Results: **8/8 passed**.

The injected-failure test repeats the matrix from §5 against the real engine:
for every statement index 1–5 the write fails, `getDetermination` returns `null`,
`loadState` returns no determinations, and `listIncompleteDeterminations` shows the
partial row for indices 2–5. This is the safe-recovery property, verified on D1
rather than inferred from SQLite.

Verified on D1: commit-marker invisibility, payload-hash integrity, append-only
triggers, idempotent retry, revocation immediacy, and a concurrent
revoke/supersede race producing exactly one terminal event.

Not verified on D1: Workers binding `batch()` atomicity. The residual risk is
bounded and fail-closed: if the marker were not written, projection denies.
