# 00 — Executive Summary

**Gate 13 — Document-Activity Authorization and End-to-End Enforcement**
**Date:** 2026-11-15
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## The one sentence

Authorization is no longer a property of a document: every projection now names the
activity it performs, resolves every document it depends on for that activity, and
refuses when it cannot get an answer.

## What was wrong

Gate 12 closed the fail-open where "not checked" counted as "authorized". It left the
decision document-level: a caller said "this document may be used" and the
projection applied it to whatever it was doing. The 14-activity matrix — the real
Gate 4 source of truth — was consulted by ingestion and never by authority
projection or citation verification. A document authorized for `viewing` could be
projected as if authorized for `search_indexing`, and an effect assertion from an
unauthorized source could ground a determination about an authorized target.

## What changed

| Piece        | Change                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract     | `(documentId, activity, role) → DocumentActivityDecision`, backed by the existing `ActivityAuthorizationRegistry`; no second list, no second cache                                    |
| Projection   | `activity` required; target, every effect source, every evidence document resolved for that same activity; exclusions recorded in `missing`                                           |
| Caller input | the bare `"AUTHORIZED"` string is gone; a caller asserts `{ activity, decision }` and is refused if the activity differs — the activity gate cannot be bypassed by a caller assertion |
| Trace        | one entry per (document, activity, role), one resolution per (document, activity), no forged registry identity                                                                        |
| Clock        | expiry is evaluated against the request's as-of instant, so a projection replays identically                                                                                          |
| Verifier     | layer 4's four-condition predicate untouched; the activity-aware result is consumed, and `authorizationSource` says whether it was registry-verified                                  |

## Evidence

- **695 tests — 686 pass, 0 failed, 9 skipped**; 53 new Gate 13 tests.
- Build exit 0; Biome exit 0.
- 3 independent reviews — 13 findings (1 HIGH, 4 MEDIUM, 8 LOW), all closed — then
  a separate remediation verification that closed 2 further LOW findings. No
  CRITICAL or HIGH finding remains open.
- Gate 12's protections are preserved: `NOT_CHECKED` still fails closed,
  supersession still precedes gating, memoisation is retained and extended, and
  `projectUnchecked()` still guards the invariant.

## Why "with limitations" rather than "accepted"

Three boundaries remain and none is hidden:

1. **A caller can still assert a decision.** It must now name its activity and is
   labelled `caller_asserted`, but nothing forces a deployment to use the registry.
2. **`buildSearchIndex` still takes an arbitrary `authorize` callback** that need
   not consult the registry — a pre-existing weaker gate, deliberately not rewritten
   here.
3. **No authorization cell is authorized.** All 350 remain `UNKNOWN`. This gate
   proves the refusal, never the permission.

## Boundaries

No real Philippine legal document was acquired, read, extracted, indexed or
processed. Counsel determinations remain **0**. All **350** cells remain `UNKNOWN`.
The four pilot documents remain `BLOCKED_AUTHORIZATION`. No migration changed.
Nothing was pushed or deployed.

## Next

Corpus readiness — which needs a genuine counsel determination for one source and
one activity, not more engineering. See `15_NEXT_GATE_RECOMMENDATION.md`.
