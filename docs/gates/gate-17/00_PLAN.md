# 00 — Gate 17 Plan: Corpus → D1 Writer

**Date:** 2026-11-17
**Baseline:** `95c4709` (Gate 16), clean, 777 tests.
**Scope:** synthetic only. No migration, no real document, no counsel record.

## 1. The gap (backlog B-4)

Ingestion writes documents, versions, provisions, chunks and manifestations into the
in-memory `CorpusStore`. The canonical D1 tables exist and are validated
(`0001`, `0002`), but nothing production-side writes them: every end-to-end test
copies rows by hand in a test helper.

Consequence: after a real ingest, the database that the authority projection reads
from would not contain the document at all. Corpus readiness cannot be claimed until
that edge exists.

## 2. Deliverable

`packages/legal-ingestion/src/corpus-d1-writer.ts`

```ts
writeCorpusToD1(db: D1DatabaseLike, corpus: CorpusState, options?: { now?: string }):
  Promise<CorpusWriteReport>

interface CorpusWriteReport {
  inserted: { documents; versions; provisions; chunks; manifestations };
  unchanged: string[];                    // ids already present and identical
  conflicts: Array<{ table; id; reason }>; // present and different
}
```

Tables, in insert order (foreign keys first): `legal_documents`,
`document_versions`, `legal_provisions`, `document_chunks`, `source_manifestations`.

## 3. Fail-closed rules

- **No updates, ever.** The writer inserts; it never overwrites. A row that exists
  with different content is a conflict, not something to reconcile — the canonical
  tables are meant to be immutable and this writer has no mandate to rewrite history.
- **Verify before writing.** All existing ids are read first; if any conflict is
  found, the report is returned and **nothing is inserted**. D1 has no transaction
  primitive on the verified path (Gate 7 limitation), so a pre-check is the only
  honest way to avoid a half-written corpus.
- **Idempotent replay.** Re-running on the same corpus inserts nothing and reports
  every id as unchanged.
- **Parameterised only.** No value is interpolated into SQL; every column is a bound
  parameter.
- **No invented values.** Fields absent from the corpus are written as null or the
  schema default, never guessed. `created_at` comes from the row or the supplied
  clock.

## 4. Acceptance

- All five tables are populated from an ingested corpus, with counts matching the
  corpus state.
- A second run inserts nothing and reports the same ids as unchanged.
- A conflicting row (same id, different title / hash / text) reports a conflict and
  leaves the database exactly as it was.
- A row whose text contains SQL metacharacters is stored verbatim (injection test).
- After writing, `D1AuthorityStore.loadStateFor(documentId)` returns the document,
  version and provisions, so a projection snapshot can be built from D1 alone.
- The full chain then runs without any hand-built row: ingest → write → load from D1
  → record claim (Gate 16) → review → project → verify.
- Full suite green; build exit 0; Biome 0 errors; no migration changed; 350 cells
  unchanged.

## 5. Non-goals

Read-time authorization, the `synthetic` ingestion exemption, extraction jobs,
verification records, relationships and citation aliases — those tables are out of
scope for this gate, and the writer says so rather than silently ignoring them.
