# 00 — Gate 18 Plan: Production D1 Reader

**Date:** 2026-11-17
**Baseline:** `ab776d7` (board corrected after Gate 17).
**Scope:** synthetic only. No migration, no real document, no counsel record, no
authorization decision.

## 1. The gap (backlog B-5)

Gate 17 made a real ingest land in the canonical D1 tables. But the verifier is still
fed from two places:

- **layers 1–3** (identity, location, support) read a `CitationCorpusView` built in
  memory from the ingested `CorpusState`;
- **layer 4** (authority) reads D1 through `D1AuthorityStore`;
- a caller that has a source and a target **merges two snapshots by hand**, because
  `loadStateFor` answers for one document.

So the database is authoritative for the ledger but not for the corpus. A verifier
run that is meant to be "from the database" is only half from the database, and the
merge that makes it work exists only inside tests.

## 2. Deliverables

### 2.1 `loadCitationCorpusView`

`packages/legal-ingestion/src/corpus-d1-reader.ts`

```ts
export interface CitationCorpusSnapshot { documents; versions; provisions; chunks }
export interface LoadCitationCorpusOptions { documentIds?: string[] }

loadCitationCorpusView(db: D1DatabaseLike, options?): Promise<CitationCorpusSnapshot>
```

Four SELECTs, one per table, ids chunked at 90 placeholders. Documents come from
`legal_documents` (citation text, docket, identity key, legal status, effectivity,
repeal, promulgation), versions from `document_versions` (`is_current` as a boolean),
provisions from `legal_provisions`, chunks from `document_chunks`. Deterministic
ordering. Read-only: the module contains no INSERT, UPDATE or DELETE.

The returned shape is **structurally identical** to `CitationCorpusView` in
`@phli/citation-engine`. It is declared locally so that `legal-ingestion` does not
gain a dependency on the engine — the engine deliberately knows nothing about
storage — and a test assigns the result to `CitationCorpusView` so any drift fails
the build rather than silently.

### 2.2 `loadStateForMany`

`D1AuthorityStore.loadStateForMany(documentIds: string[]): Promise<AuthoritySnapshot>`

The merge a caller does by hand today, in production: per-document loads, union by
id, deterministic order. A superseding assertion can be loaded from two documents'
answers; it appears once.

### 2.3 Fail-closed rules

- **A requested document that is not in the database is an error**, not an empty
  answer: `corpus_document_not_found:<id>`. An empty view is indistinguishable from
  "the citation is wrong", and that confusion is exactly what this gate removes.
  (Omitting `documentIds` loads everything and is documented as bounded-corpus use.)
- An empty id list returns an empty view without issuing a query.
- No value is interpolated; identifiers are module literals; ids are bound.
- A row whose `is_current` is neither `0` nor `1` is refused rather than coerced.
- The reader makes **no authorization decision**. Read-time authorization is B-3 and
  is explicitly out of scope; the module header says so.

## 3. Acceptance

- A corpus written by `writeCorpusToD1` reads back through `loadCitationCorpusView`
  with every field the verifier consumes intact (citation text, identity key,
  statuses, dates, `isCurrent`, provision label/text/version, chunk spans).
- Filtering by document id returns exactly that document's rows; an unknown id
  throws; an empty list issues no query.
- The same view drives layers 1–4 with **no in-memory corpus anywhere**: verify a
  citation against D1 only, before review (`PARTIALLY_DETERMINED`,
  `NO_REVIEWED_CONCLUSION`) and after (`DETERMINED`, `AMENDED`, `VERIFIED`).
- `loadStateForMany` returns both documents, deduplicates a superseding assertion,
  and is deterministic regardless of input order.
- Full suite green; build exit 0; Biome 0 errors; migrations untouched; 350 cells
  `UNKNOWN`; 0 counsel determinations.

## 4. Non-goals

Read-time authorization (B-3), the `synthetic` ingestion exemption (B-2), extraction
jobs, verification records, remote D1 or workerd, and any change to the verifier's
four-condition predicate. The reader reads; it does not judge.
