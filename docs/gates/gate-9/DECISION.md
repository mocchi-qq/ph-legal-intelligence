# DECISION — Gate 9

**Date:** 2026-11-14
**Verdict:** **ACCEPTED** — retrieval-contract gate only.
**Scope:** passage-level retrieval contract, exact bypass, point-in-time
selection, verifier hand-off. Synthetic only.

## 1. What was accepted

- `SearchResult` now exposes `versionId`, `provisionId`, `effectiveFrom`,
  `effectiveTo`, `span`, `provenance`, `citationText` and `exactMatch`.
- Exact identifier queries (including party-name + docket) return only the matched
  document, or `[]`; embedded questions still retrieve lexically.
- `asOfDate` selects versions by `[effectiveFrom, effectiveTo)`; an unknown start
  is excluded, an open end is treated as current.
- Passage spans now slice the passage exactly; the ingestion offset defect found
  in review was fixed and tested.
- `toCitationInput` produces a verifier input that passes identity/location, and
  the test proves a fabricated proposition fails support while a passage-against-
  itself proposition passes only through the lexical proxy.

## 2. Evidence

- Gate 9 tests: 16, all pass.
- Full suite: **575 tests, 565 pass, 1 pre-existing failure, 9 skip**.
- Build exit 0; Biome 0 errors.
- One independent review; both blockers (span provenance, fuzzy-neighbour leak)
  fixed; majors documented or fixed. See `03_INDEPENDENT_REVIEW.md`.

## 3. Why not "accepted with limitations"

The gate's own criteria are met. The remaining items are explicitly out of scope
or pre-existing:

- `exactMatch` is document-level, documented, and not used as a pinpoint claim.
- `versionId` can be `""` for an unversioned chunk; documented.
- Verifier layer 4 remains unwired (Gate 8 limitation).
- `filters.topic`/null-court gaps are pre-existing and listed as follow-ups.

No blocker, no new security or integrity regression, no corpus or authorization
change.

## 4. Boundary

No real legal document was acquired or processed. Counsel determinations remain
**0**, all **350** authorization cells remain `UNKNOWN`, and the four pilot
documents remain `BLOCKED_AUTHORIZATION`. No deployment or push.

## 5. Next action

The next useful engineering step is the Gate 8 carry-over: wire citation-verifier
layer 4 to the authority projection and add a D1 writer adapter, before any
broader retrieval or UI work. The legal blocker remains with counsel.
