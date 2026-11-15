# 13 — Independent Review

**Date:** 2026-11-15
**Structure:** three independent read-only reviews (A: authorization architecture,
B: authority projection and ledger, C: verification and regression), then a separate
remediation verification of the fixes.

**Totals:** 13 findings in the three reviews (1 HIGH, 4 MEDIUM, 8 LOW), all closed;
the remediation verification raised 2 further LOW findings, both closed. No
CRITICAL or HIGH finding remains open.

---

## Reviewer A — authorization architecture

| #   | Severity | Finding                                                                                                                                                                            | Disposition                                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A1  | MEDIUM   | A legacy `(documentId) => decision` resolver receives only the first argument, so one answer is applied to target, sources and evidence under whatever activity the request names. | **CLOSED** — the bare/scalar/1-arg form was removed entirely. `authorizationAssertion` names its activity; a mismatch is refused. |
| A2  | LOW      | `now` was optional, so expiry could be judged against the wall clock and a projection would not replay identically.                                                                | **CLOSED** — `asOf` travels with each request and beats `options.now`; an unparseable `asOf` fails closed (`invalid_as_of`).      |
| A3  | LOW      | A resolver could return `{ decision, sourceId: "FAKE", status, decisionRef }` and the trace would record the forged fields.                                                        | **CLOSED** — caller assertions now force `sourceId`/`status`/`decisionRef` to `null` and `reason: "caller_asserted"`.             |

Clean areas named by A: the contract is genuinely keyed on document **and** activity;
the registry is the only source of truth (no second list, no cross-projection
cache); the decision mapping is fail-closed with no open misclassification; expiry,
conditions and basis rejection behave as the registry specifies; revocation wins
because `latest()` scans backwards and each projection creates a fresh context;
wrong-activity substitution is prevented in the memo key, the registry lookup and
the decision object; the 16-vs-14 counsel reconciliation matches the code exactly;
the contract tests assert concrete codes and would catch a fail-open regression.

## Reviewer B — authority projection and ledger

| #   | Severity | Finding                                                                                   | Disposition                                                                                                                                                                                                                                                |
| --- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | MEDIUM   | The trace collapsed roles when one document was consulted as both TARGET and SOURCE.      | **CLOSED** — one entry per (document, activity, role), still one resolution.                                                                                                                                                                               |
| B2  | MEDIUM   | An `INSUFFICIENT_EVIDENCE` projection could list evidence ids it had excluded.            | **CLOSED** — ids are merged only after every ref passes; the failure path returns `evidence: []`.                                                                                                                                                          |
| B3  | MEDIUM   | No test for a supersession chain whose unauthorized link is not the immediate superseder. | **CLOSED** — chain A←B←C with C unauthorized → `UNKNOWN`, no resurrection, code naming C.                                                                                                                                                                  |
| B4  | LOW      | The invalid-date branch still consulted the target resolver.                              | **CLOSED** — validation happens before any consultation; `authorizationChecks` is empty.                                                                                                                                                                   |
| B5  | LOW      | Validation order differed from the documentation.                                         | **CLOSED** — code and docs both: exactly-one input → activity → as-of → target.                                                                                                                                                                            |
| B6  | LOW      | Duplicate of B1 (trace role omission).                                                    | **CLOSED** with B1.                                                                                                                                                                                                                                        |
| B7  | LOW      | No test where evidence resolves to the target document and the target is unauthorized.    | **CLOSED** — target gate wins, no `EVIDENCE_*` code, one trace entry.                                                                                                                                                                                      |
| B8  | LOW      | `projectUnchecked()` seen as tautological.                                                | **RETAINED, not closed** — it is the Gate 12 regression net for the invariant that `NOT_CHECKED` never determines. Removing it to satisfy a style objection would delete the only core-suite guard on that behaviour. Recorded in `14_LIMITATIONS.md` §18. |

Clean areas named by B: no determination leaks past target gating; source gating
covers every candidate and records exclusions on every return path; evidence gating
handles null and unknown versions and already-checked documents; supersession is
computed over the whole snapshot before gating; multi-source results stay incomplete
rather than fabricated; memoisation prevents an inconsistent split within one call.

## Reviewer C — verification and regression

| #   | Severity | Finding                                                                                                                                                                                                     | Disposition                                                                                                                                                   |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | HIGH     | A caller-asserted scalar (`"AUTHORIZED"`) authorised **every** activity for every document, because the decision did not state its activity — so the activity gate could be bypassed by a caller assertion. | **CLOSED** — the scalar form was removed; a caller assertion must name its activity and is refused when it differs. This is the finding that changed the API. |
| C2  | LOW      | Test-side risk: manual `AuthorityStatusView` construction would drift if a required field were added.                                                                                                       | **NO ACTION** — the field added (`authorizationSource`) is optional; monitored, not fixed.                                                                    |

Clean areas named by C: layer 4's four-condition predicate is unchanged and
`authorizationSource` is pass-through only; the lookup fixes the activity at
construction so one verifier cannot switch activities between citations; the
abstention reason and the specific missing codes reach the failed layer; Gate 12's
assertions survive with only the activity field added and two documented code
additions; the audit document claims no more than the code does; the end-to-end
tests use a real registry rather than a stub.

## Remediation verification (separate pass)

Re-read the code and tests after the fixes. Result: **all 9 remediated findings
CLOSED**, Gate 12 semantics preserved, no assertion weakened or deleted, documents
05–09 matching the code. Two new LOW findings:

| #   | Severity | Finding                                                                                                                                                                 | Disposition                                                                                                                                               |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | LOW      | Document 09's cache table did not distinguish the projection's internal memo key from the helper's, which now includes the as-of instant.                               | **CLOSED** — the row states both keys.                                                                                                                    |
| R2  | LOW      | The projection validates `asOf` strictly as a calendar date while the adapter accepts any parseable instant — consistent in practice, inconsistent as defence in depth. | **CLOSED** — documented: the projection gatekeeps a calendar date; a full instant is accepted for callers outside a projection; unparseable fails closed. |

## Process note

The HIGH finding came from a reviewer reading the _interaction_ between a Gate 12
convenience (`authorization: "AUTHORIZED"`) and Gate 13's new requirement. Neither
in isolation is a defect; the composition was. That is the argument for three
reviews rather than one, and it is recorded here rather than softened into a
"clarification".
