# Gate 1 Report — Legal Data Foundation

**Date:** 2026-11-10
**Scope:** source authorization, bounded ingestion, legal versioning, passage retrieval, citation integrity, benchmarking, security review
**Corpus:** `SYNTHETIC` fixtures only

---

## A. Executive verdict

**ACCEPTED WITH LIMITATIONS.**

The bounded pipeline, version model, retrieval and four-layer citation verifier are implemented and pass an executable benchmark on ten fictional documents. The legal-data foundation is mechanically proven on synthetic data.

**Bulk ingestion remains BLOCKED — COUNSEL SIGN-OFF NOT OBTAINED.** No source is approved for test or bulk use. No real Philippine legal document was acquired, stored or redistributed. Gate 1 does not authorize bulk ingestion regardless of the technical results below.

## B. Scope actually completed

| Workstream                              | State                  | Evidence                                                                                                  |
| --------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Source inventory + authorization matrix | Done (research only)   | `SOURCE_AUTHORIZATION_MATRIX.md`, `sources.authorization.json` (25 sources, all `UNKNOWN`/`NOT_REVIEWED`) |
| Counsel reuse packet                    | Prepared, not reviewed | `01_SOURCE_REUSE_REVIEW.md`; no sign-off exists                                                           |
| Bounded ingestion                       | Built, tested          | 13 tests; 10 runs, 8 docs, 9 versions, 31 provisions/chunks                                               |
| Legal versioning                        | Built, tested          | 4/4 amendment, 4/4 repeal, 4/4 historical checks                                                          |
| Retrieval                               | Built, tested          | exact 4/4, Recall@5 8/8, Recall@10 8/8, passage 3/3, negatives 3/3                                        |
| Citation verification                   | Built, tested          | identity/location/support/temporal 10/10 each                                                             |
| Grounding                               | Built, tested          | 6 tests; abstains without verified citations                                                              |
| Benchmark                               | Executed               | `08_benchmark-results.json`                                                                               |
| Security/privacy review                 | Done                   | `03_SECURITY_AND_PRIVACY_REVIEW.md`                                                                       |
| Independent review                      | Approved (third pass)  | `09_INDEPENDENT_REVIEW.md`                                                                                |

## C. Source authorization findings

- 25 sources inventoried. **0 approved for test. 0 approved for bulk.** All `UNKNOWN` / `NOT_REVIEWED`, all requiring counsel.
- Technical evidence gathered is limited to `robots.txt` for three domains. Two return 404 (no robots file); the Official Gazette allows public paths and disallows admin paths. A robots file is not a reuse licence.
- No agency, firm, university or organisation was contacted. No inquiry was sent.

## D. Corpus (actual counts, not planned)

| Dimension                             | Actual                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| Documents                             | 8                                                                |
| Versions                              | 9                                                                |
| Provisions                            | 31                                                               |
| Chunks                                | 31                                                               |
| Document types                        | REPUBLIC_ACT, COURT_DECISION, EXECUTIVE_ORDER, AGENCY_REGULATION |
| Source                                | all `SYNTHETIC`                                                  |
| Independently verified real documents | 0                                                                |
| Publication-eligible                  | 0                                                                |

## E. Data integrity

- Every artifact has a SHA-256 and a stable locator.
- One duplicate pair detected; it created no extra document, version or chunk.
- One identity type-conflict test returns `IDENTITY_AMBIGUOUS` without writing.
- Empty extraction and unsupported MIME fail without mutating the corpus; retry succeeds.
- No original artifact is overwritten; versions are append-only.

## F. Legal versioning

- Amendment: evidenced `AMENDS` scoped to `Section 2` marks that provision `AMENDED`; siblings stay `IN_FORCE`; instrument becomes `PARTIALLY_AMENDED`.
- Repeal: evidenced `PARTIALLY_REPEALS` scoped to `Section 4` marks it `REPEALED` with an effective end date.
- Unevidenced relationships change no legal status.
- Point-in-time retrieval selects the version in force at the anchor date.

## G. Retrieval and citation results

See `06_RETRIEVAL_REPORT.md` and `07_CITATION_VERIFICATION_REPORT.md`. Headline: every pre-declared threshold met on the synthetic set. Semantic retrieval and reranking are **not implemented** and receive no credit.

## H. Security and privacy

Tested: unauthorized-source refusal, audit of refused attempts, MIME validation, empty-extraction failure, private/public index separation, synthetic labelling, no secrets in `.env.example`, instruction stripping.
Untested: authentication, tenancy, rate limiting, malware scanning, encryption configuration, backups, retention automation. No claim of DPA compliance is made.

## I. Independent review

Independent cross-lane review completed three passes and **approved** at commit `b0d0866` (`09_INDEPENDENT_REVIEW.md`). The first pass approved the engineering substance but raised one blocking status defect (this report claimed the review was complete before the record existed) plus seven minor or record-accuracy issues. The second pass caught four fixes that had been claimed but not applied; that inaccuracy is recorded rather than hidden. The third pass confirmed every fix in the tree and reproduced all results independently. Gate 1 is therefore recorded as **ACCEPTED WITH LIMITATIONS**, with bulk ingestion **BLOCKED** for lack of counsel sign-off.

## J. Limitations

1. **No real legal material.** Every result is on fictional documents.
2. **No source authorization and no counsel sign-off.** Bulk ingestion blocked.
3. **Support verification is a lexical proxy**, not semantic entailment.
4. **No semantic retrieval or reranking.**
5. **No OCR / PDF support.**
6. **No authentication, tenancy or deployed database.**
7. **No legal accuracy claim.** Hand-authored expectations are not a legal benchmark.
8. **Relationship data is synthetic**; no case-treatment corpus exists.

## K. Authorization decision

Gate 1 authorizes:

- continued work on the bounded pipeline, parser, verifier and synthetic benchmarks;
- preparation of a counsel review package;
- a second controlled synthetic or explicitly authorized corpus test.

Gate 1 does **not** authorize:

- bulk ingestion, scraping, mirroring or redistribution;
- production deployment or public coverage claims;
- training a model on collected legal material;
- paid infrastructure expansion.

## L. Next gate recommendation

1. **Obtain counsel determination** for Tier 1 sources using the prepared packet.
2. If any source is authorized for test, run a second controlled corpus test on a small, real, authorized sample (30–50 documents).
3. In parallel, add PDF/OCR extraction and a semantic retrieval evaluation on the synthetic set.
4. Do not begin nationwide ingestion until the source-authorization gate is closed in writing.
