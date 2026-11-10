// Gate 1 benchmark — declarations and thresholds.
// The executable benchmark is `tests/benchmark/gate1-benchmark.test.ts`, run with:
//   npx vitest run tests/benchmark/gate1-benchmark.test.ts
// It rebuilds the synthetic corpus, recomputes every metric, writes
// docs/gates/gate-1/08_benchmark-results.json, and fails if a threshold is missed.

export const GATE1_THRESHOLDS = {
  exactIdentifier: 1,
  recallAt10: 0.9,
  recallAt5: 0.8,
  passageAccuracy: 0.85,
  citationLayerAccuracy: 1,
  versioningAccuracy: 1,
  abstentionAccuracy: 1,
  maxExtraDuplicateDocuments: 0,
  recoveryAccuracy: 1,
} as const;

export const GATE1_UNIMPLEMENTED = ["semantic_retrieval", "cross_encoder_reranking", "ocr", "pdf_parsing"] as const;
