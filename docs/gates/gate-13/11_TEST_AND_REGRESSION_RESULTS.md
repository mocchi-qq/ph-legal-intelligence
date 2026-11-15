# 11 — Test and Regression Results

**Date:** 2026-11-15
**Baseline:** `e834045` (Gate 12) — 642 tests: 633 pass, 0 fail, 9 skipped.
**Final:** **695 tests — 686 pass, 0 fail, 9 skipped.**

| Check                | Baseline                  | Final                                           |
| -------------------- | ------------------------- | ----------------------------------------------- |
| Test files           | 65 (63 passed, 2 skipped) | 68 (66 passed, 2 skipped)                       |
| Tests                | 642 (633 pass, 9 skip)    | **680 (671 pass, 9 skip)**                      |
| Build (`pnpm build`) | exit 0                    | exit 0                                          |
| Biome                | exit 0                    | exit 0, 0 errors                                |
| New Gate 13 tests    | —                         | **38** (20 contract, 11 projection, 7 verifier) |

## 1. Gate 13 tests

| File                                        | Tests | Result |
| ------------------------------------------- | ----- | ------ |
| `tests/authority/gate13-contract.test.ts`   | 20    | pass   |
| `tests/authority/gate13-projection.test.ts` | 11    | pass   |
| `tests/authority/gate13-verifier.test.ts`   | 7     | pass   |

## 2. Regression, per area the gate spec named

| Area                                      | Result                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Gate 1 benchmark/ingestion                | pass (`tests/benchmark`, `tests/integration`)                    |
| Gate 2 acquisition safeguards             | pass (`tests/legal-data`)                                        |
| Gates 3–4 source/activity authorization   | pass (`tests/authorization`, matrix untouched)                   |
| Gate 5 counsel determination immutability | pass (`tests/counsel`)                                           |
| Gate 6 temporary storage and reindexing   | pass (`tests/integration`, pipeline activities)                  |
| Gate 7 D1 registry behaviour              | pass on the SQLite shim (remote D1 test skipped, as at baseline) |
| Gate 12 target/source fail-closed         | pass; 15 tests retained, only `activity` added to requests       |
| Gate 12 supersession ordering             | pass, retained unchanged                                         |
| Gate 12 resolver memoisation              | pass, now extended to `(documentId, activity)`                   |
| Gate 12 `projectUnchecked()`              | retained and passing                                             |

## 3. Tests modified, and exactly why

| File                                                                                | Change                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authority-core.test.ts`                                                            | `activity: "citation_display"` added to the helpers and two literals. No assertion changed. `projectUnchecked()` retained.                                                                                                                                                                                                                                |
| `core.test.ts`                                                                      | `activity` added to two helpers and two inline requests. No assertion changed.                                                                                                                                                                                                                                                                            |
| `temporal.test.ts`                                                                  | `activity` added to both queries. No assertion changed.                                                                                                                                                                                                                                                                                                   |
| `gate12-authorization.test.ts`                                                      | `activity` added to the request helper and both temporal queries. **Two expected values changed**, each because a code was added and nothing else: `missing` for the UNAUTHORIZED case gained `activity:citation_display`; the scalar-AUTHORIZED regression test gained `authorizationSource: "caller_asserted"` and the two-entry `authorizationChecks`. |
| `gate10-bridge.test.ts`, `gate12-bridge-auth.test.ts`, `authority-d1-store.test.ts` | `activity: "citation_display"` added to lookups and projection calls; one `missing` array in `gate12-bridge-auth` gained `activity:citation_display`.                                                                                                                                                                                                     |
| `tests/citations/gate10-authority.test.ts`                                          | no change needed (it injects an inline authority function, not the lookup).                                                                                                                                                                                                                                                                               |

No test was deleted, and no assertion was loosened. The two changed arrays were
checked to differ only by the added code and the new trace fields.

## 4. Intermittent failures, recorded rather than explained

Two single test failures were observed across roughly a dozen full-suite runs, each
on the first run immediately after a concurrent worker finished writing files, and
each passing in isolation and in every following full run:

1. `tests/authority/core.test.ts > returns UNKNOWN for a calendar date that does
   not exist` (before any Gate 13 change);
2. `tests/authority/gate13-contract.test.ts > memoisation > keys the memo on the
   as-of instant…` (immediately after the memo change landed).

Both are recorded as observed and not reproduced. Neither is used as evidence for
anything in this gate, and the final count is stated from a run in which the suite
was green. An honest report says this rather than claiming a perfectly stable
suite; a cause has not been established.

## 5. D1 verification level

- The SQLite shim (`tests/helpers/d1-sqlite.ts`, migrations `0001`–`0009`) is used by
  the end-to-end tests. That is **SQLite compatibility**, not D1 runtime.
- `tests/integration/gate7-d1-remote.test.ts` is skipped as at baseline; no remote
  D1 binding or workerd run was performed.
- **No migration was added or changed** in this gate, so no D1 storage decision was
  required: the activity matrix already stores `(sourceId, activity, status, basis,
  conditions, expiresAt)`.

## 6. What the tests do not prove

- That any real source/activity cell is authorized — all 350 remain `UNKNOWN`.
- That a caller-asserted scalar decision is truthful; the tests prove only that the
  system records it as `caller_asserted` and still refuses it when it is not
  `AUTHORIZED`.
- That the document → source mapping used in production is correct; tests inject it.
- That D1 behaves transactionally under the real binding.

## 7. Reproduce

```
npx vitest run                                   # 680 tests
npx tsc --noEmit -p packages/legal-ingestion/tsconfig.json
npx tsc --noEmit -p packages/citation-engine/tsconfig.json
pnpm build
npx biome check .
```
