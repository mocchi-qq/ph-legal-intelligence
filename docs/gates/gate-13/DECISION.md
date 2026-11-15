# DECISION — Gate 13

**Date:** 2026-11-15
**Baseline:** `e834045` (Gate 12, ACCEPTED WITH LIMITATIONS)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. Verdict reasoning

The core requirement holds: a projection now names the activity it performs, and
every document it depends on — target, effect-assertion sources, evidence — is
resolved for that same activity through the existing Gate 4 registry. The bare
`"AUTHORIZED"` string is gone; a caller assertion must state its activity and is
refused when the activity differs, so wrong-activity substitution is impossible
through the supported interfaces. Three independent reviews plus a separate
remediation verification found no open CRITICAL or HIGH finding.

It is not a clean ACCEPTED because three bounded limitations remain: a caller can
still assert a decision (labelled, but not verified), `buildSearchIndex` still takes
a caller callback that need not consult the registry, and no cell is authorized —
all 350 remain `UNKNOWN`, so the gate proves the refusal and never the permission.

## 2. Acceptance criteria

| Criterion                                         | Implemented     | Test result      | Evidence                                                | Review                 | Remaining limitation                                   |
| ------------------------------------------------- | --------------- | ---------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| Canonical activity taxonomy reused                | yes             | pass             | `02_ACTIVITY_TAXONOMY_RECONCILIATION.md`, `ACTIVITIES`  | A clean                | 8 of 14 have no runtime enforcement point              |
| Document/activity contract explicit and type-safe | yes             | 27 pass          | `03_…CONTRACT.md`, `document-activity-authorization.ts` | A clean; C clean       | none within the interface                              |
| Target authorization exact activity               | yes             | pass             | `05_…ENFORCEMENT.md`, gate13 tests                      | A, B, C clean          | —                                                      |
| Source authorization every effect source          | yes             | pass             | `06_…POLICY.md`, gate13 tests                           | B clean                | —                                                      |
| Evidence authorization separate                   | yes             | pass             | `06_…POLICY.md`, gate13-projection                      | B clean                | only when the evidence names a version in the snapshot |
| Wrong activity cannot authorize another           | yes             | pass             | `gate13-projection` mismatch + contract wrong-activity  | C HIGH closed          | —                                                      |
| Missing decision fails closed                     | yes             | pass             | contract `no_decision_recorded`                         | A clean                | —                                                      |
| Unknown activity fails closed                     | yes             | pass             | contract + projection                                   | A clean                | —                                                      |
| Invalid status fails closed                       | yes             | pass             | contract + `gate12` retained                            | A clean                | —                                                      |
| Supersession ordering preserved                   | yes             | pass             | `07_…ORDER.md`, chain test                              | B MEDIUM closed        | cycles refuse, not resolve                             |
| Resolver deterministic per pair                   | yes             | pass             | memo tests, `asOf` key                                  | A LOW closed           | helper memo must not be shared across instants         |
| Revocation: no stale reuse                        | yes             | pass             | `09_…BEHAVIOR.md` §4                                    | A clean                | no cross-call cache exists                             |
| Verifier consumes activity-aware result           | yes             | 7 pass           | `08_…INTEGRATION.md`, gate13-verifier                   | C clean                | layer 4 predicate unchanged by design                  |
| Abstention reason preserved                       | yes             | pass             | gate13-verifier exact evidence assertion                | C clean                | —                                                      |
| Audit: checked vs unchecked distinguishable       | yes (in-memory) | pass             | `09_…BEHAVIOR.md`                                       | C clean                | not persisted                                          |
| Regression: prior safeguards                      | yes             | 686 pass, 0 fail | `11_TEST_AND_REGRESSION_RESULTS.md`                     | C clean                | two intermittent flakes recorded                       |
| Independent review: no open critical/high         | yes             | —                | `13_INDEPENDENT_REVIEW.md`                              | 3 + 1 remediation pass | one LOW retained by choice (B8)                        |
| Repository state / boundaries                     | yes             | —                | clean tree after commit; no migration change            | —                      | —                                                      |

## 3. Evidence

| Check           | Result                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| Full suite      | **695 tests — 686 pass, 0 fail, 9 skipped** (68 files: 66 passed, 2 skipped) |
| Gate 13 tests   | 53 (27 contract, 19 projection, 7 verifier)                                  |
| Build           | exit 0                                                                       |
| Biome           | exit 0, 0 errors                                                             |
| Type checks     | `legal-ingestion` 0, `citation-engine` 0                                     |
| Migrations      | `0001`–`0009` unmodified; none added                                         |
| D1 verification | SQLite shim only; no remote D1, no workerd run                               |

## 4. What changed, in one line each

- `document-activity-authorization.ts` — typed `(documentId, activity, role)`
  contract over the existing registry, fail-closed mapping, per-request as-of clock.
- `authority-projection.ts` — required activity, scoped caller assertion,
  target/source/evidence gating, per-role trace, deterministic validation order.
- `authority-status-lookup.ts` — activity fixed at construction; mirrors the two
  input forms; refuses to be built without one.
- `citation-engine/types.ts`, `verifier.ts` — `authorizationSource` carried through;
  layer 4 predicate untouched.
- Tests — 53 new; two expected values changed, each only by an added code or the new
  trace fields.

## 5. Limitations

See `14_LIMITATIONS.md`. The three that drive the verdict: caller assertions are
labelled but not verified; `buildSearchIndex` keeps its own weaker gate; no
authorization cell is authorized.

## 6. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 7. Next gate

**Corpus readiness**, blocked on a genuine counsel determination for one source and
the activities ingestion enforces. If engineering must continue first, the
lifecycle-transition record type is the next bounded card. See
`15_NEXT_GATE_RECOMMENDATION.md`.
