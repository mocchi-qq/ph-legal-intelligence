# Benchmark Report

**Date:** 2026-11-10
**Executable:** `tests/benchmark/gate1-benchmark.test.ts`
**Raw results:** `docs/gates/gate-1/08_benchmark-results.json`
**Fixtures:** `legal-data/benchmark/synthetic-fixtures/manifest.json` (all `SYNTHETIC`)

## 1. Corpus

| Measure        | Actual |
| -------------- | ------ |
| Documents      | 8      |
| Versions       | 9      |
| Provisions     | 31     |
| Chunks         | 31     |
| Ingestion runs | 10     |
| Duplicate runs | 1      |

## 2. Results against thresholds fixed before execution

| Area                  | Threshold    | Result                           | Pass |
| --------------------- | ------------ | -------------------------------- | ---- |
| Exact identifier      | 100%         | 4/4                              | Yes  |
| Recall@10             | ≥90%         | 8/8 (100%)                       | Yes  |
| Recall@5              | ≥80%         | 8/8 (100%)                       | Yes  |
| Passage accuracy      | ≥85%         | 3/3 (100%)                       | Yes  |
| Citation identity     | 100%         | 10/10                            | Yes  |
| Citation location     | 100%         | 10/10                            | Yes  |
| Proposition support   | 100%         | 10/10                            | Yes  |
| Citation temporal     | 100%         | 10/10                            | Yes  |
| Amendment recognition | 100%         | 4/4 checks                       | Yes  |
| Repeal recognition    | 100%         | 4/4 checks                       | Yes  |
| Historical version    | 100%         | 4/4 checks                       | Yes  |
| Abstention            | 100%         | 3/3                              | Yes  |
| Duplicate ingestion   | 0 extra docs | 3/3 checks, 1 duplicate detected | Yes  |
| Recovery              | 100%         | 3/3 checks                       | Yes  |

## 3. Negative tests

All passed: nonexistent G.R. number, plausible nonexistent statute, wrong section, topic-only passage, old proposition against amended text, repealed provision, missing date, instruction-like proposition, duplicate artifact, empty extraction. The correct outcome in several cases is a refusal or abstention.

## 4. What these numbers mean

They show that the implemented mechanics behave as specified **on ten fictional documents with hand-authored expectations**. They do not measure Philippine legal accuracy, recall over a real corpus, or performance under load. No semantic retrieval or reranking score exists because those components are not implemented.

## 5. Reproducibility

`npx vitest run tests/benchmark/gate1-benchmark.test.ts` rebuilds the corpus deterministically, recomputes every metric, rewrites the JSON result file, and fails if any pre-declared threshold is missed.
