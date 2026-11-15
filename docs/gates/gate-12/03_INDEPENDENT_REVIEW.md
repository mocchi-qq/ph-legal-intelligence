# 03 — Independent Review

**Date:** 2026-11-15
**Review:** one read-only pass, reviewer on the other lane from the author.
**Scope:** the projection's authorization handling, the temporal-query and bridge
entry points, the verifier's layer-4 predicate, and the tests including the changed
`authority-core` helper default.

## Findings and disposition

| ID  | Severity | Finding                                                                                                                                                                                                               | Disposition                                                                                                                                                               |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MAJOR    | Moving the `project()` helper default from `NOT_CHECKED` to `AUTHORIZED` shifted the `NOT_CHECKED` regression net out of the core suite: if the fail-open were reintroduced, `authority-core` would no longer notice. | **FIXED** — `projectUnchecked()` added next to `project()`, with a test asserting `UNKNOWN` + `AUTHORIZATION_NOT_CHECKED` + abstained. It fails if the fail-open returns. |
| R2  | MINOR    | A boxed `String` is not a primitive string, so `new String("AUTHORIZED")` is treated as `NOT_CHECKED`. Fail-closed, but undocumented.                                                                                 | **FIXED** — documented in `decide` as deliberate fail-closed behaviour; `instanceof String` acceptance deliberately not added.                                            |
| R3  | MINOR    | The source gate called the resolver once per assertion, so a non-deterministic resolver could authorize one assertion from a source and deny another in the same call, leaving an incoherent `missing` trail.         | **FIXED** — decisions memoised per source document within the call; tested with a resolver that authorizes once and denies afterwards.                                    |
| R4  | NIT      | The barrel exports two similarly named types: `ProjectionAuthorizationDecision` (the projection) and `AuthorizationDecision` (the counsel-registry interface).                                                        | **ACCEPTED AS IS** — recorded as a limitation; renaming the counsel record or aliasing the barrel is a broader API change than this gate should carry.                    |

## Clean areas (reviewer's own assessment)

- `NOT_CHECKED` is fail-closed at every entry point: direct projection, temporal
  query, bridge, and verifier layer 4, where all four pass conditions
  (`DETERMINED_WITH_REVIEWED_EVIDENCE`, operative state, `abstained === false`, no
  `VERSION_NOT_IN_EFFECT`) fail for an unchecked projection.
- Supersession is computed before source gating, so an unauthorized superseder
  suppresses the assertion it supersedes and the result is `UNKNOWN` rather than a
  resurrected stale effect. Tested.
- Source-gating codes are carried into every projection returned after gating,
  including the determined one, so an answer states what it excluded.
- The layer-4 predicate needed no change and was proven end to end rather than
  assumed.
- The "no activity-level authorization" boundary is stated, not glossed.

## Residual limitations

1. **Authorization is per document, not per `(document, activity)`.** The 14
   activity cells are not consulted, so a caller can pass `AUTHORIZED` on the
   strength of the wrong activity and nothing here can detect it.
2. **D1 remains shim-validated**; no remote D1 or workerd run.
3. **The projection trusts its snapshot.** It will not authorize assertions a
   caller should not have, but it does not re-validate the snapshot's provenance.
4. Two similarly named exported authorization types remain in the barrel.
5. No real corpus and no counsel determination.
