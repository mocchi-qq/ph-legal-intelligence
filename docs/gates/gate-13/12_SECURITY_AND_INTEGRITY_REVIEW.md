# 12 — Security and Integrity Review

**Scope:** the authorization path this gate changed. Written by the implementing
side; the independent reviews are in `13_INDEPENDENT_REVIEW.md` and are not
substituted by this document.

## 1. Threat: performing an activity the matrix does not permit

| Attack                                                                  | Before Gate 13                                              | After                                                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Project a document authorized for `viewing` as if for `search_indexing` | possible — authorization was document-level                 | refused: activity required, resolved per activity                                                |
| Use an amending instrument whose source is not authorized               | possible at activity level (Gate 12 only checked documents) | refused: every source resolved for the activity                                                  |
| Present evidence from an unauthorized document                          | possible                                                    | refused: `EVIDENCE_*` code, `INSUFFICIENT_EVIDENCE`                                              |
| Reuse a decision made for one activity for another                      | possible                                                    | refused: memo key includes activity; trace names the activity                                    |
| Pass a generic `AUTHORIZED` and have it accepted as any activity        | possible                                                    | still accepted as a **caller assertion**, labelled `caller_asserted`, never as registry-verified |

## 2. Fail-closed properties asserted by tests

- No input produces `AUTHORIZED` except `registry.check(...).allowed === true`.
- Missing document, missing activity, unknown activity, unknown role, unknown
  source, throwing source lookup, throwing registry, malformed registry answer —
  each yields `NOT_CHECKED` (20 contract tests).
- `NOT_CHECKED` never yields a determination, at target, source or evidence level.
- Supplying both authorization inputs is refused rather than resolved by precedence.
- A lookup with no authorization input throws at construction.

## 3. Residual risks, stated plainly

1. **Caller-asserted decisions remain possible.** `authorization:
   "AUTHORIZED"` still works and is labelled `caller_asserted`. The library cannot
   verify a claim it was handed; it can only refuse to call it registry-verified.
   Mitigation: the type requires an activity alongside, the result records which
   kind of source was used, and every end-to-end test uses the registry adapter.
2. **`sourceOfDocument` is injected and trusted.** A caller that maps a document to
   the wrong source gets the wrong answer. The system cannot detect this; the
   mapping is a provenance question, not an authorization one.
3. **No authentication or tenancy.** There is no user, so "who may ask" is out of
   scope. `retrieve` does not enforce tenant scoping either (Gate 9 limitation).
4. **The trace is not persisted.** `authorizationChecks` is returned in memory. A
   dropped result leaves no record that a check happened — stated in
   `09_AUDIT_AND_CACHE_BEHAVIOR.md` §5 rather than glossed.
5. **`buildSearchIndex` still takes a caller callback.** An index can be built on a
   bare assertion that need not consult the registry. Pre-existing; recorded as a
   limitation and left alone deliberately.
6. **Denial of service by configuration.** A lookup whose activity has no recorded
   decision refuses every verification. That is correct behaviour and also a
   predictable way to make the system useless; it is a deployment risk, not a
   bypass.

## 4. Integrity guarantees preserved

- **No authorization record was created, modified or inferred.** All 350 cells
  remain `UNKNOWN`; the registry in tests is populated only with
  `SYNTHETIC_FIXTURE` decisions in-memory.
- **Append-only ledger untouched.** No migration changed, no trigger removed.
- **No real document touched.** Every fixture is synthetic.
- **Gate 12 regression tests retained**, including the `projectUnchecked()` net.

## 5. Review of the reviewer

The three independent reviews are the check on this document. Where they disagree
with it, they win: their findings and dispositions are recorded in
`13_INDEPENDENT_REVIEW.md`, and any disagreement with the claims above is corrected
there rather than reconciled silently here.
