# 09 — Audit and Cache Behaviour

**Question:** can a reviewer tell what was checked, for which activity, and whether
it was actually checked?

## 1. Two different audit questions

| Question                                                                               | Mechanism                                                                     | Coverage                                            |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| "Who changed an authorization decision, when, on what basis?"                          | `AuthorizationAuditRecord`, written by `ActivityAuthorizationRegistry.record` | **implemented** for the registry's decision history |
| "Which document/activity pairs did this projection consult, and what did they answer?" | `authorizationChecks` on the projection result                                | **implemented in-memory, per call**                 |

They are not the same record and this gate does not pretend otherwise. The registry
audit is a decision ledger; the projection trace is an answer about one question.

## 2. What a projection records

```ts
authorizationChecks: DocumentActivityDecision[]  // sorted by documentId, then role
authorizationSource: "document_activity" | "caller_asserted"
```

Each entry carries: `documentId`, `activity`, `role`, `decision`, `sourceId`,
`status`, `reason`, `decisionRef`.

That covers the requested fields — document, activity, decision, decision source
(the enclosing `authorizationSource`), denial or abstention reason (`reason`), and
whether the document was target, source or evidence (`role`) — plus the registry
decision id (`decisionRef`) where one exists.

Deliberately absent:

- **no legal content.** No title, passage, locator or evidence text is recorded, so
  a trace cannot become a copy of restricted material;
- **no timestamp on the trace.** The projection is a pure function of its inputs;
  adding `new Date()` would make it non-deterministic and make equality assertions
  meaningless. `request.asOf` is the time dimension of the question, and the
  registry's own records carry `changedAt`;
- **no projection id.** There is no persistence layer to key one against; inventing
  an id would imply a store that does not exist.

## 3. Checked versus unchecked are distinguishable

| Decision       | Meaning                                     | Reason codes                                                                                                                                                          |
| -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTHORIZED`   | a decision exists and permits this activity | `authorized`, `authorized_with_conditions_satisfied`                                                                                                                  |
| `UNAUTHORIZED` | a decision exists and does not permit it    | `prohibited`, `restricted`, `authorization_expired`, `basis_not_accepted:*`, `conditions_unmet:*`, `not_authorized`                                                   |
| `NOT_CHECKED`  | no decision was obtained                    | `no_decision_recorded`, `no_source_for_document`, `unknown_document`, `unknown_activity`, `unknown_role`, `source_lookup_failed`, `registry_error`, `caller_asserted` |

A `NOT_CHECKED` entry never carries a `decisionRef`, and an `AUTHORIZED` one does
whenever a record exists — so a successful check cannot be confused with an
unchecked default.

`caller_asserted` is itself the record that the decision was **not** verified
against the registry — and it only exists for an assertion that named the activity
it covers. That is the honest way to represent a caller's claim.

## 4. Cache behaviour

| Property           | Behaviour                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Cache key          | `${documentId}\u0000${activity}`                                                                                               |
| Lifetime           | the duration of one `projectAuthorityState` call                                                                               |
| Scope              | one projection; nothing crosses calls                                                                                          |
| Invalidation       | automatic — the cache does not outlive the call, so a revocation between two projections is observed by the second             |
| Expiry             | evaluated per call through `registry.check({ now })`; a decision that expires between projections is denied by the second      |
| Failure behaviour  | a resolver error is not cached as success: it yields `NOT_CHECKED` for that pair in that call                                  |
| Activity isolation | keys include the activity, so one activity's decision is never reused for another                                              |
| Role isolation     | roles share a key on purpose: authorization is a property of document + activity, and the first role is recorded as provenance |

The projection applies its own memo. `memoizeDocumentActivity` is a separate,
opt-in helper whose key includes the as-of instant
(`${documentId}\u0000${activity}\u0000${asOf ?? ""}`), because expiry makes two
different instants two different questions.

## 5. Boundary

There is **no** persisted per-check audit table. `authorizationChecks` lives in the
returned object and is lost when the caller drops it. If the projection is later
served through an API, that object is what a request log would capture; today it is
used by tests and by whoever calls the library.

Claiming full audit coverage would be false, so this document states the gap
instead: registry decision changes are durably audited, projection checks are not.
Closing that requires a durable sink, which is a separate gate with its own storage
decision — not something to bolt onto a pure function.
