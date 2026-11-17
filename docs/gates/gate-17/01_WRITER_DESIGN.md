# 01 — Writer Design

**Module:** `packages/legal-ingestion/src/corpus-d1-writer.ts`
**Entry point:** `writeCorpusToD1(db, corpus, options?)`

## 1. Why the writer is insert-only

The canonical tables are meant to be immutable in this system: a version is "one
authoritative text", and the authority ledger treats corrections as new rows that
supersede old ones. A writer that could UPDATE would quietly rewrite history and
invalidate every assertion and review that referred to the old text.

So the writer inserts or refuses. It never updates, never deletes, and never
"reconciles" a difference.

## 2. Verify, then write

D1 has no explicit `BEGIN`/`COMMIT` on this path — Gate 7 recorded the binding
limitation and it stands — so the writer relies on `db.batch()` for atomicity and
**requires** it: a handle without `batch` throws `batch_required` before any read or
write. The earlier sequential fallback was removed after review, because a failure on
the third table would have left the first two written while the report claimed
success.

With that in place the writer verifies first:

1. build every pending row from the corpus;
2. read the existing rows for those ids, one `SELECT ... WHERE id IN (...)` per
   table, ids chunked at 90 placeholders;
3. compare the columns that would be written, normalising nulls and `0|1`;
4. duplicate ids _within_ the corpus are reported as
   `<table>:duplicate_id_in_corpus` — one would otherwise slip past the comparison
   and hit a UNIQUE violation mid-write;
5. every CHECK-constrained value is validated against the vocabulary in the
   migrations, and every foreign key against an existing row or a pending row in an
   earlier table, reported as `<table>:invalid_value:<column>` and
   `<table>:unresolved_reference:<column>`;
6. if anything differs or fails validation, write nothing;
7. otherwise insert in foreign-key order.

Conflicts abort the whole write, and the report's counts are taken only after the
batch resolves — a report never claims a row that is not durable. A concurrent
writer could still interleave between the read and the batch; that is a best-effort
guarantee, stated rather than hidden.

The comparison covers **business columns only**. `created_at` and `updated_at` are
write-time provenance: they are written on insert, but a replay with a different
clock must not turn every row into a conflict, so they are excluded from equality.

## 3. Column mapping

| Corpus object         | Table                   | Notes                                                                               |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `LegalDocument`       | `legal_documents`       | statuses and levels written verbatim; the schema's `CHECK` constraints are the gate |
| `DocumentVersion`     | `document_versions`     | `is_current` as `1`/`0`; `content_hash` required                                    |
| `LegalProvision`      | `legal_provisions`      | `ordinal` preserved; `parent_provision_id` as null when absent                      |
| `DocumentChunk`       | `document_chunks`       | span columns preserved exactly as ingested                                          |
| `SourceManifestation` | `source_manifestations` | `is_primary` as `1`/`0`                                                             |

Per-column null handling follows the schema rather than one rule: a column that is
NOT NULL **with** a default (`created_at`, `updated_at`,
`source_manifestations.acquisition_status`, the legal-status and authority-level
columns) is omitted when the corpus has no value, so the default applies; a column
that is NOT NULL **without** a default (a title, a hash, a chunk's content, a
manifestation's `retrieved_at`) produces `<table>:missing_required:<column>` and
aborts. Nothing is invented.

## 4. Deliberately not written

`extraction_jobs`, `verification_records`, `document_relationships` and
`citation_aliases` are outside this gate. They are not read, not written, and not
silently emptied — the module header names them so a reader does not assume a corpus
write produced a complete database.

## 5. Tests

`tests/authority/gate17-corpus-writer.test.ts` (8):

- every column round-trips for all five tables;
- a second write inserts nothing and reports the same ids as unchanged;
- a changed document title, and separately a changed version hash, produce a conflict
  naming that column, with zero inserted and the stored values untouched;
- a title and a chunk containing `'); DROP TABLE legal_documents; --` are stored
  verbatim and the table survives;
- provisions and chunks referencing their version insert without an FK error, and a
  dangling reference is reported as an unresolved reference before any write;
- a handle without `batch` throws `batch_required` before reading anything, and a
  failing batch reports zero rows inserted;
- a replay with a different clock is reported as unchanged, not conflicting;
- a duplicate id inside one corpus, a missing `retrieved_at`, an out-of-vocabulary
  `legal_status` and a null defaulted column each behave as described above;
- an empty corpus reports zeros and issues no statements.
