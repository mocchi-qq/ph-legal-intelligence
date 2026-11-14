# Gate 7 — Repository Contract and Adapter Architecture

**Date:** 2026-11-14
**Contract:** `CounselRegistry` (`packages/legal-ingestion/src/counsel-registry.ts`)
**In-memory adapter:** `InMemoryCounselRegistry`
**Durable adapter:** `D1CounselRegistry` (`counsel-d1-store.ts`)
**Projection:** `projectFromState` (`counsel-projection.ts`)

## 1. Separation of concerns

| Layer                     | Implementation                                                                                | Notes                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| Domain types              | `CounselProfessional`, `CounselDetermination`, `CounselActivityDecision`, `CounselAuditEvent` | unchanged from Gate 5                   |
| Repository contract       | `CounselRegistry` (async)                                                                     | the contract both adapters satisfy      |
| Legacy in-memory contract | `CounselRepositoryContract` (sync)                                                            | retained so Gate 5 callers do not break |
| In-memory adapter         | `InMemoryCounselRegistry` over `CounselDeterminationRepository`                               | deterministic unit-test adapter         |
| Durable adapter           | `D1CounselRegistry`                                                                           | D1 prepared statements + batch          |
| Projection                | `projectFromState`                                                                            | one pure function, no SQL               |
| Authorization boundary    | `CounselAuthorizationService`                                                                 | explicit runtime mode, no fallback      |
| Audit service             | `AuthorizationAuditService`                                                                   | sync + async sinks, fail closed         |
| Evidence availability     | `assessEvidence`, `EvidenceLookup`                                                            | metadata only, no store                 |

The in-memory repository keeps its synchronous API. Two adapters rather than one
synchronous interface avoid forcing ~50 existing call sites to become async while
still giving the durable path a fully awaitable contract.

## 2. `CounselRegistry`

```ts
interface CounselRegistry {
  readonly mode: "in-memory" | "d1";
  registerProfessional(...): Promise<CounselAuditEvent>;
  recordDetermination(...): Promise<{ status: "RECORDED" | "ALREADY_COMMITTED"; audit }>;
  statusOf(id): Promise<CounselDeterminationStatus | null>;
  transition(id, status, actor, reason, at?): Promise<CounselAuditEvent>;
  revoke(id, actor, reason, at?): Promise<CounselAuditEvent>;
  supersede(oldId, newId, actor, reason, at?): Promise<CounselAuditEvent>;
  getDetermination(id): Promise<CounselDetermination | null>;
  listByDocument(sourceId, documentId): Promise<CounselDetermination[]>;
  loadState(sourceId): Promise<CounselRegistryState>;
  auditTrail(determinationId?): Promise<CounselAuditEvent[]>;
}
```

`loadState` is the **only** input to authorization projection. Both adapters return
the same shape:

```ts
interface CounselRegistryState {
  professionals: ReadonlyMap<string, CounselProfessional>;
  determinations: readonly CounselDetermination[];
  statuses: ReadonlyMap<string, CounselDeterminationStatus>; // effective, after revocation/supersession
  evidenceStatuses?: ReadonlyMap<string, EvidenceAvailability>;
  revision?: number;
}
```

## 3. Why projection is not in the adapters

`projectFromState` reproduces the Gate 5 decision rules exactly:

1. determination must be `VERIFIED_FOR_RECORDING` (effective status);
2. evidence references must exist and, when assessed, be `VERIFIED_FOR_RECORDING`;
3. activity decision must be `APPROVED` or `APPROVED_WITH_CONDITIONS`;
4. document scope must match when the determination is document-scoped;
5. effective date reached, expiry not passed;
6. conditions satisfied;
7. one and only one matching active determination (otherwise conflict denies);
8. revocation and supersession deny;
9. missing records deny.

The in-memory adapter and the D1 adapter both delegate to this function. The
parity suite (`gate7-projection-parity.test.ts`) asserts identical results for
eleven scenarios. No authorization rule exists in SQL.

## 4. Compatibility

- `CounselDeterminationRepository` keeps its public methods and now implements
  `CounselRepositoryContract`.
- `project()` delegates to `projectFromState`; existing tests are unchanged.
- `D1CounselStore` is kept as an alias of `D1CounselRegistry` so the Gate 7 draft
  name still resolves.
- New behaviour: superseding an already-superseded determination throws
  `already_superseded`; revoking a superseded one throws `already_superseded`.
  Projection already denied these states; the write now fails loudly too.

## 5. Explicit production selection

`CounselAuthorizationService` requires `runtimeMode`:

- `TEST_IN_MEMORY` — accepts either adapter;
- `PRODUCTION_D1` — constructor throws `production_requires_durable_registry`
  unless `registry.mode === "d1"`.

There is no code path that swaps D1 for memory, and a D1 failure returns
`registry_unavailable` rather than an empty state.

## 6. Remaining gap

The D1 adapter is `IMPLEMENTED_UNVERIFIED`: it is exercised against a
`node:sqlite` shim, not a D1 runtime. See `01_D1_RUNTIME_FEASIBILITY.md`.
