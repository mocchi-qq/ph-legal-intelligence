# 02 — Activity Taxonomy Reconciliation

**Date:** 2026-11-15
**Question:** which activities exist, which are enforced at runtime, and where does
the vocabulary differ?

## 1. Three vocabularies, deliberately not merged

| Vocabulary                  | Definition                                                  | Size         | Purpose                                         |
| --------------------------- | ----------------------------------------------------------- | ------------ | ----------------------------------------------- |
| Gate 4 `ACTIVITIES`         | `packages/legal-ingestion/src/authorization.ts:13`          | **14**       | enforceable activity cells, keyed by `sourceId` |
| Gate 5 `COUNSEL_ACTIVITIES` | `packages/legal-ingestion/src/counsel-determinations.ts:23` | **16**       | what a counsel determination may address        |
| Counsel → Gate 4 mapping    | `GATE4_ACTIVITY` in the same file                           | **14 of 16** | only where a real enforcement path exists       |

The two extra counsel activities are **not** enforcement gaps hidden behind an
alias; they are activities for which the repository has no enforceable path, and
the mapping deliberately omits them rather than inventing one.

- `temporary_local_storage` — no runtime storage path implements it separately from
  `temporary_processing`.
- `substantial_reproduction` — a copyright concept with no code path that
  reproduces text.

Neither is renamed, merged or aliased. A counsel determination that turns on them
validates as a determination but cannot gate an operation here, which is recorded
in §4.

## 2. Reconciliation table

`Runtime implementation` = does code perform the operation. `Enforcement point` =
does code consult the registry for that activity before doing it. These are
different columns on purpose: an activity can be implemented without being gated.

| #   | Activity (Gate 4)          | In counsel vocabulary | Runtime implementation                               | Enforcement point                                                                 | Tests                           |
| --- | -------------------------- | --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| 1   | `viewing`                  | yes                   | no dedicated path                                    | none                                                                              | taxonomy only                   |
| 2   | `downloading`              | yes                   | `acquisition.ts`                                     | `registry.check(sourceId, "downloading")`                                         | `tests/legal-data/acquisition*` |
| 3   | `temporary_processing`     | yes                   | `pipeline.ts`                                        | `REQUIRED_INGEST_ACTIVITIES`                                                      | `tests/integration/pipeline*`   |
| 4   | `persistent_storage`       | yes                   | `pipeline.ts`                                        | `REQUIRED_INGEST_ACTIVITIES`                                                      | idem                            |
| 5   | `text_extraction`          | yes                   | `pipeline.ts` / `extract.ts`                         | `REQUIRED_INGEST_ACTIVITIES`                                                      | idem                            |
| 6   | `ocr`                      | yes                   | none (PDF/images refused)                            | none — comment in `pipeline.ts` requires adding it before widening `ALLOWED_MIME` | taxonomy only                   |
| 7   | `search_indexing`          | yes                   | `legal-search` index build                           | `REQUIRED_INGEST_ACTIVITIES`; index itself takes a caller `authorize` callback    | `tests/retrieval/*`             |
| 8   | `embedding_generation`     | yes                   | none                                                 | none                                                                              | taxonomy only                   |
| 9   | `ai_assisted_analysis`     | yes                   | `ai-orchestrator` grounding composer (no model call) | none                                                                              | taxonomy only                   |
| 10  | `citation_display`         | yes                   | citation engine returns passages to callers          | **none before Gate 13**                                                           | Gate 13                         |
| 11  | `quotation`                | yes                   | none beyond passage return                           | none                                                                              | taxonomy only                   |
| 12  | `redistribution`           | yes                   | none                                                 | none                                                                              | taxonomy only                   |
| 13  | `commercial_use`           | yes                   | none                                                 | none                                                                              | taxonomy only                   |
| 14  | `retention`                | yes                   | none (no retention job)                              | none                                                                              | taxonomy only                   |
| —   | `temporary_local_storage`  | counsel only          | none                                                 | none                                                                              | taxonomy only                   |
| —   | `substantial_reproduction` | counsel only          | none                                                 | none                                                                              | taxonomy only                   |

**Five of fourteen** activities have a runtime enforcement point at `e834045`:
`downloading`, `temporary_processing`, `persistent_storage`, `text_extraction`,
`search_indexing`. Gate 13 adds a sixth, `citation_display`, at the authority
projection, because that is the activity a verification decision actually is.

## 3. Terminology inconsistencies found

1. **Registry key is `sourceId`, projection key is `documentId`.** The registry
   answers "may this _source_ be used for this activity"; the projection asks
   about a _document_. `legal_documents.source_id` exists (`0001`, nullable) but
   is not carried in `AuthorityDocumentView`, so the projection cannot reach the
   registry without an explicit document → source mapping. Gate 13 makes that
   mapping an explicit, injected function and fails closed when it returns nothing.
2. **`search_indexing` is enforced twice by different mechanisms.** The pipeline
   consults the registry; `buildSearchIndex` instead takes an arbitrary
   `authorize` callback that returns `{ allowed }`. The callback is not required to
   consult the registry, so an index can be built on a caller assertion. Recorded
   as a limitation; changing it is out of scope for this gate.
3. **No `reindexing` activity exists.** Reindexing reuses `search_indexing`. No
   alias is added; the caller inventory records it as such.
4. **`citation_display` had no enforcement point** despite being the activity a
   citation answer performs. This is the gap Gate 13 closes.

## 4. Consequence for this gate

Authority projection will enforce exactly one activity per projection —
`citation_display` in every verification path, and whatever the caller names in a
direct projection call — resolved through the existing registry. Activities with no
runtime path remain unimplemented and are reported as such rather than silently
treated as allowed or denied.

The 16-vs-14 distinction is preserved: a counsel determination covering
`substantial_reproduction` cannot be turned into a `citation_display` decision,
because the mapping table has no entry for it and the adapter refuses to invent
one.
