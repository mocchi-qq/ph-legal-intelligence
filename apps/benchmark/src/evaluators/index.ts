// Benchmark evaluator stubs — Gate 0
// Responsibility: see docs/ai-evaluation/LEGAL_BENCHMARK.md
// These interfaces define the contract for each metric evaluator.
// Implementations land in later gates.

export interface RetrievalSample {
  queryId: string;
  retrieved: string[];
  relevant: string[];
}

/** Recall@10: fraction of relevant authorities appearing in the top ten. */
export interface RecallAt10Evaluator {
  evaluate(samples: RetrievalSample[]): { recallAt10: number };
}

/** Precision@5: fraction of the top five results that are relevant. */
export interface PrecisionAt5Evaluator {
  evaluate(samples: RetrievalSample[]): { precisionAt5: number };
}

/** MRR: mean reciprocal rank of the first relevant result. */
export interface MrrEvaluator {
  evaluate(samples: RetrievalSample[]): { mrr: number };
}

/** Citation identity accuracy: cited authority exists and matches identity. */
export interface CitationIdentityAccuracyEvaluator {
  evaluate(cases: Array<{ cited: string; expected: string }>): {
    accuracy: number;
  };
}

/** Citation passage accuracy: cited passage exists and matches canonical text. */
export interface CitationPassageAccuracyEvaluator {
  evaluate(cases: Array<{ citedPassage: string; canonicalPassage: string }>): {
    accuracy: number;
  };
}

/** Claim support rate: material claims with traceable support. */
export interface ClaimSupportRateEvaluator {
  evaluate(claims: Array<{ claim: string; supported: boolean }>): {
    supportRate: number;
  };
}

/** Temporal correctness: correct historical law applied. */
export interface TemporalCorrectnessEvaluator {
  evaluate(cases: Array<{ appliedVersion: string; expectedVersion: string }>): {
    correctness: number;
  };
}

/** Abstention quality: appropriate refusal when evidence is insufficient. */
export interface AbstentionQualityEvaluator {
  evaluate(cases: Array<{ abstained: boolean; shouldAbstain: boolean }>): {
    quality: number;
  };
}

/** Answer completeness: coverage of relevant legal issues. */
export interface AnswerCompletenessEvaluator {
  evaluate(
    cases: Array<{ expectedIssues: string[]; addressedIssues: string[] }>,
  ): { completeness: number };
}

/** Retrieval latency: search performance. */
export interface RetrievalLatencyEvaluator {
  evaluate(samples: Array<{ latencyMs: number }>): {
    p50: number;
    p95: number;
    p99: number;
  };
}

/** Generation latency: AI response performance. */
export interface GenerationLatencyEvaluator {
  evaluate(samples: Array<{ latencyMs: number }>): {
    p50: number;
    p95: number;
    p99: number;
  };
}
