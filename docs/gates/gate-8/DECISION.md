# DECISION — Gate 8

**Date:** 2026-11-14
**Verdict:** **ACCEPTED WITH LIMITATIONS**
**Scope:** synthetic legal authority core, identity, versioning, effects ledger,
projection, temporal queries, citation parsing.

## 1. Why this verdict

The gate delivered the requested architectural core and proved its safety
properties on synthetic data:

- three planes remain separate in types, storage and projection;
- an effect assertion is not a legal conclusion; only a recorded review can
  promote it, within a stated scope;
- a source authorization decision cannot substitute for a legal-effect review,
  and a review cannot grant reuse;
- unreviewed/rejected assertions never project as confirmed;
- conflicts are preserved, not resolved by recency or source count;
- missing evidence or dates fail closed;
- authorization denial overrides any legal state;
- the projection is deterministic and explainable.

Three independent reviews were completed. Both integrity blockers (REPLACE
bypass, revocation no-op) and all citation blockers were fixed and retested.
Full suite: **558 tests, 548 pass, 1 pre-existing failure, 9 skipped**; build
passes; Biome reports no errors.

## 2. Why not ACCEPTED

Four reviewer-identified gaps remain, all recorded rather than hidden:

1. **Mapping review is frozen.** `provision_version_mappings` cannot move from
   `UNREVIEWED` to `REVIEWED` under the current UNIQUE + append-only design.
   Projection does not consume mappings, so current answers are unaffected, but
   provision-continuity claims cannot yet be reviewed operationally.
2. **No D1 ledger adapter and no deterministic ledger IDs.** The schema is
   validated on the SQLite shim; there is no production writer. Ids are
   caller-supplied, so content-level replay idempotency is not implemented.
3. **Citation-verifier layer 4 is not wired** to the authority projection. The
   contract is documented; the existing verifier still reads mutable date/status
   fields. This is the largest functional gap.
4. **The support proxy is negation-blind** and remains a lexical proxy, not
   entailment. It is labelled as such everywhere.

These are noncritical for the synthetic core but prevent full acceptance.

## 3. Acceptance criteria

| Criterion                | Result                                  | Evidence level                                                            |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------- |
| Baseline integrity       | verified                                | HEAD `e948df5`, 456 tests before changes                                  |
| Document identity        | existing + resolver/aliases             | implemented, tested                                                       |
| Provision identity       | implemented                             | synthetic tests (SAME/RENUMBERED/SPLIT/MERGED/DELETED/NEW/UNCERTAIN/NONE) |
| Versioning               | existing model + new append-only tables | tested on shim; existing tables not DB-append-only                        |
| Temporal fields          | separated and validated                 | tests + migration hardening                                               |
| Effects ledger           | implemented                             | assertions/evidence/reviews append-only                                   |
| Review vs authorization  | separate                                | negative tests                                                            |
| Conflict handling        | preserved                               | conflict tests                                                            |
| Evidence                 | traceable, fail-closed                  | ownership + availability tests                                            |
| Projection               | deterministic, explainable, fail-closed | 6 outcomes tested                                                         |
| Unknown states           | preserved                               | tests                                                                     |
| Temporal queries         | implemented                             | boundary/prospective/null tests                                           |
| Citation resolution      | implemented                             | 9-state contract; exact/alias/ambiguous/invalid/unsupported               |
| Four verification layers | separate                                | existing verifier + integrity tests; layer 4 wiring not done              |
| Authorization preserved  | yes                                     | 350 cells `UNKNOWN`; Gate 7 invariants pass                               |
| Migrations               | additive, validated                     | 0009 on `node:sqlite`; no D1 runtime claim                                |
| Synthetic isolation      | yes                                     | `SYNTH-*`, no real corpus                                                 |
| Regression               | pass                                    | 548 pass, 1 pre-existing fail                                             |
| Independent review       | 3 reviews, blockers fixed               | `13`                                                                      |
| Repository/deployment    | clean commit, no push/deploy            | see final report                                                          |

## 4. Boundary

This decision grants no legal permission. Counsel determinations remain **0**;
all **350** authorization cells remain `UNKNOWN`; the four pilot documents remain
`BLOCKED_AUTHORIZATION`. No real legal document was acquired or processed.

A synthetic review is not a counsel determination. A confirmed synthetic effect
does not establish current Philippine law.

## 5. Next action

Gate 9 — passage-level retrieval and search hardening — per
`15_NEXT_GATE_RECOMMENDATION.md`. In parallel, the legal track must obtain genuine
counsel determinations; engineering progress cannot clear that blocker.
