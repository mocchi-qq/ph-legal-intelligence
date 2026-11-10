# Gate 2 Report — Real-Source Authorization, Acquisition, Parsing, Retrieval

**Date:** 2026-11-10
**Engineering baseline:** Gate 1 accepted with limitations
**Real corpus:** 0 documents

---

## A. Executive verdict

**BLOCKED.**

Gate 2's primary objective — a small, authorized, real Philippine legal pilot corpus — cannot be attempted. No source has a written reuse determination and there is no Philippine counsel sign-off. Public accessibility is not permission, and the project's own rules prohibit acquisition without authorization.

The engineering work that does not require unauthorized material was completed and independently approved: acquisition authorization gate and guards, PDF inspection/extraction, legal identifier resolution, citation support classification, and benchmark separation. **None of it validates real-source accuracy.**

## B. Scope completed

| Area                                      | State                                | Evidence                                               |
| ----------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| Baseline + Gate 1 regression              | Complete                             | `00_BASELINE.md`; 198 tests at baseline, 243 now       |
| Source authorization review               | Complete; nothing approved           | `01_SOURCE_AUTHORIZATION.md`; 25 × `UNKNOWN` unchanged |
| Acquisition manifest + authorization gate | Implemented, tested                  | `02_ACQUISITION_AND_PROVENANCE.md`; 14 tests           |
| URL/path/SSRF guards                      | Implemented, tested                  | same; localhost, metadata IP, traversal                |
| PDF inspection + native extraction        | Implemented, tested on synthetic PDF | `03_PDF_PARSING_AND_OCR.md`; 11 tests                  |
| OCR                                       | **UNAVAILABLE** (no engine)          | `NO_OCR_PROVIDER` throws; no confidence recorded       |
| Legal identity + outline parsing          | Implemented, tested                  | `04_LEGAL_IDENTITY_AND_STRUCTURE.md`; 10 tests         |
| Semantic retrieval / reranking            | **NOT IMPLEMENTED**                  | no model selected or downloaded                        |
| Citation support classes                  | Implemented, tested                  | `06_CITATION_AND_SEMANTIC_SUPPORT.md`; 7 tests         |
| Security/grounding review                 | Complete (bounded)                   | `07_SECURITY_AND_GROUNDING.md`                         |
| Benchmark separation                      | Complete                             | `08_BENCHMARK_METHODOLOGY.md`; Gate 1 hash pinned      |
| Independent review                        | Approved (engineering)               | `09_INDEPENDENT_REVIEW.md`                             |

## C. Evidence

- Source files: `packages/legal-ingestion/src/{acquisition,guards,identity}.ts`, `packages/document-parser/src/pdf.ts`, `packages/citation-engine/src/verifier.ts`.
- Tests: `tests/legal-data/*.test.ts`, `tests/citations/support-class.test.ts`, `tests/benchmark/gate2-benchmark.test.ts`.
- Suite: `npx vitest run` → 26 files, 243 tests passing.
- Build: `pnpm build` → exit 0. Lint: `npx @biomejs/biome check .` → 0 errors.
- Migrations: 0001+0002 applied to `node:sqlite` → 10 tables, enum checks enforced.
- Gate 1 results: SHA-256 `7fca3b67a347f634f6b88d274804d5d17662d6ea837c425f5f55a83030bfb0a5`, unchanged.
- Authorization: `legal-data/source-registry/sources.authorization.json` — 25 sources, all `UNKNOWN`.
- Real corpus: `REAL_CORPUS_MANIFEST.json` — 0 documents, 0 acquisition attempts.

## D. Benchmark comparison

| Dataset                           | Status                 | Results                                                                         |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Gate 1 synthetic regression       | Preserved, re-verified | Exact 4/4, Recall@5 8/8, Recall@10 8/8, passage 3/3, citation layers 10/10 each |
| Gate 2 PDF parser (synthetic PDF) | Executed               | 1 page, native text, status OK                                                  |
| Gate 2 real-source pilot          | **BLOCKED**            | 0 documents; `metrics: null`                                                    |
| Semantic retrieval                | **NOT IMPLEMENTED**    | no metrics                                                                      |
| Reranking                         | **NOT IMPLEMENTED**    | no metrics                                                                      |
| OCR                               | **UNAVAILABLE**        | 0 pages processed                                                               |

Synthetic and real datasets are not merged.

## E. Limitations

1. No real legal document was acquired; no real-document identity, extraction, retrieval or citation was validated.
2. No source is authorized; no counsel sign-off exists.
3. OCR is unavailable on this host.
4. Semantic retrieval and reranking are not implemented.
5. Support remains a lexical proxy unless a reviewed annotation is supplied; no semantic entailment.
6. PDF page→chunk mapping, tables, footnotes and annexes are not structurally preserved.
7. No authentication, tenancy, rate limiting, malware scanning or deployment.
8. SSRF guard is hostname-textual; DNS resolution and post-redirect checks are required before any connector.
9. No qualified Philippine legal review of any output.

## F. Security assessment

Tested: authorization gate, source mismatch, empty artifact, URL scheme/credentials/port, private and metadata hosts, filename traversal, storage-key traversal, oversized/non-PDF/corrupt PDF rejection, byte preservation, instruction-like text handling, unverified-citation exclusion.

Findings: G2-S1 Poppler process is un-sandboxed (timeout/size/temp-file mitigations); G2-S2 support is lexical without annotation; G2-S3 no transport so redirect/truncation unverified; G2-S5 SSRF guard lacks DNS-level checks. No critical unresolved finding; no production-security or DPA-compliance claim.

## G. Independent review

Lane B reviewer, 2026-11-10, reproduced the suite, build, lint, migrations and Gate 1 hash. Verdict **APPROVE (engineering) / BLOCKED (real acquisition)**. Six minor findings — two test-count slips, one untested doc row, a dead ternary, a latent SSRF gap and a G.R. false-positive risk — were corrected or documented. No unsupported status claim was found.

## H. Production readiness

**Research prototype.** Not a controlled pilot, beta candidate or production system. There is no authorized corpus, no authentication, no OCR and no semantic retrieval.

## I. Next-gate recommendation

The smallest defensible next stage is **authorization, not more engineering**:

1. Obtain a written counsel determination for one Tier 1 source, naming acquisition, storage, indexing, passage display and redistribution rights.
2. Add DNS-resolving, post-redirect SSRF checks and a transport with retries and truncation detection.
3. Acquire 5–10 authorized documents, preserve hashes, and validate PDF extraction against the printed source.
4. Only then attempt the 20–50 document pilot and a real-corpus retrieval/citation benchmark.

Gate 2 acceptance does **not** authorize bulk ingestion, production deployment, or public coverage claims.
