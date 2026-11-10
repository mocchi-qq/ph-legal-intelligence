# Performance and Resource Report

**Date:** 2026-11-10
**Data:** `performance-results.json`
**Dataset:** four owner-authorized RA pages

## 1. Measured

| Measure            | Value                                             |
| ------------------ | ------------------------------------------------- |
| Corpus             | 4 documents, 4 versions, 54 provisions, 87 chunks |
| Source bytes       | 184,424                                           |
| Ingest 4 documents | 29.94 ms                                          |
| Index build        | 8.93 ms                                           |
| Query p50          | 0.344 ms                                          |
| Query p95          | 1.118 ms                                          |
| Query p99          | 2.724 ms                                          |
| Queries measured   | 280 (14 queries × 20 rounds)                      |
| RSS delta          | 16 MB                                             |
| Heap after         | 18.5 MB                                           |

## 2. Environment

Node v24.22.1 on ARM/PRoot, ~2.3 GB available memory, no GPU, no OCR engine, no semantic model.

## 3. Not measured

- OCR time per page (no engine).
- PDF extraction at scale (only a one-page synthetic PDF is timed elsewhere).
- Network acquisition throughput (bounded pilot; four requests, 1.5 s apart).
- Concurrent users, cold start, database I/O.
- Embedding generation or vector search.

## 4. Interpretation

The four-document pilot is fast and small. These numbers are **not** production capacity estimates. A 20–50 document authorized corpus and any semantic model would need new measurements, including memory for embeddings and index build time.

## 5. Resource risks for the next stage

| Risk         | Note                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| OCR memory   | Tesseract/PaddleOCR could exceed the available memory on scanned pages; unmeasured |
| Embeddings   | Model size and RAM unknown; no model selected                                      |
| D1/R2 limits | Not exercised; no deployed database                                                |
| Concurrency  | Untested                                                                           |
