# 01 — Design

**Date:** 2026-11-15
**Module:** `packages/legal-search/src/retrieve.ts` (`buildSearchIndex`)

## 1. Before and after

|                         | Before                                                      | After                                                                                    |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Option                  | `authorize: ({documentId, sourceId}) => {allowed, reason?}` | `authorization: DocumentActivityAuthorization`                                           |
| Activity                | not represented                                             | fixed to `search_indexing`                                                               |
| Role                    | not represented                                             | `TARGET` — the document the activity operates on                                         |
| Answer                  | boolean                                                     | `AUTHORIZED` / `UNAUTHORIZED` / `NOT_CHECKED`, with source, status, reason, decision ref |
| Call frequency          | once per chunk                                              | once per document                                                                        |
| Denials                 | silently skipped                                            | reported in `excludedDocuments`                                                          |
| Wrong-activity decision | possible (no activity named)                                | impossible — the library asks for `search_indexing` and only that                        |

## 2. Why the activity is fixed by the library, not by the caller

A caller that could name the activity could index under `viewing`. The activity an
index build performs is a property of the operation, not of the request, so
`buildSearchIndex` supplies it and the caller supplies only the decision source.
This mirrors Gate 13's lookup, which fixes the activity at construction.

## 3. Why the answer is a full decision, not a boolean

A boolean cannot distinguish "a decision says no" from "nobody has decided", it
cannot name the activity it was made for, and it carries no reference to the
record behind it. Both exclusions must be visible and attributable:

```ts
excludedDocuments: DocumentActivityDecision[] // sorted by documentId
```

`excludedDocuments` is non-optional on the returned index: a caller that ignores
it still receives it, and a reader of a serialised index can see what was left out.
It holds one entry per document that **had chunks and was not `AUTHORIZED`**; a
document with no chunks is not evaluated, because there is nothing to index and
therefore nothing to refuse.

## 4. Per-document, not per-chunk

The old code consulted the callback inside the chunk loop, so a document with five
chunks produced five calls. That is wasteful and, with a non-deterministic
callback, could index part of a document — an incoherent index. The build now
resolves each document once and either indexes all of its chunks or none.

## 4a. `total` is unchanged

`total` was `entries.length` before this gate and still is. It counts indexed
chunks, not corpus chunks; `docFreq` likewise counts only indexed documents, which
is what IDF needs. Nothing about those two numbers changed meaning — a point worth
stating because a reader could assume the new exclusions altered them.

## 5. Composition with the registry

`legal-search` already depends on `legal-ingestion`, so no dependency changes:

```ts
const authorization = createRegistryAuthorization({
  registry,
  sourceOfDocument: (id) =>
    corpus.documents.find((d) => d.id === id)?.sourceId ?? null,
  asOf: "2026-11-15",
});
const index = buildSearchIndex(corpus, { authorization });
```

The `asOf` matters: expiry is judged at that instant, so the same build replays to
the same index. Tests use a fixed date for that reason.

## 6. Failure modes

| Situation                                     | Behaviour                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| no `authorization` supplied                   | throws `index_authorization_required` before any work                       |
| the removed `authorize` option supplied       | throws the same — it is not an alias                                        |
| no registry decision for a document           | document excluded, `excludedDocuments` carries `no_decision_recorded`       |
| document authorized only for another activity | excluded, `no_decision_recorded` for `search_indexing`                      |
| prohibited / restricted / expired             | excluded, with the registry's reason                                        |
| resolver throws                               | propagates: an index build that cannot get an answer is not a partial index |

## 7. What this does not fix

`retrieve` performs no authorization at read time. A caller that holds an index can
read every entry in it, whatever its own entitlement. Adding a read-time gate needs
an answer to "who is asking", and this library has no user, tenant or
authentication surface — so it is recorded as a limitation rather than half-built.
