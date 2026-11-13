# Independent Review — Gate 3

**Review date:** 2026-11-13
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD under review:** `0dea7ba` (32 commits)
**Reviewer:** independent engineering verification pass by the lead agent. The reviewer did not author commit `0dea7ba`. This is **not** a legal review.
**Scope:** Gate 3 artifacts, code diff `ab8153d..0dea7ba`, and the corrections made during this review.

## 1. Verdict

**APPROVE WITH CORRECTIONS for the safe, non-acquisition scope.**
**Gate 3 overall verdict remains BLOCKED** because no counsel determination exists and no source is authorized.

The engineering work is reproducible after the corrections below. Corpus expansion, redistribution, public deployment and legal-accuracy claims remain unsupported.

## 2. What was independently re-run

| Check                       | Result                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `npx vitest run`            | 33 test files passed, 1 skipped (live pilot); 277 tests passed, 1 skipped                        |
| `pnpm build`                | exit 0                                                                                           |
| `npx biome check .`         | exit 0, 0 errors, 57 warnings (pre-existing non-null assertions)                                 |
| Gate 1 benchmark hash       | `7fca3b67a347f634f6b88d274804d5d17662d6ea837c425f5f55a83030bfb0a5`, unchanged and pinned by test |
| Pilot SHA-256 recomputation | all four match `PILOT_MANIFEST.json`                                                             |
| Source authorization        | 25 sources, 25 × 13 = 325 activity cells, all `UNKNOWN`; 0 counsel determinations                |
| Gate 3 acquisitions         | 0 new documents; 4 owner-authorized Gate 2 documents only                                        |
| `unshare -n true`           | exit 0 on this host                                                                              |
| Scanner / OCR               | `clamscan` absent, `freshclam` absent, `tesseract` absent                                        |

Pilot hashes recomputed:

| Document | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| RA 12232 | `00b4c3671b93243bd6ace797ee2ec8da834b18645da932dbb36b81c0f5c863dd` |
| RA 10931 | `dc991d2bd2954a4e1d17adf1dd6a77b392353bd5dc7d351b299895f75d3c379a` |
| RA 12326 | `06cd3edc8da9b29c7e2a2ca54162fb06f2bc4b5df4f586946f4dda72097ee936` |
| RA 12325 | `ca45d318f9690bb8552d1819faf9ac8a20fc09f392e7cf22e90372a163da383c` |

## 3. Findings

Severity reflects impact on the claims made by Gate 3. All corrected findings were re-tested.

### F-01 — HIGH — Exact-identifier routing was incomplete and used substring matching (corrected)

**Evidence.** `packages/legal-search/src/retrieve.ts` canonicalized only Republic Act aliases. Independent probes on the synthetic fixture corpus showed:

- `Executive Order No. 101` and `EO 101` returned `[]` although `EXECUTIVE_ORDER:101` exists.
- `G.R. 999001` returned `[]` although `G.R. No. 999001` works.
- `Act No. 1001` (ambiguous/missing prefix) fell through to lexical neighbours (`REPUBLIC_ACT:1003`, `REPUBLIC_ACT:1002`, …) instead of returning nothing.
- Exact matching used `queryNormalized.includes(key)`, so a short identity key such as `republicact1` would match inside `republicact12326`.

**Correction.** Alias extraction now covers RA, EO, PD, BP, CA and G.R. forms; exact matching uses set equality on canonical keys; identifier-shaped queries return empty when no exact key matches. `tests/retrieval/exact-identifier-safeguards.test.ts` covers the cases above, including one-digit changes, transpositions, similar G.R. numbers and cross-type collisions.

**Verification.** New tests pass; existing retrieval and Gate 3 gold-set results are unchanged (regenerated output is byte-identical).

### F-02 — HIGH — Performance numbers in the reports did not match the stored artifact (corrected)

**Evidence.** Three different sets of numbers existed:

- `GATE_3_REPORT.md` said ingest 389.6 ms, index 160.8 ms, p95 14.2 ms.
- `09_PERFORMANCE_AND_RESOURCE_REPORT.md` said ingest 29.94 ms, index 8.93 ms, p95 1.118 ms.
- `performance-results.json` recorded ingest 248.98 ms, index 120.24 ms, p95 7.016 ms.

None of the prose values could be reproduced from the committed evidence.

**Correction.** The report and the 09 document now cite the recorded JSON run and state that timings are load-dependent. A later independent re-run measured lower ingest/index times and p95 ≈ 6.6 ms, which is disclosed rather than substituted.

### F-03 — MEDIUM — Precision@5 was misreported (corrected)

**Evidence.** `06_RETRIEVAL_EVALUATION.md` said 0.778; `retrieval-results.json` and the computation give 0.694.

**Correction.** The document now reports 0.694 and labels the metric as document-level precision over unique documents in the top-5 chunks.

### F-04 — MEDIUM — Retrieval-floor description did not match the code (corrected)

**Evidence.** The document claimed a `MIN_LEXICAL = 1.0` relevance floor calibrated on four documents. The code has `MIN_LEXICAL = 0.02` plus `MIN_TERM_COVERAGE = 0.3` over non-generic terms.

**Correction.** The document now describes both constants accurately and calls the coverage rule a heuristic requiring re-evaluation on a larger corpus.

### F-05 — MEDIUM — Test runs rewrote committed evidence (corrected)

**Evidence.** Every `npx vitest run` overwrote `performance-results.json` with new timings, dirtying the working tree and drifting the evidence away from the reports. Retrieval and citation artifacts were also rewritten unconditionally.

**Correction.** The three Gate 3 evidence writers now require `PH_WRITE_GATE3_EVIDENCE=1`, matching the Gate 1 benchmark precedent. A normal test run leaves the committed artifacts untouched.

### F-06 — MEDIUM — Relationship claim overstated what the Gate 3 corpus contains (corrected)

**Evidence.** `05_LEGAL_VERSION_RECONCILIATION.md` said two relationships were "applied from the documents' own text". In fact the evidence passages come from the amending Acts, but the relationship records were inserted through disclosed synthetic carriers in Gate 2. The Gate 3 four-document build contains **0** relationship records (54 provisions, 87 chunks).

**Correction.** The document now states the provenance explicitly and separates the Gate 2 evidence record from the Gate 3 retrieval corpus. No relationship was fabricated or auto-inferred.

### F-07 — LOW — Snapshot "immutability" was not enforced against caller mutation (corrected)

**Evidence.** `SnapshotStore.record()` stored the caller's `Uint8Array` reference and `get()` returned the stored reference. A caller could mutate a stored snapshot without a new acquisition event.

**Correction.** Bytes are copied on write and on read; a regression test mutates both the input and the returned array and verifies the stored snapshot is unchanged.

### F-08 — MEDIUM — Gold set is not held out (disclosed, not correctable at this corpus size)

**Evidence.** The 14 queries were authored by the same engineer who then fixed three retrieval defects exposed by those queries. There is no dev/tuning/validation/held-out split and no near-duplicate separation.

**Disposition.** Disclosed in `06_RETRIEVAL_EVALUATION.md` §7. The reported metrics must be treated as optimistic integration checks. Correcting this requires a larger authorized corpus and an independently authored query set.

### F-09 — LOW — Gold-set category coverage is incomplete (disclosed)

The four-Republic-Act corpus cannot represent G.R. numbers, executive orders, presidential decrees, IRRs, judicial interpretation, historical versions, section-reference queries or mixed-language queries. Those categories are now listed as not measured, not passed. Synthetic-fixture tests cover several identifier forms but are not real-corpus evidence.

### F-10 — INFO — Independent review artifact was absent (corrected)

`GATE_3_REPORT.md` correctly said review was pending. This document is that review; the report and kanban were updated only after the review and corrections were complete.

## 4. Adverse checks required by Gate 3

| Check                                      | Finding                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthorized ingestion                     | None. Gate 3 acquired 0 documents; the four pilot files are owner-authorized, git-ignored and non-redistributed.                                                |
| False authorization claims                 | None. All 25 sources remain `UNKNOWN`; 0 of 325 activity cells determined; no counsel sign-off claimed.                                                         |
| Missing source evidence                    | Not concealed. Every source records that terms were not captured and counsel review is outstanding.                                                             |
| Overwritten snapshots                      | None in the tested model. Events append; hashes are per retrieval. The store is in-memory and not yet persisted.                                                |
| Incorrect identity merges                  | None observed. Four distinct identity keys; no merge was performed.                                                                                             |
| Invented effectivity dates                 | None. Publication, promulgation, approval, effectivity, amendment and repeal dates are all `null`/`UNKNOWN`.                                                    |
| Fabricated amendments                      | None. Evidence passages are quoted; the synthetic carriers are disclosed; no implied repeal was operationalized.                                                |
| Benchmark leakage / hardcoded answers      | No expected answers are hardcoded in the evaluation; results are computed from the corpus. Tuning on the evaluation set is disclosed as F-08.                   |
| Unverified citations presented as verified | No. `LEXICAL_ONLY` is excluded by `composeGroundedAnswer` and a test asserts abstention.                                                                        |
| Semantic-support overclaim                 | None. Labels are technical, single-annotator, and explicitly not legal opinions.                                                                                |
| Unsandboxed processing                     | Partially addressed: `prlimit` limits and `unshare -n` isolation are active and verified. No filesystem sandbox, no malware scanner, no TLS pinning. Disclosed. |
| Unexecuted tests presented as passing      | No. The live pilot is skipped and labelled; the skipped test is reported as skipped.                                                                            |
| Claimed fixes absent from source           | None. Snapshot model, parser isolation, lexical-only exclusion, identifier routing and evidence guards are all present in the tree.                             |

## 5. Corrections made during review

| File                                                              | Change                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/legal-search/src/retrieve.ts`                           | canonical identifier aliases; exact-key equality; broader identifier-shaped guard |
| `tests/retrieval/exact-identifier-safeguards.test.ts`             | new exact-identifier regression tests                                             |
| `packages/legal-ingestion/src/snapshot.ts`                        | defensive byte copies on write/read                                               |
| `tests/legal-data/snapshots.test.ts`                              | mutation-isolation test                                                           |
| `tests/benchmark/gate3-{retrieval,citations,performance}.test.ts` | evidence writes gated by `PH_WRITE_GATE3_EVIDENCE=1`                              |
| `docs/gates/gate-3/05…`, `06…`, `09…`, `GATE_3_REPORT.md`         | corrected relationship provenance, metrics, constants and timings                 |
| `KANBAN.md`                                                       | review and safeguard cards moved to verified                                      |

## 6. Residual limitations that block acceptance of a corpus

1. No counsel determination; 0 of 25 sources authorized.
2. Four owner-authorized documents only; no production corpus.
3. No verified publication/effectivity dates or second-source authenticity check.
4. Retrieval gold set is small, development-derived, and not held out.
5. Citation labels are technical and single-reviewer; no legal adjudication.
6. No semantic retrieval, reranking or entailment model.
7. Parser has process limits and network isolation but no filesystem sandbox; no malware scanner.
8. No OCR, authentication, tenancy or deployment.

## 7. Second-pass review

A read-only cross-lane review (NVIDIA-backed reviewer, no repository write access) examined the corrected matcher, snapshot store, tests and the three corrected reports. It reported no material findings and two observations:

1. The phrase "applies only when the query starts with an identifier form" was imprecise, because the regex tolerates up to two leading tokens. The wording was corrected and a regression test now asserts that a mid-sentence identifier question ("which law amended Republic Act No. 1001") is handled lexically, not forced to exact-only.
2. The test count was not independently executable by that reviewer (it had no shell). The reproduction command is recorded in §2; the count above is the actual run at review time.

The second pass confirmed the snapshot mutation-isolation fix and the consistency of the authorization claims. No new defect was found.

## 8. Review conclusion

The safe Gate 3 engineering work is reproducible and the corrected artifacts match their evidence. The project may proceed **only** with authorization closure and corpus-expansion preparation. It may not ingest additional documents, publish a corpus, redistribute source text, or present lexical overlap as semantic or legal support.

**Engineering disposition:** APPROVE WITH CORRECTIONS.
**Gate 3 disposition:** BLOCKED on external counsel authorization.
