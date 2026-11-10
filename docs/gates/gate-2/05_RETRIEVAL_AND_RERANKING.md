# Retrieval and Reranking

**Date:** 2026-11-10
**Baseline:** Gate 1 lexical retrieval (unchanged)
**Real corpus:** **BLOCKED** — 0 documents

## 1. Baseline preserved

Gate 1 lexical retrieval, exact-identifier routing, metadata filters, point-in-time version selection and RRF are unchanged. The Gate 1 benchmark JSON is hash-pinned in the Gate 2 benchmark test (`7fca3b67…b0a5`) and re-verified by test.

## 2. Real-corpus baseline

Not measured. There is no authorized corpus. Reporting zero or "not run" is the honest result; no synthetic number is substituted.

## 3. Semantic retrieval

**NOT IMPLEMENTED.**

Model selection requires: Filipino and English capability, legal terminology performance, size, CPU/RAM cost, dimensions, licence, offline operation. No model was downloaded or evaluated. No embedding index exists. No multilingual claim is made.

The retrieval API already carries a `semantic` score slot; it is `0` and is not used for ranking. There is no silent semantic fallback.

## 4. Hybrid retrieval

Hybrid combination beyond Gate 1's exact+lexical RRF is **NOT IMPLEMENTED**. Adding a semantic list requires an evaluated embedding model first.

## 5. Reranking

**NOT IMPLEMENTED.** No cross-encoder was selected, downloaded or benchmarked. No claim of improvement is made.

## 6. Exact-identifier safety (tested)

- `G.R. No. 000000` → empty result set.
- A real identifier returns the correct document, and lexical noise from unrelated documents is suppressed when an exact identifier matches.
- Identifier-shaped queries never fall through to approximate matching.

## 7. Evaluation dataset

No real-corpus query set was created, because expected answers require real documents. The Gate 1 synthetic query set remains the only executed evaluation.

## 8. Result

Retrieval remains the Gate 1 lexical system, re-verified. Semantic retrieval, hybrid semantic fusion and reranking are absent and are not credited.
