# DECISION — Gate 12

**Date:** 2026-11-15
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

**Authorization is no longer assumed.** `projectAuthorityState` handles all three
authorization decisions explicitly:

| Decision       | Result                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| `AUTHORIZED`   | projection proceeds (unchanged)                                                    |
| `UNAUTHORIZED` | outcome `UNAUTHORIZED`, missing `NOT_AUTHORIZED` (unchanged)                       |
| `NOT_CHECKED`  | outcome `UNKNOWN`, state `UNKNOWN`, missing `AUTHORIZATION_NOT_CHECKED`, abstained |

Before this gate `NOT_CHECKED` fell through every guard and behaved exactly like
`AUTHORIZED`, which meant the citation verifier could report temporal validity as
passing for a document whose processing nobody had authorized — the honest state
of all 350 cells in this repository.

**Assertions are gated by source, not only by target.** An assertion carries the
source document that claims the effect. Any candidate whose source is not
`AUTHORIZED` is excluded and recorded (`SOURCE_NOT_AUTHORIZED:<id>` /
`SOURCE_AUTHORIZATION_NOT_CHECKED:<id>`), its exclusion is carried in `missing`
even when a determination is still possible from the survivors, and if nothing
survives the answer is `UNKNOWN`. Supersession is resolved before gating, so an
unauthorized superseding assertion suppresses what it supersedes instead of being
discarded and leaving stale state in force.

**Any unrecognised decision fails closed.** A scalar from JSON or a D1 column with
different casing, a resolver returning `undefined`, an empty string or a boxed
`String` are all treated as `NOT_CHECKED`. Resolver decisions are memoised per
source document so one projection cannot authorize and refuse the same source.

**One behaviour change was required in the tests.** `authority-core`'s helper
defaulted to `NOT_CHECKED` and asserted determined outcomes; it now states
`AUTHORIZED` explicitly, and a separate `projectUnchecked()` test keeps the
`NOT_CHECKED` regression net inside the core suite. No assertion was weakened.

## 2. Evidence

| Check                | Result                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| Full suite           | **642 tests — 633 pass, 0 failures, 9 skipped** (65 files: 63 passed, 2 skipped) |
| Gate 12 tests        | 23 (19 projection, 4 bridge/verifier)                                            |
| Build (`pnpm build`) | exit 0                                                                           |
| Biome                | exit 0, 0 errors                                                                 |
| Independent review   | 1 pass (cross-lane), 4 findings: 3 fixed, 1 accepted as a limitation             |
| Migrations           | `0001`–`0009` unmodified                                                         |

The verifier itself was not changed: layer 4 already required
`DETERMINED_WITH_REVIEWED_EVIDENCE` + operative state + no abstention + no
`VERSION_NOT_IN_EFFECT`, so a `NOT_CHECKED` projection already failed it. That is
proven end to end by `gate12-bridge-auth.test.ts` rather than argued.

## 3. Why ACCEPTED WITH LIMITATIONS

Two limitations are material to legal use, and neither is closed here:

1. **Authorization is per document, not per activity.** The projection is told
   "this document is authorized", not "authorized for `search_indexing` but not
   for `persistent_storage`". A caller can pass `AUTHORIZED` on the strength of
   the wrong activity and nothing in the projection can detect it. The 14-activity
   matrix remains enforced only by the ingestion-side registry, not at projection
   time.
2. **The projection trusts its snapshot.** It will not authorize assertions a
   caller should not hold, but it does not re-validate where the snapshot's rows
   came from.

Neither is a fail-open of the kind this gate removed — both require the caller to
have already misreported a decision — but both are real, so the verdict is
qualified rather than clean.

## 4. Limitations carried forward

1. Coarse authorization granularity (above).
2. D1 remains shim-validated; no remote D1 or workerd run.
3. Two similarly named exported authorization types exist in the package barrel
   (`ProjectionAuthorizationDecision`, `AuthorizationDecision`); renaming is a
   broader API change than this gate should carry.
4. No lifecycle-transition record type; `state`/`reviewStatus`/`status`/
   `availability` remain immutable in place.
5. Support verification is still the lexical proxy.
6. No real corpus, no counsel determination.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorisation cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was deployed or pushed.

## 6. Next action

The remaining gap that matters most for a real ingest is the coarse authorization
model: the projection needs the `(document, activity)` decision, and the
ingestion-side registry already holds that matrix, so wiring the registry into the
authorization input is the natural next card. It can be built and tested
synthetically without touching any real document, and it stops a caller from
authorizing the wrong activity. The corpus-readiness gate still waits on a genuine
counsel determination.
