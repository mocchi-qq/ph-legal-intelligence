# 02 — Test and Verification Results

**Date:** 2026-11-15
**Baseline:** `381ebe4` (Gate 9), 575 tests — 565 pass, 1 pre-existing fail, 9 skip.
**Final:** 598 tests — 588 pass, 1 pre-existing fail, 9 skip.

| Check         | Result                                                      |
| ------------- | ----------------------------------------------------------- |
| Gate 10 tests | 10 (5 verifier, 5 D1 store)                                 |
| Full suite    | **585 tests — 575 pass, 1 pre-existing failure, 9 skipped** |
| Test files    | 61 (58 passed, 1 failed, 2 skipped)                         |
| Build         | exit 0                                                      |
| Biome         | 0 errors                                                    |

The only failure is the pre-existing `tests/unit/docs-structure.test.ts`
(missing `docs/product` etc. at HEAD).

## What the tests prove

**Verifier**

- a confirmed, `IN_FORCE` projection passes layer 4 and records
  `temporalSource: "authority_projection"` + the status;
- `PARTIALLY_DETERMINED`, `REPEALED`, and `UNAUTHORIZED` all fail layer 4;
- without a callback the existing field-based path runs and is labelled
  `legacy_fields`; a repealed document with no repeal date fails it;
- the bridge maps provision-version → provision-identity, and a revoked review
  flips an end-to-end verification from pass to fail.

**D1 store (SQLite shim)**

- identity, assertion, evidence and review round-trip with all fields;
- `loadStateFor` reconstructs a snapshot that projects
  `PARTIALLY_AMENDED` / `DETERMINED_WITH_REVIEWED_EVIDENCE` at the as-of date;
- unknown document returns an empty snapshot;
- duplicate assertion maps to `duplicate_authority_record`;
- raw `UPDATE` on the append-only table is rejected.

## What is not proven

- Real D1 runtime (HTTP or workerd); only `node:sqlite` compatibility.
- Multi-document scope/conflict handling inside one verification call.
- Real legal effect; the authority state is synthetic.
- Any real corpus, counsel determination or authorization change.
