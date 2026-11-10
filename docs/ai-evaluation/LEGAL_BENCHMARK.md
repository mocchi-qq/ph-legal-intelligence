# Legal Benchmark — Philippine Legal Intelligence Platform

**Version:** Gate 0 Specification
**Last Updated:** 2026-11-09

This document defines the independent evaluation system required before the first public release. It specifies the benchmark design, metrics, launch gates, and red-team scenarios. The proposed allocations are engineering targets, not an existing validated benchmark.

---

## 1. Benchmark Design

### 1.1 Initial Benchmark: 500 Questions

| Category | Test Questions |
|----------|----------------|
| Constitutional law | 50 |
| Civil law | 70 |
| Criminal law | 60 |
| Labor law | 60 |
| Taxation | 50 |
| Commercial law | 50 |
| Remedial law | 60 |
| Administrative law | 40 |
| Legal research and citations | 30 |
| Historical law versions | 30 |
| **Total** | **500** |

Fixtures live in `legal-data/benchmark-fixtures/questions.json`. Each question carries: a known legal issue, expected primary authorities, applicable date, expected legal conclusion or acceptable range, required citations, known ambiguities, and expert-review status. All initial entries are `PENDING` and must be authored and reviewed by qualified Philippine legal experts before the benchmark is valid.

### 1.2 Question Schema

```json
{
  "id": "Q001",
  "category": "constitutional_law",
  "question": "...",
  "issue": "...",
  "expected_authorities": ["..."],
  "applicable_date": "YYYY-MM-DD",
  "expected_conclusion": "... or acceptable range",
  "required_citations": ["..."],
  "known_ambiguities": "...",
  "expert_review_status": "PENDING | REVIEWED | VERIFIED"
}
```

---

## 2. Evaluation Metrics

| Metric | What It Measures |
|--------|------------------|
| Recall@10 | Whether relevant authorities appear in the top ten |
| Precision@5 | Whether retrieved authorities are relevant |
| MRR | Ranking quality (mean reciprocal rank of first relevant result) |
| Citation identity accuracy | Correctness of cited authority |
| Citation passage accuracy | Correctness of cited passage |
| Claim support rate | Whether sources support claims |
| Temporal correctness | Correct historical law applied |
| Abstention quality | Appropriate refusal when evidence is insufficient |
| Answer completeness | Coverage of relevant legal issues |
| Retrieval latency | Search performance |
| Generation latency | AI response performance |

### 2.1 Metric Definitions

- **Recall@10** = (# relevant authorities in top 10) / (# relevant authorities). Target ≥95%.
- **Precision@5** = (# relevant in top 5) / 5.
- **MRR** = mean of 1/rank of the first relevant authority.
- **Citation identity accuracy** = fraction of cited authorities that exist and match the correct identity (G.R. number, RA number, case name). Target ≥99%.
- **Citation passage accuracy** = fraction of cited passages that exist at the cited location and match the canonical text. Target ≥98%.
- **Claim support rate** = fraction of material factual claims with traceable supporting evidence. Target 100%.
- **Temporal correctness** = fraction of answers that apply the version of law in force at the relevant date. Target ≥98%.
- **Abstention quality** = fraction of cases where the system correctly abstains or flags uncertainty when evidence is insufficient.
- **Answer completeness** = fraction of expected issues addressed.

---

## 3. Launch Gates

These are engineering targets to be validated, not claims about current performance. All must be met before public launch.

| Quality Gate | Requirement |
|--------------|-------------|
| Canonical identity accuracy | ≥99% on audited records |
| Citation identity accuracy | ≥99% |
| Citation passage accuracy | ≥98% |
| Material factual claims with traceable support | 100% |
| Historical law selection | ≥98% on benchmark |
| Retrieval Recall@10 | ≥95% |
| Cross-tenant data leakage | 0 |
| Critical security vulnerabilities | 0 |
| Unverified source presented as verified | 0 |
| Unsupported legal certainty | 0 in release benchmark |

For citation support, the 98% target must be independently evaluated. A citation that exists but does not support its associated claim counts as a failure.

---

## 4. Red-Team Scenarios

Test cases must deliberately include:

- Fake G.R. numbers
- Incorrect case names
- Nonexistent statutes
- Repealed laws
- Partially amended provisions
- Conflicting judicial decisions
- Outdated regulations
- Malicious uploaded PDFs
- Prompt injection
- Cross-tenant file access
- Deliberately incomplete user facts
- Questions involving foreign law
- Questions without sufficient authority

The model must be rewarded for acknowledging uncertainty, not for generating an answer at all costs.

---

## 5. Evaluation Protocol

1. Curate questions and expected authorities with expert review.
2. Run retrieval-only evaluation (Recall@10, Precision@5, MRR, latency).
3. Run full-answer evaluation (citation identity, citation passage, claim support, temporal correctness, abstention, completeness).
4. Reconcile with human expert judgments on a sampled subset.
5. Run red-team scenarios separately and track pass/fail.
6. Record model, prompt version, retrieval config, and document versions for reproducibility.
7. Publish results per release in `apps/benchmark/reports/`.

---

## 6. Release Blocking

A release is blocked if any launch gate in §3 fails, or if any red-team scenario in §4 produces an unsafe outcome (fabricated citation presented as verified, cross-tenant leakage, unsupported legal certainty).