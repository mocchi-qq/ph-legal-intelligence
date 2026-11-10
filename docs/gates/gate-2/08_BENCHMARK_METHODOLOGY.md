# Benchmark Methodology

**Date:** 2026-11-10
**Executable:** `tests/benchmark/gate2-benchmark.test.ts`
**Results:** `docs/gates/gate-2/benchmark-results.json`
**Real corpus manifest:** `docs/gates/gate-2/REAL_CORPUS_MANIFEST.json`

## 1. Two separate datasets

| Dataset              | Status      | Contents                      |
| -------------------- | ----------- | ----------------------------- |
| Synthetic regression | Executed    | Gate 1 fixtures, unchanged    |
| Real-source pilot    | **BLOCKED** | 0 documents; no authorization |

Results are never merged. The Gate 1 JSON is hash-pinned and the Gate 2 test fails if it changes.

## 2. What was executed

- Gate 1 result integrity: SHA-256 equal to `7fca3b67…b0a5`, 8 documents, 9 versions, `synthetic: true`.
- Exact-identifier safety: `G.R. No. 000000` → 0 results; `G.R. No. 999001` → correct document.
- PDF inspection/extraction on a generated synthetic PDF: page count, characters, status, flags.
- Real-corpus record written as `BLOCKED` with `documents: 0`, `metrics: null`.

## 3. What was not executed

- Real-corpus Recall/MRR/Precision — no corpus.
- Semantic retrieval — not implemented.
- Reranking — not implemented.
- OCR — engine unavailable.

## 4. Threshold policy

No new real-corpus thresholds are declared, because there is no defensible evaluation set. Gate 1 thresholds remain as recorded. Choosing thresholds without data would be retrospective and is refused.

## 5. Reproduction

`npx vitest run tests/benchmark/gate2-benchmark.test.ts` rewrites the results JSON and fails on any integrity drift.

## 6. Interpretation

The executed measurements validate regression integrity and parser mechanics. They say nothing about Philippine legal retrieval accuracy.
