# 02 — Test and Verification Results

**Date:** 2026-11-15
**Baseline:** `f289e07` (Gate 13) — 695 tests: 686 pass, 0 fail, 9 skipped.
**Final:** **711 tests — 702 pass, 0 fail, 9 skipped.**

| Check             | Baseline                  | Final                                                     |
| ----------------- | ------------------------- | --------------------------------------------------------- |
| Test files        | 68 (66 passed, 2 skipped) | 69 (67 passed, 2 skipped)                                 |
| Tests             | 695 (686 pass, 9 skip)    | **711 (702 pass, 9 skip)**                                |
| Build             | exit 0                    | exit 0                                                    |
| Biome             | exit 0                    | exit 0, 0 errors                                          |
| New Gate 14 tests | —                         | 11 (`tests/retrieval/gate14-index-authorization.test.ts`) |

## 1. What the tests prove

**Index build** (`gate14-index-authorization.test.ts`, 11 tests, real
`ActivityAuthorizationRegistry` and `createRegistryAuthorization` over
`buildFixtureCorpus()`):

- no registry decision at all → 0 entries, every document reported with
  `NOT_CHECKED` / `no_decision_recorded`;
- a `search_indexing` decision for one source → exactly that source's documents are
  indexed and the rest are reported with their codes;
- the same document authorized only for `viewing` → excluded, with
  `no_decision_recorded` for `search_indexing`: a wrong-activity decision cannot
  index;
- `PROHIBITED` for `search_indexing` → excluded with `prohibited`;
- the resolver is called once per document even when documents have several chunks;
- the removed `authorize` option throws `index_authorization_required`, so it is
  not a silent alias.

**Malformed answers** (5 tests): a bare `{ decision: "AUTHORIZED" }` excludes with
`unknown_activity`; `activity: "viewing"` excludes with `activity_mismatch`;
another document id excludes with `document_mismatch`; a non-canonical decision
excludes with `invalid_decision`; a full correct decision indexes. Each was checked
by reverting `asDecision` to its lenient form — the four malformed-answer tests
fail and the control still passes, so they are not vacuous.

**Projection identity** (5 tests added under Gate 13's file): a resolver answer
that does not name the document and activity it was asked about is refused with the
matching reason, closing the same gap one layer up.

## 2. Tests migrated, and why

| File                                                                                                                                                                                                    | Change                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/benchmark/helpers.ts`                                                                                                                                                                            | `allowSyntheticIndex` now returns a full `DocumentActivityDecision`                                                                                                                                                |
| `retrieval.test.ts`, `exact-identifier-safeguards.test.ts`, `gate9-passage.test.ts`, `gate1-benchmark`, `gate2-benchmark`, `gate2-real-pilot`, `gate3-retrieval`, `gate3-performance`, `gate1-security` | `{ authorize }` → `{ authorization }`; three literal `SearchIndex` builds gained `excludedDocuments: []`                                                                                                           |
| `index-authorization.test.ts`                                                                                                                                                                           | rewritten as a `DocumentActivityAuthorization`; same allow / deny / per-source intent, plus an assertion that denials are reported                                                                                 |
| `counsel-determinations.test.ts`                                                                                                                                                                        | four inline callbacks became one local adapter that still runs `authorizeIndexing`; behaviour changes from once-per-chunk to once-per-document (the corpus there is one document, and no test counts audit events) |
| `gate12-authorization.test.ts`                                                                                                                                                                          | one expected reason literal `unrecognised_decision` → `invalid_decision`, because the resolver path now validates canonical decisions; the caller-assertion path keeps `unrecognised_decision`                     |

No assertion was deleted or loosened. Where a value changed, the change is the new
code or the new field, and it is listed above.

## 3. Regression

| Area                                | Result                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Gate 1–3 benchmarks                 | pass; ranking, fusion and scoring untouched, so benchmark outputs are unaffected |
| Gate 4 source/activity matrix       | pass; untouched                                                                  |
| Gates 6–7 reindex authorization     | pass, now activity-aware                                                         |
| Gate 9 passage contract             | pass                                                                             |
| Gates 12–13 authority authorization | pass; tightened, not weakened                                                    |
| Full suite                          | 711 tests, 0 failures                                                            |

## 4. Intermittent failures observed

Four single-test failures were observed across this gate's runs, all on a run
executing **while a worker was writing files**, and all green standalone and in the
next full run:

1. `tests/benchmark/gate2-benchmark.test.ts` (synthetic PDF case);
2. `tests/retrieval/gate14-index-authorization.test.ts` (four malformed-answer tests,
   seen while their implementation was still being written);
3. `tests/benchmark/gate3-performance.test.ts` — this one is **explained**, not
   merely recorded: it asserts wall-clock and memory thresholds
   (`indexMs < 5000`, `p95 < 100 ms`, RSS delta `< 300 MB`), so a run sharing the
   machine with another worker's build can cross them without any code change. It
   passed on every quiet run, including the final one.

The other two are recorded without explanation. The final count is from a run with
no worker active. The operating rule this gate learned: do not run the suite
concurrently with a file write or another build, and treat any such failure as
suspect until it reproduces on a quiet run.

## 5. Not proven

- No real corpus, no counsel determination, no authorization cell changed.
- Read time remains ungated; the tests prove build-time authorization only.
- D1 remains SQLite-shim validated; this gate touches no storage.
