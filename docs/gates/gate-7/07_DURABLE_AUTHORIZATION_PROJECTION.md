# Gate 7 — Durable Authorization Projection

**Date:** 2026-11-14
**Status:** wired to durable state; D1 runtime untested.
**Boundary:** `CounselAuthorizationService` (`counsel-registry.ts`)

## 1. Authoritative repository per runtime mode

```ts
new CounselAuthorizationService(registry, audit, {
  runtimeMode: "PRODUCTION_D1",
});
```

| Mode             | Accepted registry    | Effect                                                              |
| ---------------- | -------------------- | ------------------------------------------------------------------- |
| `TEST_IN_MEMORY` | in-memory or D1      | isolated tests only                                                 |
| `PRODUCTION_D1`  | `mode === "d1"` only | constructor throws `production_requires_durable_registry` otherwise |

There is no implicit selection, no environment sniffing and no fallback. The mode
is a required argument, so a caller must state its intent in code.

## 2. Decision flow

1. `registry.loadState(sourceId)` — durable read, commit-filtered.
2. If an evidence store is configured, resolve every reference and attach
   `evidenceStatuses`.
3. `projectFromState(...)` — the same pure function the in-memory adapter uses.
4. `audit.recordAsync(...)` — awaited; failure converts the result to a denial.
5. Return `{ ...projection, evaluatedAt, registryRevision, auditRecorded }`.

`registryRevision` changes when rows change, so a caller can detect that state
moved between authorization and use.

## 3. Gate 5/6 rules preserved

| Rule                                     | Where enforced                                        |
| ---------------------------------------- | ----------------------------------------------------- |
| evidence meets verification requirements | `evidenceStatuses` must be `VERIFIED_FOR_RECORDING`   |
| counsel identity/authority verified      | `validateDetermination` at write + `VERIFIED` counsel |
| source scope matches                     | `loadState(sourceId)` + projection                    |
| document scope matches                   | `documentIds` check                                   |
| activity matches                         | activity decision lookup                              |
| effective date reached                   | `Date.parse(now) < effective` denies                  |
| expiry not passed                        | `now >= expiry` denies                                |
| conditions satisfied                     | `satisfiedConditions` set                             |
| supersession respected                   | effective status fold                                 |
| revocation respected                     | effective status fold                                 |
| conflicts deny                           | `matches.length > 1`                                  |
| missing records deny                     | empty active set denies                               |
| registry failure denies                  | `registry_unavailable`                                |
| stale cache cannot remain active         | no cache; fresh read per decision                     |

The Gate 6 `PROHIBITED` override in `syncToAuthorizationRegistry` is untouched: a
counsel-sourced prohibition still overrides an earlier permissive owner decision.

## 4. Revocation consistency

Verified for:

- revocation followed by immediate projection → `no_verified_determination`;
- retry after revocation → same denial;
- source-wide and activity-level scope → revocation removes the determination from
  the active set entirely;
- document-level scope → same;
- overlapping determination → if another active determination covers the same
  activity, projection returns `conflicting_determinations` (deny), not a silent
  switch to the other determination.

Not automatically handled: deletion of stored content. Revocation is a legal
state, not a storage instruction. No content is deleted, and the gate forbids
assuming that it should be.

Supersession and expiry follow the same path: effective status fold and date
checks. Tests cover all three.

## 5. No fallback

| Failure                           | Behaviour                                                       |
| --------------------------------- | --------------------------------------------------------------- |
| D1 read throws                    | deny `registry_unavailable`; audit `REGISTRY_UNAVAILABLE/ERROR` |
| D1 returns no rows                | deny `no_verified_determination` (never "approve")              |
| Audit write fails                 | deny `authorization_audit_unavailable`                          |
| Evidence store unavailable        | deny `evidence_unavailable`                                     |
| Production mode + memory registry | constructor throws                                              |

An empty in-memory repository is never substituted for a failed D1 read.

## 6. What is not claimed

- D1 runtime behaviour is not verified; `PRODUCTION_D1` is a code-level guard, not
  evidence that a production deployment works.
- No production ingestion service exists to wire this into.
- A caller can still misuse a returned decision; the contract requires
  re-authorization before each content access.
