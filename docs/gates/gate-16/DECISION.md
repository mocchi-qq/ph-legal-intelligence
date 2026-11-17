# DECISION — Gate 16

**Date:** 2026-11-17
**Baseline:** `53f6db5` (Gate 15, ACCEPTED WITH LIMITATIONS)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

**The seam between ingestion and verification is closed.** `recordEffectClaim`
turns an ingested corpus plus an analyst's claim into the ledger records a
projection and verifier actually consume, and the chain test proves it: ingest two
synthetic documents, record a claim read from a real chunk, persist exactly the
returned records, verify — with no hand-built assertion or evidence anywhere in
between.

**The intake refuses rather than guesses.** Seventeen refusal reasons, all tested,
covering the cases where a claim cannot be pinned to bytes: unknown documents,
versions, chunks and provisions, a provision the chunk does not carry, malformed
spans, invalid effect types, missing scope or analyst, bad dates, a corrupt content
hash, and an ambiguous provision label. Runtime junk fails closed rather than
throwing.

**It cannot manufacture a determination.** The assertion is `UNREVIEWED` and the
module never writes a review. The chain test verifies first _without_ a review and
gets `PARTIALLY_DETERMINED`; only after a separate, explicit review call does the
citation verify.

**Id derivation is deterministic and claim-scoped.** Evidence ids are unique per
claim, so two claims read from one passage can both be recorded; assertion ids are
stable for identical input, so replays are idempotent. The cycle and its trade-offs
are written in the source rather than left implicit.

## 2. Evidence

| Check                                  | Result                                                            |
| -------------------------------------- | ----------------------------------------------------------------- |
| Full suite                             | **777 tests — 768 pass, 0 failures, 9 skipped**                   |
| Gate 16 tests                          | 54 (46 intake, 8 chain)                                           |
| Build                                  | exit 0                                                            |
| Biome                                  | exit 0, 0 errors                                                  |
| Independent review                     | 1 pass, 8 findings: 5 fixed, 1 clarified with a new test, 2 clean |
| Production module changed after review | 4 new refusals, no relaxation                                     |

## 3. Why ACCEPTED WITH LIMITATIONS

What remains is not in the intake:

1. **The canonical corpus tables have no production writer.** Ingestion populates
   the corpus store; the D1 tables for documents, versions and provisions are still
   filled by a test-local copy in any end-to-end test. The authority tables are fed
   by the intake, so the seam this gate targeted is closed — but the corpus→D1 edge
   is not, and a real ingest would need it.
2. **No review can be produced by any automated path** — deliberately. That means
   the chain only verifies once a person records a determination, which is correct
   and also means the platform's happy path is legally gated, not just technically
   gated.
3. **Read-time authorization and the `synthetic` ingestion exemption** remain open
   from Gates 14 and 15 (backlog B-2, B-3).

## 4. On the review

One finding was answered rather than fixed: a reviewer read the id scheme as leaving
evidence with nothing to bind to. It binds to the same assertion, which is the
intended model of one claim with several evidentiary bases; a test now proves both
evidence rows persist against one assertion. Changing the scheme to satisfy the
reading would have split one claim into several, which is a worse answer.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Next action

**Backlog B-4: the corpus → canonical D1 writer**, so a real ingest lands in the
same tables the projection reads from rather than in a test-local copy. After that,
corpus readiness is genuinely a legal question and nothing else: a counsel
determination for one source, its four ingestion activities, and one bounded sample.
