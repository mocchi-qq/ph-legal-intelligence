# Gate 5 — Test and Regression Report

**Date:** 2026-11-13
**Scope:** synthetic counsel fixtures, provenance, projection, enforcement, migration and Gate 1–4 regression

## 1. Commands and results

| Command                                   | Result                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `npx vitest run`                          | **348 passed, 1 skipped** (40 files, 349 tests)                  |
| `pnpm build`                              | exit 0                                                           |
| `npx biome check .`                       | exit 0; 0 errors, 68 warnings (pre-existing non-null assertions) |
| `tests/benchmark/gate2-benchmark.test.ts` | 3 passed; Gate 1 hash pin intact                                 |
| Pilot SHA-256 recomputation               | all four match `PILOT_MANIFEST.json`                             |

Skipped test: the Gate 2 live pilot, which requires `PH_LIVE_PILOT=1` and network access. It was **not** run and is not claimed as passing.

## 2. Gate 5 tests added (33)

| File                                              | Tests | Covers                                                                                                                                                        |
| ------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/legal-data/counsel-determinations.test.ts` |    22 | source/activity/document scope, identity, evidence, conditions, dates, supersession, revocation, conflicts, duplicates, immutable history, projection, denial |
| `tests/integration/gate5-migration.test.ts`       |     7 | additive schema, 16 activities, statuses, evidence CHECKs, uniqueness, FKs, append-only triggers                                                              |
| `tests/legal-data/gate5-status.test.ts`           |     4 | zero counsel, 350 UNKNOWN, corpus blocked, no persistence overclaim                                                                                           |

## 3. Key negative assertions

- A synthetic determination for `synthetic_counsel_source` does not authorize `sc_elibrary`.
- A determination for downloading does not authorize storage.
- A document-scoped determination denies another document and requires a document ID.
- An unverified counsel identity cannot produce a `VERIFIED_FOR_RECORDING` determination.
- Incomplete evidence, missing decision document, invalid hash and duplicate IDs are rejected before mutation.
- A determination with no activity decision for an activity does not authorize it.
- A superseded determination no longer projects.
- A revoked determination no longer projects, and the projection sync overrides a prior Gate 4 authorization with `PROHIBITED`.
- Conflicting active determinations fail closed.
- An unverified determination cannot be projected into Gate 4.
- A strict ingestion with no projected decisions fails.
- All 350 real authorization cells remain `UNKNOWN`; no test fixture changes them.

## 4. Synthetic-only assurance

All counsel identities, sources, evidence references and decision documents used in tests are synthetic and labelled as such (for example `synthetic://counsel/verification-1`). No test creates a real-world counsel approval, no test writes to `authorization-decisions.json`, and no test changes a real source registry status.

## 5. Unchanged baselines

- Gate 1 benchmark hash: `7fca3b67a347f634f6b88d274804d5d17662d6ea837c425f5f55a83030bfb0a5`.
- Pilot hashes: `00b4c367…863dd` (RA 12232), `dc991d2b…c379a` (RA 10931), `06cd3edc…ee936` (RA 12326), `ca45d318…163da` (RA 12325).
- No new real document was acquired, downloaded, ingested, OCR-processed, embedded or indexed.
- No integration review was skipped or reported as passing.

## 6. Limitations of the test evidence

- The D1 adapter and live database transactions are not tested because no adapter exists.
- Temporary local storage, reindexing, display, quotation, reproduction, redistribution and retention have no runtime gate to test; the gap is disclosed in `06_AUTHORIZATION_LIFECYCLE_AUDIT.md`.
- The skipped live pilot requires external network access and real-source authorization that Gate 5 does not have.
