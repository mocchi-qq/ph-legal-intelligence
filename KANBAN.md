# Kanban Board — Gate 0: Philippine Legal Intelligence Platform

## Backlog

(none)

## In Progress

(none)

## Review

(none)

## Done

All cards verified by executable tests plus a clean build. Evidence: `npx vitest run` → 15 files / 148 tests passing; `pnpm build` → all library packages build and all apps typecheck; `npx @biomejs/biome check .` → exit 0.

| ID     | Title                                           | Owner        | Tier   | Acceptance evidence                                                                 |
| ------ | ----------------------------------------------- | ------------ | ------ | ----------------------------------------------------------------------------------- |
| G0-T1  | Repository initialization & workspace setup     | coder-nvidia | CODE   | `tests/unit/repo-integrity.test.ts` passes; commit c3108d1                          |
| G0-T2  | Scaffold apps & packages                        | coder-gemini | CODE   | `tests/unit/scaffold.test.ts` passes (21); commit 937fa51                           |
| G0-T3  | Documentation hierarchy & ADR templates         | light-nvidia | LIGHT  | `tests/unit/docs-structure.test.ts` passes; 12 ADRs; commit 183a4a9                 |
| G0-T4  | Competitor research documentation               | nim-research | LONG   | `tests/unit/competitor-research.test.ts` passes; commit b5181f7                     |
| G0-T5  | Philippine legal source registry                | nim-research | LONG   | `tests/unit/source-registry.test.ts` passes; 25 sources all Pending; commit 6ebf316 |
| G0-T6  | Legal data model & temporal specification       | coder-nvidia | CODE   | legal-schema + d1-schema tests pass; commit c227c20                                 |
| G0-T7  | Search & retrieval architecture specification   | coder-nvidia | CODE   | `tests/unit/search-spec.test.ts` passes; commit 2b56320                             |
| G0-T8  | Citation verification engine specification      | nim-review   | REASON | `tests/unit/citation-verification.test.ts` passes; commit b88afa1                   |
| G0-T9  | Security, privacy & threat model documentation  | nim-review   | REASON | `tests/unit/security-privacy.test.ts` passes; commit 7e9cbb8                        |
| G0-T10 | Document intelligence & drafting specification  | coder-gemini | CODE   | `tests/unit/document-intelligence.test.ts` passes; commit d5fee33                   |
| G0-T11 | Implementation roadmap & test strategy docs     | light-gemini | LIGHT  | `tests/unit/roadmap-docs.test.ts` passes; commit c5a38ef                            |
| G0-T12 | Benchmark fixtures & evaluation framework       | nim-research | LONG   | `tests/unit/benchmark-fixtures.test.ts` passes; 500 fixtures; commit 3afc0ad        |
| G0-T13 | CI/CD, GitHub config & environment verification | light-nvidia | LIGHT  | `tests/unit/ci-config.test.ts` passes; verify-env.sh OK; commit b7bea6d             |
| G0-T14 | Final Gate 0 integration test & report          | coder-nvidia | CODE   | `tests/integration/gate0.test.ts` passes (20); GATE0_REPORT.md; commit 790475b      |

## Blocked

(none)

## Notes

- Author lanes alternate between NVIDIA (lane A) and OpenCode free tier (lane B) where subagents were available.
- All legal sources remain `acquisition_status: "Pending"` by design — no reuse approval asserted.
- Independent cross-lane review recorded in GATE0_REPORT.md / review section below.

## Review outcome — Gate 0

Independent cross-lane review (lane B, OpenCode) initially returned REQUEST CHANGES on three blocking findings:

1. working-tree/format mismatch against the report;
2. fabricated acquisition-status claims in KNOWN_LIMITATIONS.md;
3. unsupported hallucination statistic and pricing in the competitor research.

All three were fixed and re-verified. Final reviewer verdict: **APPROVE**, with the gate recorded as ACCEPTED WITH LIMITATIONS (source reuse unverified, benchmark content placeholder, ADRs stubbed, no product implementation).

---

# Gate 1 — Legal Data Foundation

**Hard stop honoured:** no real legal material ingested. Corpus is `SYNTHETIC` only. Bulk ingestion `BLOCKED — COUNSEL SIGN-OFF NOT OBTAINED`.

| ID   | Task                                         | Owner           | Status             | Evidence                                                                      |
| ---- | -------------------------------------------- | --------------- | ------------------ | ----------------------------------------------------------------------------- |
| G1-A | Baseline report                              | lead            | VERIFIED           | `docs/gates/gate-1/00_BASELINE_REPORT.md`                                     |
| G1-B | Source authorization matrix + registry       | lead            | VERIFIED           | `SOURCE_AUTHORIZATION_MATRIX.md`, `sources.authorization.json` (25 × UNKNOWN) |
| G1-C | Counsel reuse packet                         | lead            | READY (not sent)   | `01_SOURCE_REUSE_REVIEW.md`; no sign-off                                      |
| G1-D | Migration 0002 (relationships, chunks, runs) | lead            | VERIFIED           | applied to SQLite; enums enforced                                             |
| G1-E | Bounded ingestion                            | lead            | VERIFIED           | 13 tests; 10 runs / 8 docs / 9 versions                                       |
| G1-F | Legal versioning                             | lead            | VERIFIED           | 4/4 amendment, 4/4 repeal, 4/4 historical                                     |
| G1-G | Retrieval                                    | lead            | VERIFIED           | exact 4/4, Recall@5 8/8, Recall@10 8/8                                        |
| G1-H | Citation verification                        | lead            | VERIFIED           | 10/10 each layer                                                              |
| G1-I | Grounding                                    | lead            | VERIFIED           | 6 tests; abstains without verified authority                                  |
| G1-J | Benchmark                                    | lead            | VERIFIED           | `08_benchmark-results.json`                                                   |
| G1-K | Security/privacy review                      | lead            | VERIFIED           | `03_SECURITY_AND_PRIVACY_REVIEW.md`                                           |
| G1-L | Independent review                           | lane B reviewer | VERIFIED (APPROVE) | `09_INDEPENDENT_REVIEW.md` — three passes, final approve at b0d0866           |

### Explicit blockers

- **BLOCKED — COUNSEL SIGN-OFF NOT OBTAINED.** No source may be used for real test or bulk ingestion.
- Semantic retrieval, reranking, OCR and PDF parsing: not implemented.
- Authentication, tenancy and deployment: not implemented.

---

# Gate 2 — Real-Source Authorization, Acquisition, Parsing, Retrieval

**Primary objective BLOCKED:** no source authorization, no counsel sign-off. No real legal document acquired.

| ID   | Task                            | Status                              | Evidence                                                  |
| ---- | ------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| G2-A | Baseline + Gate 1 regression    | VERIFIED                            | `docs/gates/gate-2/00_BASELINE.md`; 198 tests at baseline |
| G2-B | Source authorization review     | VERIFIED (no approval)              | `01_SOURCE_AUTHORIZATION.md`; 25 × UNKNOWN unchanged      |
| G2-C | Acquisition manifest + guards   | VERIFIED                            | `02_ACQUISITION_AND_PROVENANCE.md`; 14 tests              |
| G2-D | PDF inspection/extraction       | VERIFIED (synthetic PDF)            | `03_PDF_PARSING_AND_OCR.md`; 11 tests                     |
| G2-E | OCR                             | BLOCKED (engine absent)             | `NO_OCR_PROVIDER`, `available: false`                     |
| G2-F | Legal identity + structure      | VERIFIED                            | `04_LEGAL_IDENTITY_AND_STRUCTURE.md`; 10 tests            |
| G2-G | Real-corpus retrieval           | PARTIAL (4-doc owner pilot)         | `05_RETRIEVAL_AND_RERANKING.md`; exact 1/1, NL 5 results  |
| G2-H | Semantic retrieval / reranking  | NOT_IMPLEMENTED                     | no model evaluated                                        |
| G2-I | Citation support classification | VERIFIED                            | `06_CITATION_AND_SEMANTIC_SUPPORT.md`; 7 tests            |
| G2-J | Security/grounding              | VERIFIED (bounded)                  | `07_SECURITY_AND_GROUNDING.md`                            |
| G2-K | Benchmark separation            | VERIFIED                            | `08_BENCHMARK_METHODOLOGY.md`; Gate 1 hash pinned         |
| G2-L | Independent review              | VERIFIED (second pass APPROVE)      | `09_INDEPENDENT_REVIEW.md`                                |
| G2-M | Owner authorization + pilot     | VERIFIED (owner basis, not counsel) | `01A_OWNER_AUTHORIZATION.md`, `PILOT_MANIFEST.json`       |
| G2-N | Guarded transport               | VERIFIED                            | `transport.ts`; 11 tests                                  |
