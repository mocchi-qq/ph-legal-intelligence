# Gate 1 Plan — Legal Data Foundation

**Goal:** prove the legal-data pipeline on a small, bounded, reproducible corpus, without unauthorized collection.

**Hard constraint:** no real Philippine legal source may be ingested. No reuse authorization and no counsel sign-off exist. Therefore all executable corpus work uses fixtures explicitly marked `SYNTHETIC`. Bulk ingestion remains blocked.

## Workstreams

| ID   | Workstream                    | Deliverable                                                                    |
| ---- | ----------------------------- | ------------------------------------------------------------------------------ |
| G1-A | Source authorization research | authorization matrix, JSON registry, reuse review packet, counsel checklist    |
| G1-B | Canonical model + migration   | relationship types, evidence fields, chunk + ingestion-run tables              |
| G1-C | Bounded ingestion             | preserve/hash/dedupe/identity/extract/structure/chunk/idempotency              |
| G1-D | Legal versioning              | version chain, amend/repeal edges, point-in-time selection                     |
| G1-E | Retrieval                     | exact identifier + lexical + metadata filter + RRF; semantic explicitly absent |
| G1-F | Citation verification         | identity, location, support, temporal with explicit states                     |
| G1-G | Grounding                     | evidence-only answer composer; abstains without verified citations             |
| G1-H | Benchmark + negative tests    | measured results with denominators                                             |
| G1-I | Security/privacy review       | tested vs untested controls                                                    |
| G1-J | Independent review + report   | verdict and authorization decision                                             |

## Thresholds fixed before results

| Metric                                | Threshold | Denominator                       |
| ------------------------------------- | --------- | --------------------------------- |
| Exact identifier accuracy             | 100%      | 4/4                               |
| Recall@10                             | >= 90%    | all retrieval cases               |
| Recall@5                              | >= 80%    | all retrieval cases               |
| Passage retrieval accuracy            | >= 85%    | all passage cases                 |
| Citation identity accuracy            | 100%      | all citation cases                |
| Citation location accuracy            | 100%      | all citation cases                |
| Proposition-support accuracy          | 100%      | 4 planned; 10 executed (see note) |
| Amendment recognition                 | 100%      | 2                                 |
| Historical version accuracy           | 100%      | 2                                 |
| Abstention correctness                | 100%      | 3                                 |
| Duplicate canonical documents created | 0         | duplicate ingest test             |
| Recovery after interrupted ingest     | 100%      | 1                                 |

A synthetic corpus cannot establish nationwide coverage or universal legal accuracy. Every report must say so.

**Drift note:** the support metric was planned with 4 cases; the executed benchmark uses 10 (positive, negative and adversarial). The executed denominator is recorded in `docs/gates/gate-1/08_benchmark-results.json`. Thresholds were not changed after seeing results.

## Stop conditions honoured

- Bulk ingestion: BLOCKED — no authorization, no counsel sign-off.
- Real source acquisition: not attempted.
- Any synthetic fixture is labelled `synthetic: true` in data and in reports.
