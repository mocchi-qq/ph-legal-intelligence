# 00 — Gate 19 Plan: The Synthetic Ingestion Exemption

**Date:** 2026-11-17
**Baseline:** `1a61e2c` (Gate 18).
**Scope:** engineering only. No real document, no counsel record, no migration.

## 1. The gap (backlog B-2)

`pipeline.ts` skipped every activity check for an artifact flagged `synthetic: true`:

```ts
const strictActivityMode =
  !artifact.synthetic && options.enforceActivityAuthorization === true;
```

The only guard on the exemption was that the URL starts with `synthetic://`, which
the caller also supplies. So **artifact data alone could switch off the gate**: a
caller who set two fields on the input — `synthetic: true` and a `synthetic://` URL —
processed content with no authorization at all. The audit recorded
`authorizationDecisionRefs: []` and the basis `SYNTHETIC_FIXTURE`, which read as if a
decision had been made.

That is the largest remaining engineering gap before a real ingest, and it is exactly
the shape of failure this project keeps finding: an adapter that is fail-closed in the
case it was written for and silently open in the case beside it.

## 2. Decision

**A synthetic artifact runs the same four activity checks as any other. `synthetic`
narrows the accepted basis; it never removes the check.**

| Artifact           | Accepted basis                    | Registry required                                            |
| ------------------ | --------------------------------- | ------------------------------------------------------------ |
| `synthetic: false` | `COUNSEL_DETERMINATION` (default) | yes, unless the legacy source gate was explicitly opted into |
| `synthetic: true`  | `SYNTHETIC_FIXTURE` only          | yes, always                                                  |

Consequences, all deliberate:

- a fixture **cannot** borrow a counsel determination;
- a real artifact **cannot** opt into the fixture basis;
- the audit of a successful synthetic run names the four decisions that authorized it,
  instead of an empty reference list, and a run refused before authorization records
  no decisions at all (`null`, not an empty list — "checked, nothing found" and
  "nothing was checked" must not look the same);
- the four checks run through one code path, so a future activity added to
  `REQUIRED_INGEST_ACTIVITIES` covers fixtures automatically.

The `synthetic://` locator guard stays. It proves the artifact was never fetched from
a real source; it no longer proves anything about authorization.

## 3. What this does not buy

A `SYNTHETIC_FIXTURE` decision is still caller-declared. It says "this content is a
fixture for testing", not "counsel reviewed this instrument". The improvement is that
the declaration is now a recorded decision per activity, in the same registry, through
the same checks, refusable per activity — and that nothing in the artifact can produce
it. It cannot turn a fixture into a legal authority, and layer 4 still refuses to
project anything without a real `citation_display` decision.

## 4. Deliverables

- `pipeline.ts`: synthetic implies strict activity mode; accepted basis pinned to
  `SYNTHETIC_FIXTURE`; run records carry the decisions actually consulted, with no
  basis, reference or empty list written from the artifact's flag.
- `tests/helpers/fixture-authorization.ts`: the four fixture decisions for tests.
- `tests/ingestion/gate19-synthetic-authorization.test.ts`: the refusals and the
  success path.
- Fixture updates in the tests that had been relying on the implicit exemption.

## 5. Acceptance

- A synthetic artifact with no registry fails, writes no document and reports
  `activity_authorization_registry_missing`.
- A synthetic artifact with three of four decisions fails naming the missing activity,
  writes nothing, and records a DENIED audit event for it.
- A synthetic artifact holding counsel determinations only is refused: the basis is
  locked.
- A non-synthetic artifact holding fixture decisions only is refused: symmetry.
- A synthetic artifact with four `SYNTHETIC_FIXTURE` decisions succeeds, and its run
  records `SYNTHETIC_FIXTURE`, `synthetic_fixture` and four decision references.
- A synthetic flag without a `synthetic://` locator is still refused for that reason.
- `synthetic` set to false with a `synthetic://` URL changes nothing: it is not a
  fixture and gets no fixture basis.
- Full suite green with no assertion weakened; build exit 0; Biome 0 errors; no
  migration; 350 cells `UNKNOWN`; 0 counsel determinations.

## 6. Non-goals

Counsel determinations, read-time authorization (B-3), acquisition and network
behaviour, and any change to what a `SYNTHETIC_FIXTURE` decision means downstream. The
fixture basis does not become a legal basis anywhere.
