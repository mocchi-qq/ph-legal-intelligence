# 10 — Synthetic Test Matrix

**Fixtures:** synthetic identifiers only (`SYNTH-*`, `doc1`, `SYNTH-DOC-1`,
`SYNTH-SRC-1`). No real Philippine legal document, citation or counsel record is
used anywhere in this gate.

| File                                        | Tests | What it proves                                           |
| ------------------------------------------- | ----- | -------------------------------------------------------- |
| `tests/authority/gate13-contract.test.ts`   | 20    | the document/activity contract and registry adapter      |
| `tests/authority/gate13-projection.test.ts` | 11    | target, source and evidence gating inside the projection |
| `tests/authority/gate13-verifier.test.ts`   | 7     | the same rules through the lookup and layer 4            |

## A. Target authorization

| Case                              | Expected                                 | Where                                                                                         |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| correct activity authorized       | determination                            | projection, verifier                                                                          |
| wrong activity authorized         | refusal (not determined)                 | projection `refuses an activity outside…` / verifier `fails when only viewing is authorized…` |
| `NOT_CHECKED`                     | `UNKNOWN`, abstained                     | projection, verifier                                                                          |
| `UNAUTHORIZED`                    | `UNAUTHORIZED` outcome                   | verifier `refuses a target prohibited…`, contract `refuses a prohibited decision`             |
| missing decision (never recorded) | `NOT_CHECKED` / `no_decision_recorded`   | contract, verifier                                                                            |
| unknown activity                  | `UNKNOWN`, `UNKNOWN_ACTIVITY`            | contract + projection                                                                         |
| invalid casing from JSON          | `NOT_CHECKED` (Gate 12 test retained)    | `gate12-authorization.test.ts`                                                                |
| `undefined` / empty status        | `NOT_CHECKED`                            | `gate12-authorization.test.ts`                                                                |
| boxed `String`                    | `NOT_CHECKED`                            | `gate12-authorization.test.ts`                                                                |
| expired decision                  | `UNAUTHORIZED` / `authorization_expired` | contract                                                                                      |
| forbidden/rejected basis          | `UNAUTHORIZED` / `basis_not_accepted:*`  | contract                                                                                      |
| restricted                        | `UNAUTHORIZED` / `restricted`            | contract                                                                                      |
| conditions unmet                  | `UNAUTHORIZED` / `conditions_unmet:*`    | contract                                                                                      |
| conflicting decisions             | `CONFLICTED` outcome, abstained          | projection/`authority-core` (Gate 8 logic, retained)                                          |

## B. Source authorization

| Case                                         | Expected                                                                    | Where                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| source authorized for the activity           | contributes                                                                 | projection, verifier                                               |
| source authorized only for another activity  | excluded, `SOURCE_AUTHORIZATION_NOT_CHECKED:<id>`                           | verifier `excludes a source authorized only for viewing…`          |
| source `NOT_CHECKED`                         | excluded, code recorded                                                     | projection                                                         |
| source `UNAUTHORIZED`                        | excluded, `SOURCE_NOT_AUTHORIZED:<id>`                                      | projection, verifier (prohibited source)                           |
| source missing / no known source             | `NOT_CHECKED` from the adapter                                              | contract                                                           |
| mixed sources                                | determination from survivors, excluded code retained                        | projection, verifier `still determines from an authorized source…` |
| evidence document authorized                 | determination                                                               | projection                                                         |
| evidence document unauthorized               | `INSUFFICIENT_EVIDENCE` + `EVIDENCE_NOT_AUTHORIZED:<evidenceId>`            | projection                                                         |
| evidence document undecided                  | `INSUFFICIENT_EVIDENCE` + `EVIDENCE_AUTHORIZATION_NOT_CHECKED:<evidenceId>` | projection                                                         |
| evidence with no document version            | no evidence check recorded                                                  | projection                                                         |
| unauthorized source beside authorized target | still excluded                                                              | projection, verifier                                               |

## C. Supersession

| Case                                             | Expected                                            | Where                                     |
| ------------------------------------------------ | --------------------------------------------------- | ----------------------------------------- |
| authorized superseder                            | supersedes normally                                 | `gate12-authorization.test.ts` (retained) |
| unauthorized superseder                          | predecessor not resurrected → `UNKNOWN`             | `gate12-authorization.test.ts` (retained) |
| undecided superseder                             | same, with `SOURCE_AUTHORIZATION_NOT_CHECKED`       | `gate12-authorization.test.ts` (retained) |
| superseder authorized for the wrong activity     | same refusal                                        | Gate 13 source gating (same code path)    |
| supersession chain                               | only the tail can be live; broken chain → `UNKNOWN` | algorithm-level, `authority-core`         |
| supersession cycle                               | nothing live → `UNKNOWN`                            | algorithm-level, `authority-core`         |
| supersession involving a missing source document | `NOT_CHECKED` for that source, no resurrection      | contract `no known source` + projection   |

## D. Resolver behaviour

| Case                                   | Expected                                         | Where                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| repeated identical pair                | resolved once                                    | projection `resolves each document once even when two assertions share a source`; contract `resolves once per (documentId, activity)` |
| same document, different activity      | resolved separately                              | contract `keeps separate entries per activity and per document`                                                                       |
| different documents, same activity     | resolved separately                              | contract, same test                                                                                                                   |
| non-deterministic resolver             | first answer wins for the pair                   | contract `caches a denial rather than retrying it`                                                                                    |
| resolver throws                        | `NOT_CHECKED` / `source_lookup_failed`, no crash | contract `does not propagate a throwing source lookup`                                                                                |
| malformed result                       | `NOT_CHECKED` / `registry_error`                 | contract `does not propagate a throwing registry`                                                                                     |
| revocation between projections         | observed — no cross-call cache                   | by construction: memo lifetime is one call (`09_AUDIT_AND_CACHE_BEHAVIOR.md` §4)                                                      |
| expiry between projections             | observed — expiry evaluated per call             | contract expired-decision test + memo scope                                                                                           |
| caller cannot mutate a cached decision | frozen entry                                     | contract `does not let a caller rewrite a cached decision`                                                                            |

## E. End-to-end verification

| Case                                                | Expected                                                   | Where                                          |
| --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| valid authorization + reviewed evidence             | layer 4 passes, `document_activity`                        | verifier (a)                                   |
| wrong activity despite document-level authorization | layer 4 fails, `activity:citation_display` in `missing`    | verifier (b)                                   |
| target unchecked                                    | layer 4 fails, `AUTHORIZATION_NOT_CHECKED`                 | verifier (c)                                   |
| target prohibited                                   | layer 4 fails, `UNAUTHORIZED`                              | verifier (d)                                   |
| source wrong activity                               | layer 4 fails, source code in `missing`                    | verifier (e)                                   |
| incomplete source set                               | layer 4 passes, excluded code retained                     | verifier (f)                                   |
| conflicted source set                               | `CONFLICTED`, abstained                                    | Gate 8 logic retained                          |
| unresolved temporal authority                       | layer 4 fails                                              | Gate 12 tests retained                         |
| misconfigured lookup                                | throws `authorization_required`                            | verifier (g)                                   |
| abstention reason                                   | failed layer's evidence carries the projection explanation | verifier (b) asserts the exact evidence string |

## F. Regression coverage retained

- Gate 12: `NOT_CHECKED` fail-closed, unrecognised values, source gating,
  supersession ordering, memoisation, and `projectUnchecked()` — all still present
  and asserted; only the `activity` field was added to their requests.
- Gates 1–11: the full suite runs unchanged.
- Gate 13 run: **680 tests, 671 pass, 0 fail, 9 skipped** (`11_TEST_AND_REGRESSION_RESULTS.md`).

## G. Cases deliberately not written

- **No real activity cell.** Every registry decision in the tests is recorded with
  basis `SYNTHETIC_FIXTURE`; the 350 real cells remain `UNKNOWN`.
- **No concurrency test.** The projection is pure and single-threaded; the D1 store's
  race is a Gate 10 limitation, unchanged here.
- **No persistence test for the trace.** `authorizationChecks` is in-memory by
  design; a durable sink does not exist.
