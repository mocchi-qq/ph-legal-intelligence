# Retrieval Evaluation — Owner-Authorized Pilot

**Date:** 2026-11-10
**Gold set:** `retrieval-gold-set.json` (14 queries, authored by reading the snapshots)
**Results:** `retrieval-results.json`
**Reviewer:** technical author (engineer), not a legal reviewer

## 1. Thresholds declared before the run

- Exact identifier accuracy: **100%**
- Positive Recall@5: **≥ 80%**
- Negative empty accuracy: **100%**

The sample is four documents. These are integration thresholds, not general retrieval accuracy.

## 2. Measured results

| Metric                 | Result           |
| ---------------------- | ---------------- |
| Documents / provisions | 4 / 54           |
| Exact identifiers      | 6/6 (100%)       |
| Positive queries       | 9                |
| Recall@1               | 8/9 (88.9%)      |
| Recall@5               | 9/9 (100%)       |
| Recall@10              | 9/9 (100%)       |
| MRR                    | 0.944            |
| Precision@5            | 0.778            |
| Negative queries       | 5/5 empty (100%) |
| Queries measured       | 14               |

All three thresholds were met after two defects were fixed (below).

## 3. Defects found and fixed during evaluation

1. **Identifier routing swallowed questions.** A natural-language question containing "Republic Act No. 12232" was treated as an identifier-only query and returned nothing. The guard now applies only when the query _starts_ with an identifier form. The amendment question now retrieves RA 12326.
2. **Adversarial exact-vs-title query returned nothing.** `RA 12325 fixing the term of office…` now resolves the exact identifier and suppresses the misleading title fragment.
3. **Weak shared-token matches.** A relevance floor (`MIN_LEXICAL = 1.0`) was added after observing out-of-corpus and Filipino queries scoring 0.41–0.56 while genuine queries scored 1.66–3.45. This floor is calibrated on four documents and **must be re-evaluated on a larger corpus**.

## 4. Exact-identifier safeguards

Tested empty for: nonexistent `Republic Act No. 99999`, transposed `12362`, nonexistent `G.R. No. 999001`, and an out-of-corpus statute. Exact identifiers never fall through to approximate matching.

## 5. Multilingual gap

The Filipino query "termino ng opisina ng mga opisyal ng barangay" returns **no results**. Retrieval is English-token lexical; this is a documented gap, not multilingual support. `multilingual_gap.supported = false` in the results.

## 6. Not measured

- Semantic retrieval (not implemented).
- Reranking (not implemented).
- Confidence intervals (sample too small).
- Latency at scale (see performance report).

## 7. Interpretation

The four-document pilot shows the pipeline can retrieve the right document and passage for authored queries. It does **not** establish general retrieval accuracy, and the result must not be cited as a corpus benchmark.
