# 01 — Design: Synthetic Is a Basis, Not an Exemption

## 1. Before

```ts
const strictActivityMode =
  !artifact.synthetic && options.enforceActivityAuthorization === true;
if (!artifact.synthetic && !strictActivityMode) { /* legacy gate */ }
if (artifact.synthetic && !artifact.sourceUrl.startsWith("synthetic://")) fail(...);
if (strictActivityMode) { /* four activity checks */ }
```

For a synthetic artifact the third block never ran, so the four checks never ran.
`addRun` then wrote `authorizationBasis: "synthetic_fixture"`,
`authorizationDecisionRef: "synthetic_fixture"` and
`authorizationDecisionRefs: []` — a record that reads like a decision and is not one.

## 2. After

```ts
const synthetic = artifact.synthetic === true;
const strictActivityMode =
  synthetic || options.enforceActivityAuthorization === true;
...
const acceptedBases = synthetic
  ? ["SYNTHETIC_FIXTURE"]
  : (options.acceptedAuthorizationBases ?? ["COUNSEL_DETERMINATION"]);
```

Three sentences cover the change:

1. **Synthetic implies strict.** The four checks always run for a fixture.
2. **Synthetic pins the basis.** A fixture is authorized by `SYNTHETIC_FIXTURE`
   decisions only; a real artifact by counsel determinations only. Neither class can
   borrow the other's basis.
3. **The run reports decisions, not flags.** `addRun` no longer writes a basis, a
   reference or an empty reference list from the artifact. It writes what the checks
   produced, and nothing when they did not run.

## 3. Why the basis is pinned rather than configurable

`acceptedAuthorizationBases` exists so a non-synthetic pilot can accept an owner risk
acceptance alongside counsel. For a fixture there is no analogous choice: a fixture is
test content by definition, and counsel determinations about test content do not
exist. If a caller could widen a fixture's accepted bases, a fixture could be
"authorized" by a document that was never about it, and the audit would say a counsel
determination covered a synthetic statute. Narrowing is also not allowed — one basis,
always — because a caller-narrowed set would only ever make a fixture fail.

Symmetrically, a real artifact cannot name `SYNTHETIC_FIXTURE`: the fixture basis is
not in the default set, nothing in the pipeline adds it, and an options object that
asks for it is refused with `synthetic_fixture_basis_not_allowed` even when strict
mode is off, so the request cannot sit there waiting for a later strict run. Nor can a
fixture be narrowed to counsel-only: `acceptedAuthorizationBases` is ignored for it.

The locator is a claim about provenance, so the two fields must agree:
`synthetic: true` without a `synthetic://` URL is `synthetic_flag_without_synthetic_locator`,
and `synthetic: false` with one is `synthetic_locator_without_synthetic_flag`.

## 4. What the audit now says

| Outcome                          | Basis detail                                  | References            |
| -------------------------------- | --------------------------------------------- | --------------------- |
| fixture, four decisions allowed  | `SYNTHETIC_FIXTURE`                           | the four decision ids |
| fixture, one activity missing    | `null`                                        | `null`                |
| fixture, no registry             | `null`                                        | `null`                |
| real artifact, counsel decisions | `COUNSEL_DETERMINATION`                       | the four decision ids |
| real artifact, legacy gate       | `null` (legacy `source_authorization` string) | `null`                |

`null` means "no decision was consulted". An empty list was the old way of saying
"checked, nothing found" while nothing had been checked; it is no longer written.

## 5. What it costs and what it does not buy

Every test that ingested a fixture without setup now needs four decisions. That is the
correct friction: the fixture path is exercised through the same gate as a real one, so
a test cannot accidentally travel a path production does not have.

It does **not** make the fixture basis a legal basis. `SYNTHETIC_FIXTURE` cannot
authorize `citation_display` in a projection, cannot substitute for a counsel
determination in the counsel registry, and does not appear in any authority decision.
A corpus full of fixtures still projects nothing.

## 6. Tests

`tests/ingestion/gate19-synthetic-authorization.test.ts` (9):

- no registry → `activity_authorization_registry_missing`, no document, and a run with
  `authorizationDecisionRefs === null`, `authorizationBasisDetail === null` and no
  basis;
- three of four activities → refused naming `search_indexing`, no document;
- four counsel determinations → refused
  `basis_not_accepted:COUNSEL_DETERMINATION`;
- four fixture decisions but a non-synthetic artifact → refused
  `basis_not_accepted:SYNTHETIC_FIXTURE`;
- four fixture decisions → success, basis `synthetic_fixture`, detail
  `SYNTHETIC_FIXTURE`, four references;
- audit: four `AUTHORIZATION_GRANTED` events on success, one `DENIED` for the missing
  activity with reason `no_decision_recorded`;
- `synthetic` without a `synthetic://` locator still refused for that reason;
- `synthetic: false` with a `synthetic://` URL changes nothing;
- a successful caller-supplied audit receives every event for the source.

Plus fixture authorization added to the tests that had relied on the exemption, and
one Gate 4 test rewritten because its premise — "synthetic fixtures are not gated" —
is the behaviour this gate removed. It still proves the original point: the coarse
legal-source list is not what authorizes a fixture.
