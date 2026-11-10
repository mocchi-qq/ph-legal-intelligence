# Ingestion Report

**Date:** 2026-11-10
**Implementation:** `packages/legal-ingestion` (types, extract, store, pipeline)
**Tests:** `tests/ingestion/pipeline.test.ts` (13 passing)

## 1. Scope

The pipeline ingests **one supplied artifact at a time**. It is not a crawler. It has no network access and no source connector.

## 2. Stages and evidence

| Stage                 | Implemented       | Evidence                                                                                                            |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Authorization guard   | Yes               | Non-synthetic artifact from an unauthorized source returns `FAILED / source_not_authorized`; no document is written |
| Original preservation | Yes               | Content-addressed `artifacts/<sha256>.<ext>`; key recorded on the manifestation                                     |
| SHA-256               | Yes               | Every run records `inputContentHash`                                                                                |
| Duplicate detection   | Yes               | Same bytes + same source → `DUPLICATE`; identical normalized text → `DUPLICATE`                                     |
| Identity resolution   | Yes               | Explicit `identityKey`; type conflict → `IDENTITY_AMBIGUOUS`                                                        |
| Text extraction       | Yes               | HTML script/style stripped, entities decoded; plain text normalized                                                 |
| Structure             | Yes               | Statutes split on `Section`/`Article`/`Rule`; decisions split into paragraphs                                       |
| Metadata              | Yes               | Dates, issuing body, authority level, legal status carried from explicit input only                                 |
| Passage segmentation  | Yes               | One chunk per provision, or sentence-grouped chunks under 900 chars with offsets                                    |
| Idempotency           | Yes               | Re-running the same artifact creates no new canonical document, version, provision or chunk                         |
| Failure handling      | Yes               | Empty extraction and unsupported MIME fail without mutating the corpus; a later valid ingest succeeds               |
| Indexing              | Out of scope here | Retrieval builds an in-memory index from the corpus                                                                 |

## 3. Observed results

From the Gate 1 benchmark corpus: 10 ingestion runs, 8 canonical documents, 9 versions, 31 provisions, 31 chunks, 1 duplicate run, 0 documents created by the duplicate. Recovery after an empty-extraction failure succeeded on retry.

## 4. Storage mapping (design, not deployed)

- R2 (or file store in tests): original artifacts and extracted text.
- D1: documents, versions, manifestations, provisions, chunks, relationships, ingestion runs.
- No large legal text is stored in D1; chunk text is the only text column and is bounded at ~900 characters.

## 5. Deliberately not built

No crawler, no scheduler, no connector, no OCR, no PDF parser, no queue consumer. Those require authorized sources and a later gate.

## 6. Limitations

- PDFs are not supported yet; only `text/plain`, `text/html`, `text/xhtml`.
- OCR is not implemented; scanned documents cannot be processed.
- Identity resolution depends on an explicit key; it does not infer identity from titles.
- The file store is a local stand-in for R2 and has not been tested under concurrent writers.
