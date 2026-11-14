# Gate 7 — Migration and Compatibility Validation

**Date:** 2026-11-14
**Engine used:** `node:sqlite` (`DatabaseSync`) — **not D1**. Supplementary only.
**Suite:** `tests/integration/gate7-migration.test.ts`

## 1. Sequence

| Migration | Purpose                         | Modified by Gate 7                          |
| --------- | ------------------------------- | ------------------------------------------- |
| 0001      | legal documents and core tables | no                                          |
| 0002      | Gate 1 ingestion                | no                                          |
| 0003      | owner authorization             | no                                          |
| 0004      | Gate 4 activity authorization   | no                                          |
| 0005      | Gate 5 counsel records          | no                                          |
| 0006      | Gate 6 JSON/hex/date triggers   | no                                          |
| 0007      | Gate 7 authorization audit      | added by the draft Gate 7 attempt, retained |
| 0008      | Gate 7 registry commit marker   | **new in this gate**                        |

Only `0008` was added here. `0007` already existed uncommitted and was reviewed
and retained.

## 2. Results on the SQLite-compatible engine

| Check                                                      | Result                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fresh database, 0001→0008                                  | applies cleanly                                                                     |
| Required tables present                                    | pass                                                                                |
| Re-apply 0007 + 0008                                       | idempotent, no error                                                                |
| Re-apply the full 0001–0008 sequence                       | fails at 0001 `ALTER TABLE` (`duplicate column name`)                               |
| Foreign keys                                               | enforced (determination→professional, activity→determination, commit→determination) |
| Status / activity `CHECK`s                                 | enforced                                                                            |
| Determination uniqueness                                   | enforced                                                                            |
| `(determination_id, activity)` uniqueness                  | enforced                                                                            |
| JSON object/array validation (0006, 0007)                  | enforced                                                                            |
| Hash length/hex validation (0006, 0008)                    | enforced                                                                            |
| Date validation (0006, 0007, 0008)                         | enforced                                                                            |
| Append-only triggers (0005, 0007, 0008)                    | enforced                                                                            |
| Single `REVOKED` / `SUPERSEDED` / `DETERMINATION_RECORDED` | enforced by partial unique indexes                                                  |
| Commit `operation_id` uniqueness                           | enforced                                                                            |
| Failure and rollback                                       | covered in `04` and the integration suite                                           |

## 3. Non-idempotent history

`0001` adds columns with `ALTER TABLE`, so a second full pass is rejected. This is
a pre-existing property of the frozen migration history. Rewriting 0001–0006 is
prohibited, so the limitation is recorded rather than fixed. Deployments apply the
sequence once; 0007 and 0008 are safe to re-run.

## 4. Compatibility with existing records

- All new objects are additive; no existing column changes type or meaning.
- `counsel_registry_commits` has a foreign key to `counsel_determinations`, so it
  cannot orphan.
- A determination recorded before Gate 7 (none exist in the real registry) would
  have no commit marker and would therefore be denied by projection. That is the
  fail-closed direction, and it is documented rather than auto-migrated: inventing
  commit markers for unverified historical rows would be an authorization grant.

## 5. D1 acceptance status

D1 runtime validation is **BLOCKED**. The exact commands to repeat this validation
against a real local D1 binding are in `01_D1_RUNTIME_FEASIBILITY.md` §5. No claim
of D1 migration compatibility is made.
