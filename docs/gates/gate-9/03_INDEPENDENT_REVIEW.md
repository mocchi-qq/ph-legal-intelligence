# 03 — Independent Review

**Date:** 2026-11-14
**Reviewers:** two read-only passes over the retrieval contract, ranking,
point-in-time selection, span provenance and verifier hand-off.

## 1. Findings and disposition

| ID  | Severity | Finding                                                                                                                                            | Disposition                                                                                                                                                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | BLOCKER  | Published `span` was the provision/heading span, not the passage span; 16/31 fixture chunks mismatched.                                            | **FIXED** — ingestion section offsets now start after the heading and cover the trimmed body; split chunks compute offsets from the sentence position; test asserts `text.slice(span) === passage` on a fixture.                 |
| R2  | BLOCKER  | Full party-name citations ("People v. X, G.R. No. …") bypassed the exact-identifier check and returned fuzzy neighbours for a non-existent docket. | **FIXED** — `isIdentifierQuery` detects typed identifiers anywhere unless the query is a question (`which/what/…`), so party-name citations are exact-only and a miss returns `[]`; embedded questions still retrieve lexically. |
| R3  | MAJOR    | `exactMatch` was described as passage-level but is document-level; rank 1 could be a chunk without the identifier.                                 | **DOCUMENTED** — the flag is now explicitly document-level; identifier-bearing chunks are sorted first, but the flag does not claim the passage contains the identifier.                                                         |
| R4  | MAJOR    | `asOfDate` treated a null `effectiveFrom` as covering any date.                                                                                    | **FIXED** — null start is excluded when a date is supplied; null end remains open-ended for the current version; tests cover both.                                                                                               |
| R5  | MAJOR    | The support test supplied `supportAnnotation: FULL_SUPPORT`, making "does not manufacture support" a tautology.                                    | **FIXED** — the test now asserts a fabricated proposition fails (`NO_SUPPORT`) and a passage-against-itself proposition passes only via the lexical proxy.                                                                       |
| R6  | MINOR    | `toCitationInput` did not default `relevantDate`; docstring over-claimed provenance preservation.                                                  | **FIXED** — defaults to `effectiveFrom`/`asOfDate`; docstring corrected. The helper intentionally carries ids only.                                                                                                              |
| R7  | MINOR    | `citationText` was missing from the contract docs.                                                                                                 | **FIXED** — documented in `01`; it is the field verifier identity depends on.                                                                                                                                                    |
| R8  | MINOR    | "All fields additive; existing callers keep working" was imprecise for constructors.                                                               | **FIXED** — docs now say additive for consumers; constructors must add the fields.                                                                                                                                               |
| R9  | MINOR    | `versionId` can be an empty string when a chunk has no resolvable version.                                                                         | **DOCUMENTED** — not changed; empty string means unresolved.                                                                                                                                                                     |
| R10 | NIT      | Perf test is wall-clock dependent.                                                                                                                 | **ACCEPTED** — generous 5 s ceiling; 400 calls measured at ~85 ms.                                                                                                                                                               |
| R11 | NIT      | Exact hits can score below lexical hits under RRF.                                                                                                 | **DOCUMENTED** — `exactMatch`, not `score`, is the precision signal.                                                                                                                                                             |

## 2. Clean areas verified

- No fuzzy/edit-distance/embedding matching; identifier misses return an empty
  list.
- `asOfDate` uses `[effectiveFrom, effectiveTo)` with no non-covering fallback.
- `span` is copied from the chunk and now slices the passage exactly.
- `toCitationInput` adds no passage text and does not import the verifier; a
  forged cross-document passage fails location.
- Docs do not claim vector retrieval, authority wiring, real corpus or production
  use.

## 3. Residual limitations

1. `exactMatch` is document-level; callers must use `provisionLabel`/`span` for
   pinpoint claims.
2. Chunks without a resolvable version carry `versionId: ""`.
3. Verifier layer 4 remains unwired to the effects ledger (Gate 8 limitation).
4. Retrieval quality is synthetic-only; no real-corpus claim.
5. `filters.topic` and null-court filtering are pre-existing gaps, recorded as
   follow-ups rather than fixed here.
