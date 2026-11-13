# Gate 6 — Test and Security Report

**Date:** 2026-11-13

## 1. Commands and results

| Command                               | Result                                          |
| ------------------------------------- | ----------------------------------------------- |
| `npx vitest run`                      | **381 passed, 1 skipped** (44 files, 382 tests) |
| `pnpm build`                          | exit 0                                          |
| `npx biome check .`                   | exit 0; 0 errors, 68 warnings                   |
| Gate 1 benchmark test                 | passed; hash pin intact                         |
| Pilot SHA-256 recomputation           | all four match `PILOT_MANIFEST.json`            |
| Migrations 0001–0006 on `node:sqlite` | 9 tests passed                                  |

Skipped: the Gate 2 live pilot (`PH_LIVE_PILOT=1`, network). Not run and not claimed.

## 2. Gate 6 tests added (33)

| File                                              | Tests | Coverage                                                                                                                           |
| ------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tests/legal-data/counsel-determinations.test.ts` |    +9 | reindex authorization, temp-local-storage authorization, evidence unavailability, revocation without deletion                      |
| `tests/integration/gate6-d1-schema.test.ts`       |     9 | migration order, constraints, duplicate/FK/status rejection, append-only triggers, transaction rollback, JSON/hash/date validation |
| `tests/integration/gate6-taxonomy.test.ts`        |     5 | 16 canonical, 14 runtime, migration/form/matrix mapping, extended activities                                                       |
| `tests/retrieval/index-authorization.test.ts`     |     4 | missing authorizer, allow, deny-all, per-document isolation                                                                        |
| `tests/legal-data/pdf.test.ts`                    |    +2 | temp-storage denial before write, missing authorizer                                                                               |

## 3. Security-critical assertions

- `buildSearchIndex` throws without an authorizer; denial yields an empty index.
- The PDF parser returns `REJECTED` before `mkdtemp`/write when temp storage is missing or denied.
- A determination for `temporary_processing` does not authorize `temporary_local_storage`.
- A determination for `text_extraction` + `search_indexing` does not authorize reindexing without `temporary_processing`.
- Revocation blocks projection and appends a Gate 4 `PROHIBITED` override; no stale authorization remains.
- Expiry, document scope, source scope, conflicts and omitted activities deny.
- A revoked retention decision does not delete the synthetic document.
- Evidence-unavailable projection denies.
- D1 schema constraints reject unknown activity, invalid status, duplicate activity, missing FK, and unauthorized VERIFIED rows.
- Append-only triggers reject update/delete of determinations and audit events.
- SQLite transaction rollback removes an incomplete determination.

## 4. Regression invariants

- Real counsel determinations remain **0**.
- All 350 Gate 4 cells remain `UNKNOWN`.
- Four pilot documents remain `BLOCKED_AUTHORIZATION`.
- No new real document acquired, ingested or reprocessed.
- Pilot hashes unchanged.
- Gate 1 benchmark unchanged.
- No deployment or push.

## 5. Not tested

- Live D1 adapter and D1 transaction semantics (no adapter; Wrangler local D1 OOM).
- Reindex/display/export/retention services (not implemented).
- Background/admin operations (none exist).
- Real evidence-file availability (no evidence store).
- Authentication/tenancy.

## 6. Assessment

All implemented content-access paths with a runtime now have an authorization boundary:

- acquisition, ingestion, in-memory processing, persistent storage, extraction and indexing;
- temporary local storage through the required parser callback;
- reindexing through the required index authorizer.

Unimplemented features are recorded as future boundaries, not claimed as enforced.
