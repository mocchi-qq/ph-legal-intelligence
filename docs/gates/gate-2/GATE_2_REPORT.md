# Gate 2 Report — Real-Source Authorization, Acquisition, Parsing, Retrieval

**Date:** 2026-11-10
**Engineering baseline:** Gate 1 accepted with limitations
**Real corpus:** 4 official documents, **owner-authorized internal pilot only**

---

## A. Executive verdict

**ACCEPTED WITH LIMITATIONS.**

Under the project owner's explicit authorization (`01A_OWNER_AUTHORIZATION.md`), a bounded four-document pilot was acquired from the Supreme Court E-Library, preserved locally, parsed, and used to validate identity, amendment evidence, retrieval and citation mechanics on real legal text.

This is **not** legal authorization and not a general corpus. No source status changed: all 25 sources remain `UNKNOWN`/`NOT_REVIEWED`, no Philippine counsel sign-off exists, originals are not redistributed, and bulk ingestion remains unauthorized.

## B. Scope completed

| Area                                                | State                                   | Evidence                                                   |
| --------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Baseline + Gate 1 regression                        | Complete                                | `00_BASELINE.md`; 198 tests at baseline                    |
| Source authorization review                         | Complete; nothing legally approved      | `01_SOURCE_AUTHORIZATION.md`; 25 × `UNKNOWN` unchanged     |
| Owner authorization                                 | Recorded                                | `01A_OWNER_AUTHORIZATION.md`; risk acceptance, not counsel |
| Acquisition manifest + gate                         | Implemented, tested                     | `02_ACQUISITION_AND_PROVENANCE.md`; 14 tests               |
| Guarded transport (DNS SSRF, redirects, truncation) | Implemented, tested                     | `transport.ts`; 10 tests                                   |
| Real acquisition                                    | **4 official RA pages**                 | `PILOT_MANIFEST.json`; HTTP 200, hashes recorded           |
| PDF inspection + native extraction                  | Implemented; synthetic PDF tested       | `03_PDF_PARSING_AND_OCR.md`; 11 tests                      |
| OCR                                                 | **UNAVAILABLE** (no engine)             | `NO_OCR_PROVIDER` throws; no confidence recorded           |
| Legal identity + structure                          | Implemented; real texts parsed          | `04_LEGAL_IDENTITY_AND_STRUCTURE.md`; 10 tests             |
| Amendment evidence                                  | Applied from document text              | 2/2 edges with quoted evidence                             |
| Retrieval                                           | Real exact + NL checks                  | `05_RETRIEVAL_AND_RERANKING.md`                            |
| Semantic retrieval / reranking                      | **NOT IMPLEMENTED**                     | no model selected or downloaded                            |
| Citation support classes                            | Implemented; one real citation verified | `06_CITATION_AND_SEMANTIC_SUPPORT.md`                      |
| Security/grounding                                  | Complete (bounded)                      | `07_SECURITY_AND_GROUNDING.md`                             |
| Benchmark separation                                | Complete                                | `08_BENCHMARK_METHODOLOGY.md`                              |
| Independent review                                  | Pending second pass for pilot           | `09_INDEPENDENT_REVIEW.md`                                 |

## C. Evidence

- Suite: `npx vitest run` → 27 files passing, 253 tests; 1 live pilot test skipped unless `PH_LIVE_PILOT=1`.
- Build: `pnpm build` → exit 0. Lint: `npx @biomejs/biome check .` → 0 errors.
- Migrations 0001–0003 applied to `node:sqlite`; `authorization_basis` CHECK enforced.
- Gate 1 benchmark JSON SHA-256 `7fca3b67…b0a5`, unchanged and pinned by test.
- Pilot: `docs/gates/gate-2/PILOT_MANIFEST.json`, `PILOT_RESULTS.json`.
- Original pilot files: `legal-data/pilot/` (git-ignored, local only).

## D. Benchmark comparison

| Dataset                          | Status                 | Results                                                                                            |
| -------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| Gate 1 synthetic regression      | Preserved, re-verified | exact 4/4; Recall@5 8/8; Recall@10 8/8; passage 3/3; citation layers 10/10                         |
| Gate 2 synthetic PDF             | Executed               | 1 page, native text, status OK                                                                     |
| Gate 2 owner-authorized pilot    | Executed (4 docs)      | exact identifier 1/1; nonexistent 0; NL returned 5; citation VERIFIED (4/4 layers, `LEXICAL_ONLY`) |
| Gate 2 legally-authorized corpus | **BLOCKED**            | 0 documents; no counsel sign-off                                                                   |
| Semantic retrieval / reranking   | **NOT IMPLEMENTED**    | no metrics                                                                                         |
| OCR                              | **UNAVAILABLE**        | 0 pages processed                                                                                  |

Datasets are never merged. The pilot is not a legal-corpus benchmark.

## E. Limitations

1. Four documents only; no recall/precision/latency benchmark on a real corpus.
2. No legal reuse determination; owner risk acceptance only. Counsel sign-off outstanding.
3. No OCR, so scanned PDFs are unsupported.
4. No semantic retrieval or reranking.
5. Support remains a lexical proxy unless a reviewed annotation is supplied.
6. Structure parsing needed a `SEC.` fix for this source; other source-specific heading styles may still collapse.
7. Tables, footnotes, annexes and schedules are not structurally preserved.
8. No authentication, tenancy, malware scanning, rate limiting or deployment.
9. No qualified Philippine legal review of any output.
10. Pilot originals are not redistributed and must be deleted if counsel restricts the use.

## F. Security assessment

Tested: authorization gate, source mismatch, unsafe URL, DNS-private and redirect-to-private rejection, truncation, MIME/size/empty-body limits, filename and storage-key traversal, corrupt PDF rejection, byte preservation, instruction-like text handling, unverified-citation exclusion.

Resolved: G2-S5 DNS-level SSRF gap is now implemented and tested. Remaining: Poppler process is un-sandboxed (timeout/size/temp mitigations); support is lexical without annotation; no TLS pinning or malware scanning. No critical unresolved finding; no production-security or DPA-compliance claim.

## G. Independent review

A first Gate 2 review approved the engineering (26 files / 241 tests) with six minor findings, all fixed. The guarded transport, owner authorization and real pilot were added afterwards and require a second independent pass; `09_INDEPENDENT_REVIEW.md` will carry that verdict once issued. The gate is not final until that pass completes.

## H. Production readiness

**Research prototype.** No authenticated product, no tenancy, no OCR, no semantic retrieval, and no legally authorized corpus.

## I. Next-gate recommendation

1. Obtain counsel determination for the four pilot documents and one Tier 1 source, naming acquisition, storage, indexing, display and redistribution rights.
2. Expand the pilot to 20–50 **counsel-authorized** documents across statutes, an IRR and decisions.
3. Validate extraction against the printed source and build a real-corpus retrieval/citation benchmark with pre-declared thresholds.
4. Add OCR only if scanned documents are authorized and a CPU-feasible engine is selected.
5. Do not begin bulk ingestion or public coverage claims.

Gate 2 acceptance does **not** authorize bulk ingestion, redistribution, deployment, or public coverage claims.
