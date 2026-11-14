# 11 — Test and Verification Results

**Date:** 2026-11-14
**Baseline HEAD:** `e948df5` (456 tests, 446 pass, 1 fail, 9 skip).
**Gate 8 evidence level:** synthetic unit/integration + SQLite-compatible schema.
No workerd, no real corpus, no remote production DB.

## 1. Results by layer

| Layer                | What ran                                                  | Result      |
| -------------------- | --------------------------------------------------------- | ----------- |
| Unit/domain (vitest) | authority ledger, projection, temporal, citation resolver | see §2      |
| Regression (vitest)  | full suite, Gates 1–7                                     | see §3      |
| SQL compatibility    | migrations 0001–0009 on `node:sqlite`                     | see §4      |
| Remote D1 HTTP API   | not run for Gate 8                                        | not claimed |
| Workerd binding D1   | not available                                             | not claimed |

## 2. Gate 8 tests

Files: `tests/authority/authority-core.test.ts`, `tests/authority/core.test.ts`,
`tests/authority/temporal.test.ts`, `tests/authority/migration-0009.test.ts`.

Coverage:

- ledger duplicate/validation rules (assertion, evidence, review, mapping);
- review supersession and active-review selection;
- projection: no assertion, unreviewed, confirmed, rejected, conflicted,
  unavailable evidence, unknown effective date, unauthorized, determinism;
- conflicting effective dates across confirmed reviews;
- temporal boundaries (before/at/after), prospective, null date, authorization;
- citation resolution: exact, alias, ambiguous, invalid, unsupported, provision
  context, missing provision;
- migration: tables, triggers, append-only, FK, CHECK, conditional review,
  hash validation.

Exact counts are recorded after the final run in §5.

## 3. Regression

The full suite is run after all changes. Required invariants:

- Gate 1 benchmark hash-pinned output unchanged.
- Gate 2 acquisition/parser controls intact.
- Gate 3/4 authorization enforcement intact.
- Gate 5 counsel records immutable/scoped.
- Gate 6 temp-storage/reindex gates intact.
- Gate 7 D1 adapter tests intact.
- 0 counsel determinations, 350 `UNKNOWN` cells, 4 `BLOCKED_AUTHORIZATION`.

## 4. Migration validation

`0009_authority_core.sql` applies after 0001–0008 on `node:sqlite`; 7 new tables,
14 append-only triggers, 12 indexes. Tested: append-only UPDATE/DELETE, FK,
effect-type CHECK, conditional-review CHECK, hash CHECK.

This is SQL compatibility evidence, not D1 runtime proof.

## 5. Final numbers

From `npx vitest run` after all Gate 8 changes:

- Test files: 58 (55 passed, 1 failed, 2 skipped)
- Tests: 558
- Passed: 548
- Failed: 1 — pre-existing `tests/unit/docs-structure.test.ts` (missing docs directories at HEAD)
- Skipped: 9 — live pilot (1) and env-gated remote D1 (8)

Gate 8 new tests: **102** (456 → 558). Authority suite: **96 across 5 files**;
verifier integrity: **6**.

Performance baseline (synthetic, in-memory, Node 24):
500 assertions on one target; 200 projections in 176.6 ms ≈ **0.88 ms per
projection**. Dataset and environment recorded; this is not a national-scale
claim.

## 6. What is not proven

- Real Philippine legal effect, authenticity or effectivity.
- D1 binding-level behaviour and transactional `batch()`.
- Performance at national-corpus scale.
- That the effect vocabulary matches Philippine counsel's definitions.
- That layer 4 of the citation verifier is wired to the ledger: integration is
  specified in `08`, not implemented (see `14`).
- That a synthetic review represents a real legal determination (it does not).
