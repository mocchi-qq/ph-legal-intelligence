# 02 — Test and Verification Results

**Date:** 2026-11-14
**Baseline:** `8d56e58` (Gate 8), 558 tests — 548 pass, 1 pre-existing fail, 9 skip.
**Final:** 575 tests — 565 pass, 1 pre-existing fail, 9 skip.
**Gate 9 evidence level:** synthetic unit/integration only.

## 1. Results

| Check                    | Result                                                     |
| ------------------------ | ---------------------------------------------------------- |
| Gate 9 tests             | 9 in `tests/retrieval/gate9-passage.test.ts`               |
| Full suite               | **567 tests, 557 pass, 1 pre-existing failure, 9 skipped** |
| Test files               | 59 (56 passed, 1 failed, 2 skipped)                        |
| Build                    | exit 0                                                     |
| Biome                    | 0 errors, 82 warnings                                      |
| Existing retrieval suite | 22 tests pass unchanged                                    |
| Authorization/regression | Gate 1–8 suites unchanged and green                        |

The only failure is the pre-existing `tests/unit/docs-structure.test.ts`
(missing `docs/product`, `docs/data-governance`, `docs/retrieval`, `docs/api` at
HEAD). Not caused by Gate 9.

## 2. What the Gate 9 tests prove

- exact `G.R. No. 999001` returns the document at rank 1 with `exactMatch: true`;
- an identifier miss (`RA 99999`) returns `[]`, not neighbours;
- `versionId`, `provisionId`, `effectiveFrom/To`, `provenance` and `citationText`
  are populated from the indexed version/document/chunk;
- `span` equals the source chunk's `charStart/charEnd` (or `null`);
- `asOfDate` excludes the document one day before the version's `effectiveFrom`
  and includes it on the boundary;
- `toCitationInput` preserves document, chunk, location and proposition;
- the adapted input reaches the existing verifier and passes identity + location,
  with support supplied by a reviewed synthetic annotation (`technical_annotation`),
  not manufactured by the lexical proxy;
- 400 retrieves (200 exact + 200 natural-language) complete in **~85 ms** on the
  synthetic fixture index (≈0.2 ms/call); the test asserts only a 5 s ceiling.
- span slicing is asserted directly: `text.slice(seed.startOffset, seed.endOffset)
  === seed.text` for every provision seed.

## 3. What is not proven

- Real Philippine retrieval quality (synthetic fixtures only).
- Semantic/vector recall (not implemented by design).
- Authority projection inside the verifier (Gate 8 limitation; not changed).
- D1/workerd behaviour (search is in-memory).
- That a retrieved passage legally supports a proposition; only that the
  verifier can consume it and that a reviewed annotation is distinguishable from
  the lexical proxy.

## 4. Regression invariants

- 0 counsel determinations; 350 authorization cells `UNKNOWN`; four pilot
  documents `BLOCKED_AUTHORIZATION`.
- No real document acquired or processed.
- Gate 1 benchmark pin, Gate 6 reindex authorization, Gate 8 authority tests all
  still pass.
