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
| Precision@5            | 0.694            |
| Negative queries       | 5/5 empty (100%) |
| Queries measured       | 14               |

All three thresholds were met after three defects were fixed (below).

## 3. Defects found and fixed during evaluation

1. **Identifier routing swallowed questions.** A natural-language question containing "Republic Act No. 12232" was treated as an identifier-only query and returned nothing. The guard now applies only when an identifier form appears within the first two tokens; a question that cites an identifier later in the sentence is handled lexically. The amendment question now retrieves RA 12326.
2. **Adversarial exact-vs-title query returned nothing.** `RA 12325 fixing the term of office…` now resolves the exact identifier and suppresses the misleading title fragment.
3. **Weak shared-token matches.** A query-term coverage floor (`MIN_TERM_COVERAGE = 0.3`, ignoring generic legal terms) was added alongside the existing lexical floor (`MIN_LEXICAL = 0.02`). It rejects passages that share only one generic term with the query. It is a heuristic set by inspection on four documents and **must be re-evaluated on a larger corpus**.

## 4. Exact-identifier safeguards

Tested empty on the pilot for: nonexistent `Republic Act No. 99999`, transposed `12362`, nonexistent `G.R. No. 999001`, and an out-of-corpus statute.

Independent review found two routing gaps that the pilot set did not cover: only Republic Act aliases were canonicalized, and exact matching used substring containment. As a result `Executive Order No. 101` / `EO 101` and `G.R. 999001` failed, while an ambiguous `Act No. 1001` fell through to lexical neighbours. The matcher now builds canonical aliases for RA/EO/PD/BP/CA/G.R. and compares by exact key equality; identifier-shaped queries with no exact hit return empty. `tests/retrieval/exact-identifier-safeguards.test.ts` covers one-digit changes, transpositions, similar G.R. numbers, cross-type collision and missing-prefix ambiguity. This test uses the synthetic fixture corpus, not the four real Acts.

## 5. Multilingual gap

The Filipino query "termino ng opisina ng mga opisyal ng barangay" returns **no results**. Retrieval is English-token lexical; this is a documented gap, not multilingual support. `multilingual_gap.supported = false` in the results.

## 6. Not measured

- Semantic retrieval (not implemented).
- Reranking (not implemented).
- Confidence intervals (sample too small).
- Latency at scale (see performance report).

## 7. Evaluation-set limitations

- The 14 queries were authored by the same engineer who fixed the retrieval defects. They are a development and integration set, not a held-out evaluation set.
- Three defects were fixed after observing failures on this query set, so the reported metrics are optimistic. There is no dev/tuning/validation/held-out split, and no near-duplicate separation.
- The four-Republic-Act corpus cannot represent G.R. numbers, executive orders, presidential decrees, IRRs, judicial interpretation, historical versions, section-reference queries or mixed-language queries. Those categories are not measured, not "passed".
- No confidence intervals are reported; the sample is too small for them.

## 8. Interpretation

The four-document pilot shows the pipeline can retrieve the right document and passage for authored queries. It does **not** establish general retrieval accuracy, and the result must not be cited as a corpus benchmark.
