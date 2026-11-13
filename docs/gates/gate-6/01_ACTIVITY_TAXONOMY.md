# Gate 6 — Canonical Activity Taxonomy

**Date:** 2026-11-13  
**Canonical activities:** 16  
**Gate 4 enforced matrix:** 14  
**Machine-readable:** `activity-taxonomy.json`

## 1. Resolution of 16 versus 14

The canonical taxonomy is the 16-activity Gate 5 counsel model. The Gate 4 14-cell matrix remains the enforcement registry for acquisition and ingestion. No activity was merged, renamed or redefined.

| Extended activity          | Status                                  | Runtime enforcement                                                                                                               |
| -------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `temporary_local_storage`  | Canonical; not in Gate 4 14-cell matrix | Added in Gate 6 via the PDF parser's `authorizeTemporaryStorage` callback and the Gate 5 projection for `temporary_local_storage` |
| `substantial_reproduction` | Canonical; not in Gate 4 14-cell matrix | No runtime feature; future boundary                                                                                               |

Migration 0005 already enumerates all 16. No taxonomy correction migration is required.

## 2. Taxonomy

| Activity                   | Definition                                                       | Implemented     | Runtime gate | Counsel form | Migration 0005 | Gate 4 matrix | Code path                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------- | --------------- | ------------ | ------------ | -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `viewing`                  | Accessing a source through its public interface.                 | partial         | no           | yes          | yes            | yes           | No public viewer/UI exists; no runtime enforcement point.                                                                   |
| `downloading`              | Acquiring the original document from a source.                   | implemented     | yes          | yes          | yes            | yes           | buildAcquisitionRecord strict mode; transport is a primitive, not an ingestion path.                                        |
| `temporary_processing`     | Processing content in process memory without persistent storage. | implemented     | yes          | yes          | yes            | yes           | ingestArtifact strict mode.                                                                                                 |
| `temporary_local_storage`  | Writing a temporary local file before parsing or extraction.     | partial         | yes          | yes          | yes            | no            | PDF parser authorizeTemporaryStorage callback; no ingestion PDF path (ALLOWED_MIME rejects PDF).                            |
| `persistent_storage`       | Retaining original bytes beyond temporary processing.            | implemented     | yes          | yes          | yes            | yes           | ingestArtifact strict mode before store.preserve.                                                                           |
| `text_extraction`          | Extracting native text from a document.                          | implemented     | yes          | yes          | yes            | yes           | ingestArtifact strict mode; PDF parser only after temp-storage authorization.                                               |
| `ocr`                      | Recognising text in scanned images.                              | not_implemented | no           | yes          | yes            | yes           | No OCR engine; PDF input rejected by ALLOWED_MIME.                                                                          |
| `search_indexing`          | Building lexical or vector search records.                       | implemented     | yes          | yes          | yes            | yes           | buildSearchIndex requires an authorizer; authorizeIndexing checks temporary_processing + text_extraction + search_indexing. |
| `embedding_generation`     | Creating vector embeddings from extracted text.                  | not_implemented | no           | yes          | yes            | yes           | No model/index exists.                                                                                                      |
| `ai_assisted_analysis`     | Sending content to an AI model for analysis or answering.        | not_implemented | no           | yes          | yes            | yes           | No model call exists.                                                                                                       |
| `citation_display`         | Displaying passages and references to users.                     | partial         | no           | yes          | yes            | yes           | Evidence excerpts exist internally; no public display UI.                                                                   |
| `quotation`                | Quoting or excerpting protected text.                            | partial         | no           | yes          | yes            | yes           | Internal provenance excerpts only; no public quotation feature.                                                             |
| `substantial_reproduction` | Reproducing a substantial portion of a document.                 | not_implemented | no           | yes          | yes            | no            | No feature; future implementation must add a gate.                                                                          |
| `redistribution`           | Distributing or exporting originals or derived content.          | not_implemented | no           | yes          | yes            | yes           | No export/redistribution feature; pilot prohibits redistribution.                                                           |
| `commercial_use`           | Using content in a commercial product or service.                | not_implemented | no           | yes          | yes            | yes           | No commercial use is made or authorized.                                                                                    |
| `retention`                | Retaining content beyond the immediate operation.                | partial         | no           | yes          | yes            | yes           | Local pilot files exist; no retention policy or runtime gate.                                                               |

## 3. Discrepancy classification

- `temporary_local_storage`: was missing from runtime; **closed in Gate 6** with a pre-write gate. It remains outside the 14-cell Gate 4 matrix by design.
- `substantial_reproduction`: intentionally separate, **missing from runtime**; no feature exists. A future implementation must add a gate.
- `viewing`, `citation_display`, `quotation`, `retention`: represented in the matrix but have no runtime enforcement because the corresponding features are not implemented.
- `ocr`, `embedding_generation`, `ai_assisted_analysis`, `redistribution`, `commercial_use`: represented in the matrix; no runtime path exists.

## 4. Rule

An unknown activity ID is invalid. Runtime, counsel form, migration and matrix mappings are checked by tests. No activity may be authorized through an identifier absent from the canonical list.
