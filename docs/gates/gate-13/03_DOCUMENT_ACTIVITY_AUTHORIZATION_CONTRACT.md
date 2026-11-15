# 03 — Document/Activity Authorization Contract

**Module:** `packages/legal-ingestion/src/document-activity-authorization.ts`
**Tests:** `tests/authority/gate13-contract.test.ts` (20)

## 1. Why the contract looks like this

Gate 4 authorizes a **source** per activity (`registry.check(sourceId, activity)`).
Gate 12's projection decides authorization per **document**. Neither key alone is
right: a projection about a document must ask the source-level matrix, and it must
ask it for one activity, not for "authorization" in general.

The contract therefore keys on the pair the requester actually knows:

```ts
authorize({ documentId, activity, role }) → DocumentActivityDecision
```

## 2. Types

```ts
export type DocumentRole = "TARGET" | "SOURCE" | "EVIDENCE";

export interface DocumentActivityRequest {
  documentId: string;
  activity: Activity; // one of the 14 Gate 4 activities
  role: DocumentRole; // provenance of the question, never authority
}

export interface DocumentActivityDecision {
  documentId: string;
  activity: Activity;
  role: DocumentRole;
  decision: "AUTHORIZED" | "UNAUTHORIZED" | "NOT_CHECKED";
  sourceId: string | null; // document → source, or null if unresolvable
  status: ActivityStatus | null; // registry status when a record exists
  reason: string; // stable code, see §4
  decisionRef: string | null; // registry decision id when a record exists
}

export type DocumentActivityAuthorization = (
  request: DocumentActivityRequest,
) => DocumentActivityDecision;
```

Type safety properties:

- a `documentId` cannot be passed where an `activity` is expected — both strings,
  but the branded `Activity` union plus `isCanonicalActivity` rejects anything else
  at runtime too;
- one activity cannot silently stand in for another: the decision carries the
  activity it was made for, and the projection records it in `authorizationChecks`;
- a decision object cannot be produced without saying which document and which
  activity were checked;
- `DocumentRole` is provenance. The same `(documentId, activity)` yields the same
  decision whatever the role, and memoisation relies on that.

## 3. Adapter over the existing registry

```ts
createRegistryAuthorization({
  registry: ActivityAuthorizationRegistry,
  sourceOfDocument: (documentId) => string | null,
  now?, satisfiedConditions?, allowedBases?,
}): DocumentActivityAuthorization
```

- `sourceOfDocument` is the only new input. It maps a document to the registered
  source so the existing matrix can answer. It is injected rather than hard-coded
  because `AuthorityDocumentView` does not carry `source_id` and this gate does not
  change the ledger's shape.
- No second registry, no parallel table, no cached truth: every call reaches
  `registry.check`.
- `memoizeDocumentActivity(fn)` is an opt-in wrapper; the projection applies its
  own per-call memo keyed on `${documentId}\u0000${activity}`.

## 4. Decision mapping (fail-closed)

| Registry answer                                                                                                            | Decision       | Meaning                                       |
| -------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------- |
| `allowed: true`, reason `authorized`                                                                                       | `AUTHORIZED`   | a decision exists and permits this activity   |
| `allowed: true`, reason `authorized_with_conditions_satisfied`                                                             | `AUTHORIZED`   | conditional decision, conditions met          |
| status `UNKNOWN` / `NOT_REVIEWED` / `REVIEW_REQUIRED`, or reason `no_decision_recorded`                                    | `NOT_CHECKED`  | **nobody has decided** — not a denial         |
| `PROHIBITED`                                                                                                               | `UNAUTHORIZED` | counsel prohibited it                         |
| `RESTRICTED`                                                                                                               | `UNAUTHORIZED` | counsel restricted it                         |
| `authorization_expired`                                                                                                    | `UNAUTHORIZED` | the decision lapsed                           |
| `basis_not_accepted:<basis>`                                                                                               | `UNAUTHORIZED` | the basis is not acceptable for this call     |
| `conditions_unmet:<conditions>`                                                                                            | `UNAUTHORIZED` | conditional decision, conditions unmet        |
| `not_authorized`                                                                                                           | `UNAUTHORIZED` | any other decided refusal                     |
| `unknown_document`, `unknown_activity`, `unknown_role`, `no_source_for_document`, `source_lookup_failed`, `registry_error` | `NOT_CHECKED`  | the question could not be put to the registry |

`NOT_CHECKED` and `UNAUTHORIZED` are deliberately distinct: "we have not checked"
and "a decision says no" are different facts and are audited differently. Both
fail closed at the projection.

Never `AUTHORIZED` unless `registry.check(...).allowed === true`.

## 5. Defensive behaviour

- empty, blank or non-string `documentId` → `unknown_document`;
- an activity outside `ACTIVITIES` (cast in from JSON, a D1 column or a caller) →
  `unknown_activity`;
- a role outside the three literals → `unknown_role`;
- a `sourceOfDocument` that throws → `source_lookup_failed`, never a crash and
  never an authorization;
- a `registry.check` that throws or returns a non-object → `registry_error`;
- an unrecognised registry **reason** with `allowed: true` is still treated as
  allowed only because `allowed` was true; an unrecognised reason with
  `allowed: false` denies.

## 6. What this contract does not do

- It does not decide policy: the registry's statuses and conditions remain the
  only authority.
- It does not persist anything. Audit coverage is `authorizationChecks` on the
  projection result, described in `09_AUDIT_AND_CACHE_BEHAVIOR.md`.
- It does not cover activities with no runtime path (§4 of
  `02_ACTIVITY_TAXONOMY_RECONCILIATION.md`).
