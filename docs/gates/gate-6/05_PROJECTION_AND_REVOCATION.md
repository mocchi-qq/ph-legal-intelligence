# Gate 6 — Projection and Revocation Consistency

**Date:** 2026-11-13
**Implementation:** `counsel-determinations.ts` (`project`, `syncToAuthorizationRegistry`, `authorizeIndexing`, `authorizeTemporaryLocalStorage`)

## 1. Projection rules

A determination is eligible only when:

1. It is `VERIFIED_FOR_RECORDING`.
2. Counsel identity is verified with evidence.
3. Evidence references exist.
4. Source matches exactly.
5. Document scope matches or is source-wide.
6. Activity matches exactly.
7. Effective date has arrived.
8. Expiry date has not passed.
9. Conditions are satisfied.
10. It is not superseded or revoked.
11. No conflicting active determination covers the same source/activity.

Missing or ambiguous information denies. Omitted activities are never inferred.

## 2. Scopes

| Scope                      | Behaviour                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Source-level               | Applies to all documents of that source; an empty `documentIds` list means source-wide                                   |
| Document-level             | A non-empty list requires a matching document ID; missing ID denies                                                      |
| Activity-level             | One determination row per activity; an omitted activity is unresolved                                                    |
| Overlapping determinations | A verified determination for the same source/activity plus another verified determination is a conflict; both are denied |
| Superseded                 | Old determination becomes inactive; new determination applies only to its own activities                                 |
| Revoked                    | Inactive; projection denies                                                                                              |

## 3. Revocation and stale projections

`syncToAuthorizationRegistry`:

- Projects an allowed activity into the Gate 4 registry with the determination ID, basis, evidence and expiry.
- If a previously authorized activity is no longer usable (revoked, superseded, expired, conflicting, wrong scope), it appends a `PROHIBITED` enforcement override.
- The override uses basis `NONE` and a note `enforcement_override:<reason>`; Gate 4 checks `PROHIBITED` before the basis check, so it cannot be masked.
- Conditions-unmet is not overridden; the conditional decision itself denies until conditions are satisfied. This preserves the condition/prohibition distinction.
- No cache exists. Every check reads the current projection; there is no stale in-memory cache to invalidate.

Tests cover revocation override, omitted activity, expiry, conditions and conflicts.

## 4. Conditions

`AUTHORIZED_WITH_CONDITIONS` remains recorded after projection. Gate 4 `check` requires every condition to be supplied as satisfied; otherwise it denies with `conditions_unmet`. This is a deny, not a stale authorization. The audit retains the conditional decision and its conditions.

## 5. Long-running and background operations

No background worker, queue or long-running task exists. A future worker must:

- Re-check the projection immediately before each access/mutation.
- Treat revocation/expiry as a stop condition.
- Not cache an allow decision beyond the current operation.
- Fail closed if the registry is unavailable.

## 6. Cache policy

No projection cache is implemented. If one is added, it must have a maximum lifetime no longer than the operation, be keyed by source/document/activity, and be bypassed when a revocation or expiry is known. The default must be no-cache.

## 7. Residual limitation

A Gate 4 conditional decision can remain in the registry after conditions change; enforcement is correct (deny), but the registry does not automatically append a new record. This is a records-hygiene issue, not an authorization bypass.
