# Gate 6 — Authorization Enforcement Coverage

**Date:** 2026-11-13  
**Machine-readable:** `enforcement-coverage.json`

## 1. Call-path inventory

| ID  | Path                           | Required activity                                                          | Enforcement                                         | Before access?            | Failure                                                                              | Status                |
| --- | ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| ACQ | Acquisition                    | downloading                                                                | ActivityAuthorizationRegistry.check via strict mode | yes                       | REJECTED/ok:false with activity_not_authorized                                       | IMPLEMENTED           |
| ING | Initial ingestion              | temporary_processing, persistent_storage, text_extraction, search_indexing | ingestArtifact strict mode                          | yes                       | FAILED before derived writes                                                         | IMPLEMENTED           |
| MEM | Temporary in-memory processing | temporary_processing                                                       | ingestArtifact strict mode                          | yes                       | FAILED before extraction                                                             | IMPLEMENTED           |
| TMP | Temporary local storage        | temporary_local_storage                                                    | PdfOptions.authorizeTemporaryStorage callback       | yes, before mkdtemp/write | REJECTED with temporary_storage_not_authorized                                       | PARTIALLY_IMPLEMENTED |
| STO | Persistent storage             | persistent_storage                                                         | ingestArtifact strict mode                          | yes, before preserve      | FAILED                                                                               | IMPLEMENTED           |
| MOV | File movement/copy             | persistent_storage                                                         | ingestArtifact strict mode                          | yes                       | FAILED                                                                               | PARTIALLY_IMPLEMENTED |
| EXT | Text extraction                | text_extraction                                                            | ingestArtifact strict mode                          | yes                       | FAILED                                                                               | IMPLEMENTED           |
| OCR | OCR                            | ocr                                                                        | none                                                | n/a                       | No path; PDF rejected                                                                | NOT_IMPLEMENTED       |
| IDX | Search indexing                | temporary_processing, text_extraction, search_indexing                     | IndexBuildOptions.authorize + authorizeIndexing     | yes, per document         | throws without authorizer; denied documents are excluded (empty index if all denied) | IMPLEMENTED           |
| REI | Reindexing                     | temporary_processing, text_extraction, search_indexing                     | same authorizer; no reindex service exists          | yes for the function      | throws/empty                                                                         | PARTIALLY_IMPLEMENTED |
| EMB | Embedding generation           | embedding_generation                                                       | none                                                | n/a                       | No path                                                                              | NOT_IMPLEMENTED       |
| AI  | AI-assisted processing         | ai_assisted_analysis                                                       | none                                                | n/a                       | No path                                                                              | NOT_IMPLEMENTED       |
| ANS | Answer generation              | ai_assisted_analysis, citation_display                                     | none                                                | n/a                       | No path                                                                              | NOT_IMPLEMENTED       |
| CIT | Citation rendering             | citation_display, quotation                                                | none                                                | n/a                       | No UI                                                                                | NOT_IMPLEMENTED       |
| DIS | Document display               | viewing, citation_display                                                  | none                                                | n/a                       | No UI                                                                                | NOT_IMPLEMENTED       |
| QUO | Quotation/excerpt display      | quotation                                                                  | none                                                | n/a                       | No feature                                                                           | NOT_IMPLEMENTED       |
| REP | Substantial reproduction       | substantial_reproduction                                                   | none                                                | n/a                       | No feature                                                                           | NOT_IMPLEMENTED       |
| EXP | Export/redistribution          | redistribution                                                             | none                                                | n/a                       | No feature                                                                           | NOT_IMPLEMENTED       |
| RET | Retention/archival             | retention                                                                  | none                                                | n/a                       | No retention policy or gate                                                          | PARTIALLY_IMPLEMENTED |
| DEL | Deletion/purge                 | retention                                                                  | none                                                | n/a                       | No automatic deletion                                                                | NOT_IMPLEMENTED       |
| RTY | Retry/recovery                 | same as operation                                                          | same strict checks re-run                           | yes                       | FAILED on revocation/expiry                                                          | IMPLEMENTED           |
| ADM | Administrative/maintenance     | all                                                                        | none                                                | n/a                       | No service                                                                           | NOT_IMPLEMENTED       |
| BG  | Background jobs                | all                                                                        | none                                                | n/a                       | No service                                                                           | NOT_IMPLEMENTED       |
| MIG | Migration/backfill             | none (no content)                                                          | n/a                                                 | n/a                       | n/a                                                                                  | IMPLEMENTED           |

## 2. Closed gaps

### Temporary local storage

`PdfOptions.authorizeTemporaryStorage` is required before `mkdtemp`/`writeFileSync`. Missing or denied authorization returns `REJECTED` with `temporary_storage_authorization_missing` or `temporary_storage_not_authorized:<reason>`. It checks only `temporary_local_storage`; permission for in-memory processing does not imply permission to write a temp file. Tests cover missing, denied, wrong document, expiry and revocation.

### Reindexing

`buildSearchIndex` now requires an `authorize` callback and calls it per document before indexing. `authorizeIndexing` checks `temporary_processing`, `text_extraction` and `search_indexing` through the Gate 5 projection. Missing/expired/revoked/omitted decisions return an empty index or an explicit authorization error. Tests cover allow, deny, omission and revocation. There is still no production reindex service; the function boundary is the enforcement point.

## 3. Future boundaries

Display, quotation, substantial reproduction, export/redistribution, commercial use, retention, deletion, admin and background jobs are not implemented. No runtime enforcement is claimed. Each future service must call the canonical activity projection before access or mutation and fail closed. `substantial_reproduction` has no Gate 4 matrix cell; it remains a counsel-only activity until a feature exists.

## 4. Residual gaps

- Temporary-storage denial is not centrally audited; the parser returns a reason.
- Reindex denial is not centrally audited; the callback result is not persisted.
- Retention has no policy or gate; the four pilot files remain local.
- No background/admin/reindex service exists to test end-to-end.
