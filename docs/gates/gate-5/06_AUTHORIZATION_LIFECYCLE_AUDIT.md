# Gate 5 — Authorization Lifecycle and Revocation Audit

**Date:** 2026-11-13
**Scope:** Gate 4 enforcement + Gate 5 determination projection

## 1. Enforcement points

| Activity                 | Current enforcement point                                  | State                         |
| ------------------------ | ---------------------------------------------------------- | ----------------------------- |
| viewing                  | No public viewer/UI exists                                 | Not implemented               |
| downloading              | `buildAcquisitionRecord` strict mode + URL guards          | Enforced for acquisition path |
| temporary_processing     | `ingestArtifact` strict mode                               | Enforced                      |
| temporary_local_storage  | PDF parser private temp file                               | **No activity gate** (gap)    |
| persistent_storage       | `ingestArtifact` strict mode before `store.preserve`       | Enforced                      |
| text_extraction          | `ingestArtifact` strict mode before `extractText`          | Enforced                      |
| OCR                      | No OCR engine; PDF input rejected                          | No path                       |
| search_indexing          | `ingestArtifact` strict mode; index builder has no recheck | Partial — no reindex gate     |
| embedding_generation     | Not implemented                                            | No path                       |
| ai_assisted_analysis     | Not implemented                                            | No path                       |
| citation_display         | No public citation UI                                      | Not implemented               |
| quotation                | Internal evidence excerpts only                            | No gate                       |
| substantial_reproduction | Not implemented                                            | No path                       |
| redistribution           | Not implemented                                            | No path                       |
| commercial_use           | Not implemented                                            | No path                       |
| retention                | Local pilot only; no policy                                | No gate                       |

## 2. Scenario results

|   # | Scenario                              | Result                                                                | Evidence                                                           |
| --: | ------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
|   1 | No determination exists               | Denied                                                                | `counsel-determinations.test.ts`, `authorization-pipeline.test.ts` |
|   2 | Counsel identity unverified           | Recording rejected; no projection                                     | `counsel-determinations.test.ts`                                   |
|   3 | Decision evidence incomplete          | Recording rejected                                                    | `counsel-determinations.test.ts`                                   |
|   4 | Source scope mismatch                 | Denied                                                                | `counsel-determinations.test.ts`                                   |
|   5 | Document scope mismatch               | Denied                                                                | `counsel-determinations.test.ts`                                   |
|   6 | Activity omitted                      | Denied                                                                | `counsel-determinations.test.ts`                                   |
|   7 | Activity prohibited                   | Denied                                                                | `authorization-activity.test.ts`, Gate 5 projection                |
|   8 | Activity restricted                   | Denied                                                                | `authorization-activity.test.ts`                                   |
|   9 | Conditions unmet                      | Denied                                                                | Gate 4 and Gate 5 tests                                            |
|  10 | Decision not yet effective            | Denied                                                                | `counsel-determinations.test.ts`                                   |
|  11 | Decision expired                      | Denied                                                                | Gate 4 expiry + Gate 5 expiry tests                                |
|  12 | Decision superseded                   | Old determination inactive                                            | `counsel-determinations.test.ts`                                   |
|  13 | Decision revoked                      | Denied; prior Gate 4 authorization overridden                         | `counsel-determinations.test.ts` sync test                         |
|  14 | Conflicting determinations            | Denied                                                                | `counsel-determinations.test.ts`                                   |
|  15 | Evidence unavailable                  | Recording requires evidence; runtime file availability is not checked | Partial — operational gap                                          |
|  16 | Registry unavailable                  | Denied                                                                | Gate 4 missing-registry test                                       |
|  17 | Retry after revocation                | Denied; corpus unchanged                                              | Gate 4 retry test + Gate 5 sync test                               |
|  18 | Background task resumes after expiry  | No background jobs exist; expiry check denies in Gate 4               | No background path                                                 |
|  19 | Old document reprocessed after change | **No reprocessing/reindex gate exists**                               | Gap                                                                |
|  20 | Legacy path attempts bypass           | Default fails closed; explicit `allowLegacySourceGate` only           | Gate 4 tests                                                       |

## 3. Findings

### L-01 — Temporary local storage has no activity gate (Medium)

The PDF adapter writes a private temp file but the document parser has no authorization context. No production PDF ingestion path is enabled, and `ALLOWED_MIME` rejects PDF input. A future PDF path must gate `temporary_local_storage` before writing the file.

### L-02 — Reindexing existing content is not rechecked (Medium)

`buildSearchIndex` indexes the in-memory corpus without consulting authorization decisions. Revocation blocks future ingestion, but an existing corpus can still be indexed if a caller builds an index directly. No production search service exists. A future index service must gate `search_indexing` and rebuild after revocation.

### L-03 — Display, quotation, reproduction, redistribution and retention have no runtime gates (Medium)

Those capabilities are not implemented. The risk is latent: adding a viewer/export/retention job without an activity check would bypass Gate 4/5. The Gate 5 packet records the required decisions; future implementations must add checks.

### L-04 — Evidence file availability is not checked at projection time (Low)

The model checks that evidence references were supplied at recording. It does not verify that the referenced file is still readable. This is an operational control for the intake review.

### L-05 — Revocation does not delete stored content (Disclosed)

Revocation blocks future operations. It does not automatically delete existing bytes or derived artifacts. Deletion requires the applicable counsel determination and an approved retention policy. No such policy exists; the four pilot files remain local and non-redistributed.

## 4. Denial audit

Denied operations return a reason (`activity_not_authorized`, `prohibited`, `expired`, `conflicts`, etc.) and do not expose passage content. Gate 4 records failed ingestion runs; Gate 5 records counsel audit events. No denial path writes document text into the audit reason.

## 5. Conclusion

The acquisition/ingestion path is fail-closed and tested. Read/display/export/retention and reindexing are not implemented; their absence is disclosed as a latent bypass risk for future work. No production service exists.
