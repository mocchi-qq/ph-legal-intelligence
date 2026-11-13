# Gate 3 Report — Authorization Closure, Expanded Corpus, Real Retrieval

**Date:** 2026-11-10
**Baseline:** Gate 2 accepted with limitations (owner-authorized 4-document pilot)
**Corpus expansion:** **BLOCKED — no counsel determination**

---

## A. Executive verdict

**BLOCKED.**

Gate 3's central objective — expanding from four owner-authorized documents to a legally authorized corpus of 20–50 documents — cannot be executed. No source has a written reuse determination, no Philippine counsel sign-off exists, and all 25 source records remain `UNKNOWN`/`NOT_REVIEWED`.

The safe, non-acquisition work was completed and is reported below: counsel packet, immutable snapshot model, parser isolation, OCR feasibility, identity/version audit, real-corpus retrieval evaluation, technical citation annotation, grounded-answering hardening, and performance measurement.

This verdict is about authorization, not engineering. No additional legal document was acquired.

## B. Scope completed

| Area                                         | State                           | Evidence                                         |
| -------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Baseline + regression                        | Complete                        | `00_BASELINE.md`; 256 tests at baseline          |
| Counsel dossier (25 sources × 13 activities) | Prepared, not reviewed          | `01_COUNSEL_AUTHORIZATION.md`, `counsel-review/` |
| Corpus expansion                             | **BLOCKED**                     | `REAL_CORPUS_MANIFEST.json`                      |
| Immutable snapshots + change classification  | Implemented, tested             | `02_SOURCE_SNAPSHOTS.md`; 8 tests                |
| Parser isolation (`prlimit` + `unshare -n`)  | Implemented, tested             | `03_DOCUMENT_SECURITY.md`; 14 PDF tests          |
| Malware scanning                             | **Unavailable**                 | no scanner installed                             |
| OCR                                          | **Blocked / not required**      | `04_OCR_AND_EXTRACTION_QUALITY.md`               |
| Identity + version reconciliation            | Partial; dates UNKNOWN          | `05_LEGAL_VERSION_RECONCILIATION.md`             |
| Real-corpus retrieval evaluation             | Executed on 4 docs              | `06_RETRIEVAL_EVALUATION.md`; 14 queries         |
| Semantic citation evaluation                 | Partial; technical labels only  | `07_SEMANTIC_CITATION_EVALUATION.md`; 7 pairs    |
| Grounded answering                           | Hardened; lexical-only excluded | `08_GROUNDED_ANSWERING.md`                       |
| Performance                                  | Measured on 4 docs              | `09_PERFORMANCE_AND_RESOURCE_REPORT.md`          |
| Independent review                           | Complete; corrections applied   | `10_INDEPENDENT_REVIEW.md`                       |

Independent review on 2026-11-13 re-ran the regression suite, recomputed the pilot hashes, probed exact-identifier routing and compared every reported metric with its stored JSON. It found two routing defects and four reporting inconsistencies. All were corrected before this report was finalised; the verdict is unchanged.

## C. Counsel authorization status

- 0 of 25 sources reviewed by counsel.
- 0 of 325 source-activity determinations made.
- Owner risk acceptance covers four documents for internal evaluation only.
- No status changed; no approval invented.
- Packet: `counsel-review/` (dossier, worksheet, questions, brief).

## D. Corpus and snapshots

| Measure                        | Value                                                  |
| ------------------------------ | ------------------------------------------------------ |
| Authorized sources             | 0                                                      |
| Owner-authorized documents     | 4                                                      |
| Acquired snapshots (Gate 2)    | 4                                                      |
| New acquisitions in Gate 3     | **0**                                                  |
| Documents in production corpus | **0**                                                  |
| Snapshot events (new model)    | tested in memory; not yet applied to a new acquisition |

The Gate 2 finding is preserved: identical URL and length do not imply identical bytes. Hashes are per-retrieval; no legal version is created from a hash change.

## E. Extraction, identity, versioning

- 4 documents → 54 provisions, 87 chunks; all identifiers parsed.
- Two evidenced amendment edges (RA 12326 → RA 12232; RA 12325 → RA 10931), recorded in Gate 2 via disclosed synthetic carriers. The Gate 3 four-document build contains 0 relationship records.
- **All publication, promulgation, approval and effectivity dates are UNKNOWN.**
- Temporal validity is therefore not evidence-based for the pilot.
- No historical versions were created; no implied repeal was operationalized.
- OCR: no engine, no OCR output, no confidence claims.

## F. Retrieval results (4-document pilot)

| Metric            | Result                   |
| ----------------- | ------------------------ |
| Exact identifiers | 6/6 (100%)               |
| Positive queries  | 9                        |
| Recall@1          | 8/9 (88.9%)              |
| Recall@5          | 9/9 (100%)               |
| Recall@10         | 9/9 (100%)               |
| MRR               | 0.944                    |
| Precision@5       | 0.694                    |
| Negative queries  | 5/5 empty (100%)         |
| Filipino query    | no results (unsupported) |

Thresholds were declared before the run (exact 100%, Recall@5 ≥80%, negatives 100%) and were met after fixing identifier routing and adding a corpus-independent query-term coverage rule. This is **not** general retrieval accuracy on four documents.

## G. Citation semantic-support results

- 7 technical pairs, one document; labels are not legal opinions.
- Annotation mechanism agreed 7/7 with reviewed labels.
- Lexical proxy: 0 false positives on these pairs, but **0 contradictions detected** and **0 direct quotations classified**; it cannot detect partial support.
- Temporal evidence absent (unknown effectivity dates).
- No entailment model or LLM verifier exists.
- Grounding now excludes `LEXICAL_ONLY` even when aggregate status is `VERIFIED`.

## H. Security and performance

- Parser runs under 512 MiB address space, 20 s CPU, 64 processes, 64 MiB file, 500-page cap, private temp file, and network namespace isolation (`unshare -n`, verified working).
- No filesystem sandbox, no malware scanner, no TLS pinning. Documented as residual risk.
- Transport re-validates every redirect and resolves DNS per hop.
- 4-document performance (recorded run): ingest 248.98 ms, index 120.24 ms, query p95 7.016 ms, RSS delta 17 MB. Timings vary with host load.

## I. Limitations

1. No counsel authorization; corpus expansion blocked.
2. Four documents only; no general retrieval or legal-accuracy claim.
3. Dates unknown; temporal validity not evidence-based.
4. No OCR; scanned documents unsupported.
5. No semantic retrieval, reranking or entailment model.
6. Citation labels are technical, single-reviewer; no legal adjudication.
7. No second-source authenticity check for the four documents.
8. Parser is not filesystem-sandboxed; no malware scan.
9. No authentication, tenancy, deployment or public service.
10. Performance measured on four documents only.
11. The retrieval gold set is a development/integration set, not held out; its metrics are optimistic.
12. The Gate 3 retrieval corpus re-creates no amendment relationships; Gate 2 edges are provenance-only.

## J. Recommended next gate

**A. Authorization closure** is the only defensible next stage.

1. Obtain per-source, per-activity counsel determinations, starting with the Supreme Court E-Library and Official Gazette.
2. On approval, expand to 20–50 counsel-authorized documents across statute, IRR and decisions.
3. Add a second-source authenticity check and verified effectivity dates.
4. Re-run the retrieval and citation evaluations with pre-declared thresholds on the expanded corpus.

Semantic retrieval (B) and authentication (E) should not be prioritized while authorization and evidence quality remain unresolved.

Gate 3 acceptance does **not** authorize bulk ingestion, redistribution, deployment, public coverage claims, or legal advice.
