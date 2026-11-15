# 05 — Authority Projection Enforcement

**Module:** `packages/legal-ingestion/src/authority-projection.ts`
**Entry points:** `projectAuthorityState`, `queryAuthorityAsOf`
(`temporal-query.ts`)

## 1. What changed at the boundary

`ProjectionRequest` now carries the activity the projection performs, and offers
two mutually exclusive ways to answer the authorization question:

```ts
interface ProjectionRequest {
  snapshot: AuthoritySnapshot;
  documentId: string;
  provisionIdentityId?: string | null;
  asOf: string;
  activity: Activity; // required
  authorizationAssertion?: { activity: Activity; decision: ... }; // caller-asserted, scoped
  documentActivityAuthorization?: DocumentActivityAuthorization; // registry-backed
  satisfiedConditions?: string[];
}
```

There is no bare decision and no document-only resolver: a caller-asserted
decision must name the activity it covers, and a registry-backed decision arrives
as a `DocumentActivityDecision` naming document, activity and role. The bare
string was removed because the same string meant different things in different
requests and could therefore authorize an activity it was never about.

The request shape is validated before any projection work:

| Request                          | Result                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| neither input supplied           | `UNKNOWN`, `AUTHORIZATION_INPUT_MISSING`, abstained                                               |
| both supplied                    | `UNKNOWN`, `AUTHORIZATION_INPUT_CONFLICT`, abstained                                              |
| `activity` not in the 14         | `UNKNOWN`, `UNKNOWN_ACTIVITY`, abstained                                                          |
| assertion names another activity | `UNKNOWN`, `AUTHORIZATION_NOT_CHECKED` + `activity:<requested>`, trace reason `activity_mismatch` |
| assertion activity not canonical | `UNKNOWN`, `UNKNOWN_ACTIVITY`, trace `unknown_activity`                                           |
| assertion decision unrecognised  | `UNKNOWN`, `AUTHORIZATION_NOT_CHECKED`, trace `unrecognised_decision`                             |
| invalid as-of date               | `UNKNOWN`, `INVALID_DATE`, abstained, and **no resolver consulted**                               |

Supplying both is refused rather than resolved by precedence, because silently
preferring one would let a caller believe it had configured the stricter path when
it had not.

## 2. What the activity is used for

The same activity is used for every resolution in the call: the target, each
effect-assertion source, and each evidence document. A projection is never a
mixture. There is no "activity of convenience" fallback and no default.

## 3. Resolution and trace

Each distinct `(documentId, activity)` is resolved once per call and memoised. The
result records:

```ts
authorizationSource: "document_activity" | "caller_asserted";
authorizationChecks: DocumentActivityDecision[]; // sorted by documentId, role
```

- `document_activity` means every check came from a
  `DocumentActivityAuthorization` — in practice the registry adapter.
- `caller_asserted` means the decision came from `authorizationAssertion`. It is
  scoped to one activity and refused if that activity is not the one being
  projected. The system cannot verify that the claim is truthful; it can only
  record that the claim was made, for which activity, and that it was not
  registry-verified. Trace entries carry `sourceId`, `status` and `decisionRef` as
  `null` and `reason: "caller_asserted"`, so a caller cannot forge a registry
  identity.
- `authorizationChecks` includes the target and every source and evidence document
  consulted, so a refusal can be traced to the specific pair that failed.

## 4. Gate 12 behaviour preserved

| Property                                     | Status                                          |
| -------------------------------------------- | ----------------------------------------------- |
| `NOT_CHECKED` never yields a determination   | preserved, and now activity-specific            |
| Unrecognised decision values fail closed     | preserved                                       |
| Resolver memoisation                         | preserved, extended to `(documentId, activity)` |
| Supersession before gating                   | preserved                                       |
| `authorizationChecks` ordering deterministic | new, sorted                                     |

`projectUnchecked()` in `tests/authority/authority-core.test.ts` remains the
regression net: if unchecked authorization ever produces a determined projection,
that test fails.

## 5. Test migration

Every existing caller had to name an activity. That is a strengthening change, not
a weakening one: the assertions each test made about `NOT_CHECKED`, `UNAUTHORIZED`,
source gating, supersession and memoisation are unchanged; only the request gained
a field. `citation_display` is used for citation-shaped tests and `search_indexing`
where indexing is the context.

## 6. What is not enforced here

- Whether the _caller_ is entitled to perform the activity — there is no user, no
  tenant and no authentication surface in this library.
- Activities with no runtime path; a projection for `embedding_generation` is
  accepted and gated exactly like any other, which means it is denied unless a
  decision exists. The gate does not pretend that makes embeddings work.
- Anything about the content of the document. Authorization is not a statement of
  legal correctness.
