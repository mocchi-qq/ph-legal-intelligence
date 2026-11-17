# 02 — Results

**Date:** 2026-11-17
**Baseline:** `9588432` (Gate 17) — 801 tests, 792 pass, 9 skipped.
**Final:** **826 tests — 817 pass, 0 fail, 9 skipped.**

| Check      | Baseline       | Final                                      |
| ---------- | -------------- | ------------------------------------------ |
| Tests      | 801 (792 pass) | **826 (817 pass, 9 skip)**                 |
| Test files | 74 (72 passed) | 77 (75 passed, 2 skipped)                  |
| Build      | exit 0         | exit 0                                     |
| Biome      | exit 0         | exit 0, 0 errors                           |
| New tests  | —              | 25 (10 reader, 4 lookup context, 11 chain) |

## 1. The corpus read is now a production surface

`loadCitationCorpusView(db, { documentIds })` reads `legal_documents`,
`document_versions`, `legal_provisions` and `document_chunks` into the shape the
verifier consumes. Read-only, ids bound, identifiers static, deterministic order.

Refusals:

- a requested document that is not in the database → `corpus_document_not_found:<id>`,
  because an empty view and a wrong citation produce the same verifier answer;
- `is_current` that is not `0` or `1` → `invalid_corpus_row:document_versions:<id>`,
  because a value is not coerced into a boolean it was not given;
- `documentIds: []` → an empty view and no query.

The view interfaces are declared locally so `legal-ingestion` does not depend on
`citation-engine`; the chain test assigns the result to `CitationCorpusView`, so a
field going missing fails there.

## 2. The snapshot merge is production, not test code

`D1AuthorityStore.loadStateForMany(documentIds)` loads each document through the
existing `loadStateFor` path and unions the answers by id, sorted deterministically.
A superseding assertion that comes back from two documents' answers appears once. An
empty input returns the empty snapshot without querying. An id with no rows
contributes nothing — the ledger read answers "no rows", deliberately unlike the
corpus read.

The hand-written `mergeById` that Gate 17 kept inside its test is now the production
method, and the chain test calls it instead.

## 3. A real fail-open, found and closed

Building the lookup in production form exposed something worse than a missing
convenience. `createAuthorityStatusLookup` loaded one document; the projection
resolves the document behind an evidence record by finding that record's version in
the snapshot; when the version was absent it resolved nothing and said nothing. The
review passed with **no evidence code at all**, silently skipping a Gate 13
authorization check.

Migration 0009's foreign key guarantees a non-null `document_version_id` names an
existing version, so absence from the snapshot means the caller under-loaded — never
that the document does not exist. Two changes:

1. `authority-projection.ts` now emits `EVIDENCE_DOCUMENT_NOT_LOADED:<evidenceId>`,
   discards that review's evidence base and abstains.
2. `createAuthorityStatusLookup` accepts `contextDocumentIds` so a caller can put the
   citing instrument in scope. Reading scope only: authorization is still resolved
   per (document, activity).

The Gate 16 chain was in the under-loaded position and had to be corrected: it now
names the source document and uses `loadStateForMany` where it projected directly.
That test had been passing by accident.

## 4. The chain

`tests/integration/gate18-d1-only-verification.test.ts` (11 steps):

| Step                  | Observed                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| ingest                | two synthetic documents on the non-synthetic path, so the activity checks run                         |
| write                 | `writeCorpusToD1`; counts match, conflicts empty                                                      |
| corpus read           | `loadCitationCorpusView` typed as `CitationCorpusView`; counts match; chunk content equals the D1 row |
| snapshot              | `loadStateForMany` for both documents; identical output when the ids are reversed                     |
| claim                 | `recordEffectClaim` from a real source chunk; ledger rows persisted                                   |
| lookup                | the production lookup with `contextDocumentIds`; no test-local adapter                                |
| before review         | `PARTIALLY_DETERMINED`, `NO_REVIEWED_CONCLUSION`, layer 4 false                                       |
| after review          | `DETERMINED_WITH_REVIEWED_EVIDENCE`, `AMENDED`, `VERIFIED`                                            |
| under-loaded lookup   | `INSUFFICIENT_EVIDENCE`, `EVIDENCE_DOCUMENT_NOT_LOADED`                                               |
| no `citation_display` | `NOT_CHECKED`, layer 4 false, review still on file                                                    |
| unknown document      | `corpus_document_not_found:`                                                                          |

`CorpusState` exists only inside `beforeAll`; the tests carry ids, counts, one chunk
span and the D1 reads. The one post-write use of the corpus is `recordEffectClaim`,
which validates its input against the corpus it was ingested into and returns ledger
records. It never reaches the verifier, and the evidence span is taken from the D1
chunk, not from the corpus.

## 5. What is still not proven

- **No remote D1 and no workerd.** The SQLite shim is supplementary evidence for SQL,
  constraints and shape; it is not D1 runtime validation.
- **No read-time authorization (B-3).** The reader returns whatever the database
  holds. A corpus written without a decision record would be readable. This gate does
  not change that and does not pretend to.
- **The whole-corpus read is unbounded.** Omitting `documentIds` loads every row of
  four tables. It is documented as bounded-corpus use and the chain always names its
  documents, but nothing enforces a cap.
- **The `synthetic` ingestion exemption (B-2) is still open**; both chain artifacts
  are ingested with the flag false.
- Nothing legal: every id is `SYNTH-*`, every URL `.invalid`, 0 counsel
  determinations, 350 `UNKNOWN` authorization cells.
