# Gate 7 — Test and Regression Report

**Date:** 2026-11-14
**Command:** `npx vitest run`
**Engine for D1-shaped tests:** `node:sqlite` shim — supplementary, not D1.

## 1. Headline counts, separated by evidence class

Do not read a single number as "everything is D1-tested". The categories are
deliberately separate.

| Category                                                 | Files | Tests | Result                        | What it actually proves      |
| -------------------------------------------------------- | ----- | ----- | ----------------------------- | ---------------------------- |
| Verified HEAD baseline (`91bb20a`)                       | 44    | 382   | 380 pass, 1 fail, 1 skip      | pre-Gate-7 state             |
| **Final full suite**                                     | 51    | 448   | 446 pass, 1 fail, 1 skip      | no new failures              |
| Gate 7 new files                                         | 7     | 66    | all pass                      | see §2                       |
| Unit                                                     | 13    | 105   | 104 pass, 1 pre-existing fail | pre-existing                 |
| Legal-data / authorization                               | 15    | 163   | all pass                      | in-memory + audit + evidence |
| Integration (incl. migration)                            | 8     | 99    | all pass                      | SQLite shim, not D1          |
| Regression                                               | 1     | 6     | all pass                      | invariants                   |
| Benchmark / citations / retrieval / ingestion / security | 14    | 75    | all pass                      | unchanged                    |

No existing test file changed its test count. The delta is exactly the seven new
files: 382 → 448.

**D1 integration tests:** none passed, because none could run. D1 runtime is
`BLOCKED`. The 99 integration tests run on the SQLite shim and are labelled
`SQLITE_COMPATIBILITY_ONLY`.

## 2. Gate 7 new tests

| File                                               | Tests | Covers                                                                                                                                                                                                             |
| -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/integration/gate7-d1-registry.test.ts`      | 21    | persistence, reads, scoping, rollback, non-atomic partial writes, tamper detection, revocation, supersession, supersession-at-record, terminal race, conflicts, append-only, bounded audit read, audit persistence |
| `tests/integration/gate7-migration.test.ts`        | 7     | 0001–0008 fresh apply, FK, CHECK, JSON/hash/date, append-only, single-terminal-event uniqueness                                                                                                                    |
| `tests/legal-data/gate7-projection-parity.test.ts` | 8     | in-memory vs D1 identical projections across 11 scenarios                                                                                                                                                          |
| `tests/legal-data/gate7-audit-durable.test.ts`     | 10    | D1 sink persistence, async fail-closed, missing-service denial, registry unavailable, no fallback, mid-flight revocation, context safety, evidence denial                                                          |
| `tests/legal-data/gate7-evidence.test.ts`          | 7     | nine evidence states, synthetic-only catalogue, projection denial                                                                                                                                                  |
| `tests/legal-data/authorization-audit.test.ts`     | 7     | acquisition/ingest/temp-storage/reindex grant + denial, audit failure denies                                                                                                                                       |
| `tests/regression/gate7-invariants.test.ts`        | 6     | 350 cells, empty registry, pilot hashes, no new documents, benchmark pin, no evidence store                                                                                                                        |

## 3. Failure-injection detail

`gate7-d1-registry.test.ts` injects a failure at each of the 5 statements of a
determination write, under **two** batch semantics:

| Mode                       | Cases | Assertion                                                                                  |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| Atomic batch (transaction) | 5     | rollback; nothing recorded; projection denies                                              |
| Non-atomic batch           | 5     | partial rows may remain; **no commit marker**; projection denies; incomplete id observable |

10 injected-failure cases. Every one asserts `getDetermination === null`,
`loadState().determinations.length === 0` and `projectFromState().allowed === false`.

## 4. Regression invariants (all pass)

- 25 sources × 14 activities = 350 cells; every `authorization_status` is
  `UNKNOWN`.
- Real registry tables contain 0 rows after a fresh migration.
- `docs/gates/gate-2/PILOT_MANIFEST.json` still lists exactly 4 documents, all
  `source_status: UNKNOWN`.
- `legal-data/pilot/` still contains exactly the four expected files, and each
  present file's SHA-256 equals the manifest entry.
- Gate 1 benchmark results file and fixture manifest still present (the existing
  `gate1-benchmark.test.ts` enforces the pinned content).
- No `legal-data/counsel`, `legal-data/evidence`, `.wrangler/state` or
  `counsel.sqlite` exists.

## 5. Pre-existing failure (not caused by Gate 7)

```
tests/unit/docs-structure.test.ts > has all required doc directories
expected [...] to include 'product'
```

Verified by stashing all Gate 7 work and running the suite at HEAD `91bb20a`:
`380 passed, 1 failed, 1 skipped`. `docs/product`, `docs/data-governance`,
`docs/retrieval` and `docs/api` are absent from HEAD. Gate 6's report of
"381 passed" was therefore inaccurate. The failure is disclosed, not masked, and
not fixed inside Gate 7 to avoid unrelated scope changes.

## 6. Build and lint

| Check               | Result                                               |
| ------------------- | ---------------------------------------------------- |
| `pnpm build`        | exit 0 (all packages and apps typecheck)             |
| `npx biome check .` | 0 errors, 74 warnings (pre-existing warning classes) |

## 7. What the tests do not prove

- D1 batch atomicity, D1 trigger behaviour, D1 constraint enforcement.
- Real D1 concurrency.
- That any real counsel determination exists or authorizes anything.
- That any pilot document is ready for ingestion.
