# 01 — Reader Design

**Modules:** `corpus-d1-reader.ts`, `D1AuthorityStore.loadStateForMany`,
`createAuthorityStatusLookup({ contextDocumentIds })`, and one fail-closed line in
`authority-projection.ts`.

## 1. What "from the database" has to mean

Before this gate the verifier was fed from two sources: an in-memory
`CitationCorpusView` built from the ingested corpus (layers 1–3), and D1 (layer 4).
A test could merge two documents' snapshots and call that "from the database", but
nothing production-side did the merge, so the claim held only inside the test that
made it.

After this gate the corpus view, the ledger snapshot and the authority lookup all
read D1. The chain test constructs no view by hand.

## 2. `loadCitationCorpusView`

Four SELECTs — `legal_documents`, `document_versions`, `legal_provisions`,
`document_chunks` — mapped to the shape the verifier consumes. Read-only, no
authorization decision (read-time authorization is backlog B-3), every id bound,
identifiers static.

The view interfaces are declared locally rather than imported. `legal-ingestion`
keeps no dependency on `citation-engine`, and the engine keeps knowing nothing about
storage; a test assigns the result to `CitationCorpusView`, so drift fails there
instead of silently.

**Refusals:**

| Situation                                           | Result                                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| a requested document id is not in `legal_documents` | `corpus_document_not_found:<id>`                       |
| `documentIds: []`                                   | empty view, no query issued                            |
| `documentIds` omitted                               | the whole corpus (documented bounded-corpus use)       |
| `is_current` is neither `0` nor `1`                 | `invalid_corpus_row:document_versions:<id>:is_current` |

The first is the important one. An empty view and a wrong citation produce the same
verifier answer, so a missing document must not be expressible as "no rows". The
`is_current` rule is the same instinct at column scale: the reader does not coerce a
value into a boolean it was not given.

## 3. `loadStateForMany`

The merge callers did by hand, in production: load each document through the
existing `loadStateFor` path, union by id, sort deterministically. A superseding
assertion can come back from two documents' answers and appears once.

It deliberately does **not** refuse an unknown document. `loadStateFor` already
answers "no rows" for one, and the ledger read is used to ask whether records exist;
the corpus read is used to verify a named citation, where silence is unsafe. The
contrast is documented in both places so a reader does not read one as an oversight.

`projectAuthorityState` filters assertions by target document, so carrying the union
cannot change a projection.

## 4. The gap the reader exposed

Building the lookup in production form showed that `createAuthorityStatusLookup`
loaded one document. The projection resolves the document behind an evidence record
as a third party by finding that evidence's version in the snapshot. Migration
0009's foreign key guarantees a non-null `document_version_id` names an existing
version, so "version not found" means **the caller under-loaded**, not that there is
no such document.

Before this gate that case resolved nothing and recorded nothing: the review passed
with no evidence code at all. That is a silent skip of a Gate 13 authorization check
— the failure mode this project keeps finding in its own adapters.

Two changes, both fail-closed:

1. `authority-projection.ts` now emits `EVIDENCE_DOCUMENT_NOT_LOADED:<evidenceId>`
   and discards the review's evidence base when the named version is absent. An
   absent row can no longer buy silence.
2. `createAuthorityStatusLookup` accepts `contextDocumentIds`, so the caller can name
   the documents whose rows must be in scope — typically the citing instrument. This
   widens **reading** scope only: authorization is still resolved per
   (document, activity), and nothing is inherited from the context.

The Gate 16 chain used the under-loaded lookup and had to be corrected: it now names
the source document and reads `loadStateForMany` where it projected directly. That
is not a test being adjusted to pass; it is the caller doing what the new refusal
requires, and it is exactly the change a real caller would make.

## 5. Tests

`tests/authority/gate18-corpus-reader.test.ts` (10): field round-trip typed as
`CitationCorpusView`; filtering by one and two documents; the empty list issuing no
query; an unknown id refused; `is_current = 2` refused; deterministic order
regardless of request order; `loadStateForMany` merging both documents, deduplicating
a superseding assertion, ignoring an unknown id and returning the empty snapshot for
an empty input.

`tests/authority/gate18-lookup-context.test.ts` (4): the same fixture projected four
ways — under-loaded (`EVIDENCE_DOCUMENT_NOT_LOADED`, abstained), evidence document
loaded but unauthorized (`EVIDENCE_AUTHORIZATION_NOT_CHECKED`), loaded and
authorized (determined), and no authorization input (refused at construction).

`tests/integration/gate18-d1-only-verification.test.ts` (11): the full chain, with
the verifier's corpus read from D1 and no in-memory `CorpusState` in scope at the
verification steps.
