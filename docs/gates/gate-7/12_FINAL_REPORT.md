# Gate 7 — Final Report

**Date:** 2026-11-14
**Verdict:** **BLOCKED** — durable implementation complete, D1 runtime not
verifiable on this host.
**Gate 6 baseline:** `91bb20a` (38 commits)
**Gate 7 implementation commit:** `71fc9df` (39 commits total).

## 1. Summary

Gate 7 replaced the in-memory-only counsel registry with a repository contract
that has two adapters: the existing in-memory repository (deterministic tests) and
a D1-backed registry with commit-marker writes. It added a shared projection
function so both adapters make identical decisions, a centralized authorization
audit with a fail-closed correction to the draft, an evidence-availability
contract, and 66 new tests.

It did **not** make any source or activity authorized. Counsel determinations
remain zero, all 350 cells remain `UNKNOWN`, and the four pilot documents remain
`BLOCKED_AUTHORIZATION`.

The gate cannot be `ACCEPTED` because the D1 runtime cannot start on this host
(workerd TCMalloc failure under PRoot). The adapter is therefore
`IMPLEMENTED_UNVERIFIED`, and the verdict is `BLOCKED` with an exact runbook for a
capable host.

## 2. Required status categories

### D1 implementation

`IMPLEMENTED_UNVERIFIED`

### Atomicity

`SQLITE_COMPATIBILITY_ONLY`

### Audit coverage

`ALL_IMPLEMENTED_PATHS_COVERED` (when the audit service is supplied; absence now
denies)

### Authorization

`UNKNOWN` — 350 cells, none changed

### Counsel determination

`NOT_RECEIVED` — 0 received

### Corpus readiness

`BLOCKED_AUTHORIZATION` — 4 of 4 pilot documents

## 3. Execution report (28 items)

1. **Verdict.** `BLOCKED`.
2. **Repository.** Branch `main`; HEAD at gate start `91bb20a`; 38 commits;
   working tree was **not** clean — an uncommitted Gate 7 draft was present and is
   disclosed in `00_BASELINE_AND_PLAN.md`.
3. **Files created or modified.** See §4.
4. **Migration changes.** One new migration `0008_gate7_registry_commit.sql`.
   0001–0006 unmodified; 0007 was a pre-existing uncommitted draft, reviewed and
   retained.
5. **D1 runtime used.** None. No D1-compatible runtime could be started.
6. **D1 compatibility evidence.** None. Only `node:sqlite` shim evidence exists.
7. **Migration execution.** 0001–0008 apply on the SQLite shim; 0007/0008 are
   idempotent; the full history is not re-runnable (pre-existing `ALTER TABLE` in
   0001). No D1 execution.
8. **Repository contract and adapter.** `CounselRegistry` implemented by
   `InMemoryCounselRegistry` and `D1CounselRegistry`; parity verified for 11
   scenarios.
9. **Atomic writes and rollback.** Commit-last marker plus payload hash; 10
   injected-failure cases (5 statements × atomic/non-atomic) all deny. D1 rollback
   untested.
10. **Idempotency and concurrency.** Duplicate ids, activities, operations and
    terminal events rejected; identical retry returns `ALREADY_COMMITTED`; changed
    retry rejected; concurrent revoke/supersede yields one terminal event.
11. **Revocation and expiry.** Revocation removes the determination from the active
    set; the next projection denies. Expiry denies. Supersession denies the old
    determination. No content is deleted.
12. **Durable projection.** `CounselAuthorizationService` loads state from the
    registry, projects with the shared function, and records the decision. No
    cache. `PRODUCTION_D1` refuses an in-memory registry.
13. **Central audit coverage.** Acquisition, ingestion (4 activities), temporary
    local storage, reindexing and durable projection, for grant and denial.
    `audit-coverage.json`.
14. **Temporary-storage audit.** Denial and grant recorded before any file write;
    missing/failing audit denies; regression test added.
15. **Reindexing audit.** Denial and grant recorded for the three activities;
    missing/failing audit denies.
16. **Evidence availability.** Nine distinct states; default store is
    unavailable; `AVAILABLE_UNVERIFIED` denies; synthetic-only test catalogue.
17. **Unit tests.** 105 tests, 104 pass, 1 pre-existing failure.
18. **D1 integration tests.** 0 run — blocked. SQLite-shim integration: 99 pass.
19. **Build and lint.** `pnpm build` exit 0; biome 0 errors, 74 warnings.
20. **Independent review.** Two reviews, 2 blockers, 3 majors, 5 minors, 3 nits.
    Both blockers and three majors fixed; the rest accepted with recorded risk.
21. **Counsel determinations received.** 0.
22. **Authorization cell counts.** 25 × 14 = 350; 0 authorized, 0 conditional, 0
    restricted, 0 prohibited; 350 `UNKNOWN`.
23. **Pilot status and hashes.** 4 documents, all `BLOCKED_AUTHORIZATION`; manifest
    hashes unchanged and re-verified by test.
24. **Corpus readiness.** `BLOCKED_AUTHORIZATION`.
25. **Remaining blockers.** (a) D1 runtime verification; (b) external counsel
    determinations; (c) no production ingestion wiring; (d) in-flight
    re-authorization contract is documented, not enforced by the callee.
26. **No new real documents.** Confirmed: none acquired, ingested, extracted,
    indexed, embedded or reprocessed.
27. **No deployment or push.** Confirmed: none.
28. **Exact next action.** Run the §5 runbook from `01_D1_RUNTIME_FEASIBILITY.md`
    on a host where workerd starts; then re-run the failure matrix against D1 and
    update `09`, `04`, `10` and the status JSON.

## 4. Files

**Code**

- `packages/legal-ingestion/src/counsel-projection.ts` (new)
- `packages/legal-ingestion/src/counsel-registry.ts` (new)
- `packages/legal-ingestion/src/evidence.ts` (new)
- `packages/legal-ingestion/src/authorization-audit.ts` (rewritten)
- `packages/legal-ingestion/src/counsel-d1-store.ts` (rewritten)
- `packages/legal-ingestion/src/counsel-determinations.ts` (shared projection,
  audit on temp storage/reindex, supersession guard)
- `packages/legal-ingestion/src/acquisition.ts`, `pipeline.ts`, `types.ts`,
  `index.ts` (audit integration and exports)

**Schema**

- `migrations/d1/0008_gate7_registry_commit.sql` (new)
- `migrations/d1/0007_gate7_authorization_audit.sql` (draft, retained)

**Tests**

- `tests/helpers/d1-sqlite.ts` (atomic + non-atomic batch, failure injection)
- `tests/integration/gate7-d1-registry.test.ts`
- `tests/integration/gate7-migration.test.ts`
- `tests/legal-data/gate7-projection-parity.test.ts`
- `tests/legal-data/gate7-audit-durable.test.ts`
- `tests/legal-data/gate7-evidence.test.ts`
- `tests/legal-data/authorization-audit.test.ts`
- `tests/regression/gate7-invariants.test.ts`

**Docs**

- this directory, `KANBAN.md`

## 5. Strict boundary after Gate 7

Unchanged and still in force: counsel determinations remain zero unless genuine
determinations are received and verified; 350 cells remain `UNKNOWN`; the four
pilot documents remain `BLOCKED_AUTHORIZATION`; no new documents; the 20–50
document target is inactive; no bulk acquisition; no production ingestion; no
commercial-reuse assumption; no legal-correctness claim; no deployment.
`sc_elibrary` remains only the first source selected for review — selection is not
authorization.

**Persistence is an engineering requirement, not a substitute for counsel
authorization.**
