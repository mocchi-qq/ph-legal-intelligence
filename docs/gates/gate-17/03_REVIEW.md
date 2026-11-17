# 03 — Independent Review

**Date:** 2026-11-17
**Review:** one read-only pass, reviewer on the other lane from the author, over the
writer, its tests and the chain test.

## Findings and disposition

| #   | Severity | Finding                                                                                                                                                                                                                         | Disposition                                                                                                                                                                                                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CRITICAL | The sequential fallback (no `batch`) has no transaction, so a failure on a later table leaves earlier tables written; and `report.inserted` was incremented before execution, so the report could claim rows that never landed. | **FIXED** — `db.batch` is now required and a missing batch throws `batch_required` before any read or write; counts are taken only after `batch()` resolves, and a thrown batch reports zero. The class of half-write is removed rather than documented. |
| 2   | HIGH     | A replay with a different `options.now` reported every row as conflicting, because `created_at` participates in the comparison.                                                                                                 | **FIXED** — `created_at` and `updated_at` are excluded from the equality check; replay compares business columns only. They are still written on insert.                                                                                                 |
| 3   | HIGH     | Two rows with the same id inside one corpus bypass the pre-check (the map keeps one) and hit a UNIQUE violation mid-write.                                                                                                      | **FIXED** — duplicates are detected per table while building rows and reported as `<table>:duplicate_id_in_corpus`; nothing is written.                                                                                                                  |
| 4   | HIGH     | Columns that are NOT NULL with a schema default were bound `null` (e.g. `legal_documents.updated_at`, `source_manifestations.acquisition_status`), failing at insert rather than at the check.                                  | **FIXED** — columns with a default are omitted when the corpus value is absent so the default applies; NOT NULL columns without a default produce `<table>:missing_required:<column>` and abort.                                                         |
| 5   | MEDIUM   | CHECK vocabularies and foreign-key targets were only validated by the database, so a bad value surfaced as a mid-write crash.                                                                                                   | **FIXED** — every CHECK-constrained column is validated against the vocabulary read from the migrations, and every FK against an existing row or a pending row in an earlier table, both reported as conflicts before any write.                         |
| 6   | MEDIUM   | `updated_at` had no clock fallback and would cause false conflicts on replay if ingestion regenerates it.                                                                                                                       | **FIXED** with 2 — excluded from comparison.                                                                                                                                                                                                             |
| 7   | LOW      | The design doc claimed a rejected write leaves no rows behind without noting that this depends on `batch`.                                                                                                                      | **FIXED** — the doc now states that atomicity depends on `db.batch` and that the sequential path is gone.                                                                                                                                                |
| 8   | LOW      | Table and column identifiers are interpolated into SQL templates.                                                                                                                                                               | **ACCEPTED** — they are module-internal literals from `buildTables`, never corpus data; a comment now says so. Parameterising identifiers is not possible in SQLite without quoting them as values, which would be worse.                                |

## Clean areas named by the reviewer

- insert-only: no UPDATE or DELETE on any path;
- every value bound, no value interpolation;
- column lists match the migrations for all five tables (apart from the NOT NULL
  cases above);
- insert order respects foreign keys;
- the chain test genuinely proves no hand-built rows: it ingests, writes through the
  writer, reads back through `loadStateFor`, and runs the full projection and
  verification; the merged-snapshot adapter is test-local and the header says so.

## What the review changed

Five behavioural changes, all of them refusals or corrections that make the writer
strictly safer, plus four new tests. The most important is `batch_required`: the
previous design traded atomicity for a wider adapter surface, and the reviewer was
right that the trade was invisible in the report.
