# Gate 12 — Authorization Is Checked, Not Assumed

**Date:** 2026-11-15
**Baseline:** `71365a7` (Gate 11), clean, 619 tests green.
**Scope:** synthetic only. No corpus, no counsel record, no deployment.

## 1. The defect

`projectAuthorityState` receives `authorization: "AUTHORIZED" | "UNAUTHORIZED" |
"NOT_CHECKED"` and handles exactly one of the three:

```ts
if (req.authorization === "UNAUTHORIZED") { … return UNAUTHORIZED … }
// NOT_CHECKED falls through and behaves identically to AUTHORIZED
```

Two consequences, both fail-open:

1. **`NOT_CHECKED` is indistinguishable from `AUTHORIZED`.** A caller that has not
   checked authorization — which is the honest state of all 350 cells in this
   repository — gets `DETERMINED_WITH_REVIEWED_EVIDENCE` and an operative state.
   That reaches the citation verifier through `createAuthorityStatusLookup`, so
   layer 4 reports temporal validity as passing when nobody established that
   processing was authorized at all. The test suite currently encodes this: the
   projection helper in `tests/authority/authority-core.test.ts` defaults to
   `NOT_CHECKED` and asserts non-abstained, determined results.

2. **Only the target is ever authorized.** `authorization` is one scalar applied to
   the requested `documentId`. An `EffectAssertion` has its own
   `sourceDocumentId` — the instrument that claims the effect. Nothing checks
   whether that source may be processed, so an assertion derived from an
   unauthorized source grounds a determination about an authorized target. In this
   domain that is the difference between "the amending Act says X" and "an
   unauthorized copy of the amending Act says X".

Both are the same class of error the Gate 10 review found and fixed at a different
layer: a value that means "unknown" was being silently read as "yes".

## 2. Design

### 2.1 Authorization input

```ts
export type AuthorizationDecision =
  | "AUTHORIZED"
  | "UNAUTHORIZED"
  | "NOT_CHECKED";

/**
 * A single decision applies to every document; a resolver is asked per document.
 * A resolver that returns anything other than "AUTHORIZED" is treated as NOT_CHECKED.
 */
export type AuthorizationInput =
  | AuthorizationDecision
  | ((documentId: string) => AuthorizationDecision);
```

`ProjectionRequest.authorization` and `TemporalQueryRequest.authorization` accept
`AuthorizationInput`. A scalar keeps working, so existing callers are unaffected in
signature and behaviour _except_ where they passed `NOT_CHECKED`.

### 2.2 Target gating (closes finding 1)

Resolve the decision for `req.documentId`, then:

| Decision       | Result                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHORIZED` | outcome `UNAUTHORIZED`, state `UNKNOWN`, missing `["NOT_AUTHORIZED"]`, abstained `false` (unchanged)                      |
| `NOT_CHECKED`  | outcome `UNKNOWN`, state `UNKNOWN`, missing `["AUTHORIZATION_NOT_CHECKED"]`, abstained `true`, explanation naming the gap |
| `AUTHORIZED`   | continue as today                                                                                                         |

No vocabulary change and no migration: `UNKNOWN` with an explicit missing code is
the honest answer, and every consumer already treats `UNKNOWN` as a refusal.

### 2.3 Source gating (closes finding 2)

After candidate assertions are selected, drop any whose `sourceDocumentId` is not
`AUTHORIZED`, recording the reason per assertion:

- `SOURCE_NOT_AUTHORIZED:<assertionId>`
- `SOURCE_AUTHORIZATION_NOT_CHECKED:<assertionId>`

If every candidate is dropped this way, the projection returns `UNKNOWN`, state
`UNKNOWN`, the recorded codes, and `abstained: true`. If some survive, the
determination is made from the survivors and the dropped codes are carried in
`missing` so the answer states what was excluded rather than silently shrinking
its evidence base.

Supersession is resolved before gating, so an unauthorized assertion cannot both
remove a valid one and then be discarded itself.

### 2.4 Bridge and verifier

`createAuthorityStatusLookup(store, { authorization })` accepts `AuthorizationInput`
and forwards it unchanged. Layer 4 of the verifier needs no change: `UNKNOWN` is
not `DETERMINED_WITH_REVIEWED_EVIDENCE`, so a `NOT_CHECKED` projection already
fails closed. That is asserted end to end rather than assumed.

## 3. Non-goals

- **No activity-level authorization.** The 14-activity matrix is not modelled here;
  a decision is per document, not per `(document, activity)` pair. Recorded as a
  limitation.
- No change to the outcome or state vocabulary, no migration, no new table.
- No change to corroboration, evidence availability or review logic.
- No real corpus, no counsel record, no deployment.

## 4. Acceptance

- `NOT_CHECKED` never yields a determined outcome, an operative state, or
  `abstained: false`, at any entry point (projection, temporal query, bridge,
  verifier layer 4).
- An assertion whose source is `UNAUTHORIZED` or `NOT_CHECKED` cannot ground a
  determination, and its exclusion is visible in `missing`.
- A scalar `AUTHORIZED` reproduces today's behaviour exactly, so Gates 8–11
  results stand.
- Existing tests that relied on the `NOT_CHECKED` default state `AUTHORIZED`
  explicitly and keep their original intent.
- Full suite green; build exit 0; Biome 0 errors.
- Boundaries unchanged: 0 counsel determinations, 350 `UNKNOWN` cells, 4 blocked
  pilot documents, no real documents, no migration changed.
