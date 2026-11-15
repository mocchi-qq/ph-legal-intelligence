# 08 — Verifier Integration

**Path:** `createAuthorityStatusLookup` → `projectAuthorityState` → verifier layer 4.

## 1. The lookup is where the activity is fixed

```ts
createAuthorityStatusLookup(store, {
  activity: Activity,                                   // required
  authorizationAssertion?: { activity, decision },       // caller-asserted, scoped
  documentActivityAuthorization?: DocumentActivityAuthorization,
})
```

The activity is part of the lookup's construction, not of each verification call.
A verifier instance therefore cannot verify one citation as `citation_display` and
the next as `commercial_use` by accident — changing the activity means constructing
a different lookup, which is a visible act. Construction validates that at least one
authorization input was supplied and throws `authorization_required` otherwise, so a
misconfigured lookup fails immediately instead of abstaining per citation.

Every verification path in this repository uses `citation_display`: that is the
activity a citation answer actually performs.

## 2. Layer 4's predicate is unchanged

```ts
outcome === "DETERMINED_WITH_REVIEWED_EVIDENCE" &&
  operativeState &&
  !abstained &&
  !(missing ?? []).includes("VERSION_NOT_IN_EFFECT");
```

Nothing was added and nothing was relaxed. The gate is upstream: a projection whose
target, source or evidence document is not authorized for the activity cannot
produce `DETERMINED_WITH_REVIEWED_EVIDENCE` with an operative state and
`abstained: false`, so layer 4 fails without needing to know why. The verifier is
deliberately not re-implementing authorization policy — it consumes the authority
layer's answer, as Gate 10 established.

`AuthorityStatusView` gained one optional field, `authorizationSource`, so a
consumer can tell registry-verified decisions (`document_activity`) from
caller-asserted ones (`caller_asserted`). It is recorded in the result's
`authorityStatus`; it does not influence the predicate.

## 3. Failures are specific

| Situation                                      | Layer 4 | Reported                                                                                  |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| target authorized, evidence reviewed, in force | pass    | `temporalSource: "authority_projection"`                                                  |
| target authorized only for another activity    | fail    | `missing` names `activity:<activity>`; evidence is the projection's explanation           |
| target `NOT_CHECKED`                           | fail    | `AUTHORIZATION_NOT_CHECKED`                                                               |
| target prohibited or restricted                | fail    | outcome `UNAUTHORIZED`                                                                    |
| source authorized for another activity         | fail    | `SOURCE_NOT_AUTHORIZED:<assertionId>` or `SOURCE_AUTHORIZATION_NOT_CHECKED:<assertionId>` |
| one source excluded, another valid             | pass    | the determination stands and the excluded code remains in `missing`                       |
| evidence document unauthorized                 | fail    | `INSUFFICIENT_EVIDENCE` with `EVIDENCE_*:<evidenceId>`                                    |

A pass after an exclusion is intentional and not silent: the answer is determined
from the sources it may use, and it states which source it could not use.

## 4. What the verifier does not do

- It does not call the registry. Only the lookup adapter does.
- It does not infer an activity from the query text. The activity is a deployment
  decision, because deciding it per query would let a caller reach a cheaper
  activity by phrasing.
- It does not upgrade a caller-asserted decision into a registry-verified one.
  `authorizationSource` reports which it received, and a caller assertion that
  names a different activity than the lookup's is refused rather than applied.

## 5. Evidence

- `tests/authority/gate13-verifier.test.ts` — seven end-to-end cases covering
  authorized, wrong-activity, unchecked, prohibited, wrong-activity source,
  partial-source, and misconfigured lookup.
- `tests/authority/gate10-bridge.test.ts`, `gate12-bridge-auth.test.ts` — retained,
  updated only to name the activity.
- `tests/citations/gate10-authority.test.ts` — the injected-lookup contract tests,
  unchanged in substance.
