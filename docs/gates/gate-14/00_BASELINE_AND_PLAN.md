# Gate 14 — Index Build Authorization

**Date:** 2026-11-15
**Baseline:** `f289e07` (Gate 13), clean, 695 tests.
**Verdict sought:** the last authorization bypass named by Gate 13, closed.

## 1. The defect

`buildSearchIndex` (`packages/legal-search/src/retrieve.ts:234`) takes:

```ts
authorize: (request: { documentId, sourceId }) => { allowed: boolean; reason?: string }
```

The callback is arbitrary. It need not consult the Gate 4 activity registry, it is
not told which activity it is deciding, and its answer is a bare boolean. So:

- a caller can index a document the matrix would refuse, by returning `allowed: true`;
- the activity being performed (`search_indexing`, one of the five with a runtime
  enforcement point) is never named, so no decision can be attributed to it;
- a denial is silently skipped — `tests/retrieval/index-authorization.test.ts`
  asserts that excluded documents vanish, not that anyone can see why.

Gate 13 recorded this as a limitation and deliberately did not rewrite it. It is
now the only place in the retrieval path where an activity check can be skipped.

## 2. What changes

```ts
export interface IndexBuildOptions {
  /** Required. One decision per document, for the `search_indexing` activity. */
  authorization: DocumentActivityAuthorization;
}
```

- The library fixes the activity to `search_indexing` and the role to `TARGET`.
  A caller cannot index under a different activity, and cannot supply a bare
  boolean or a document-only function — the type requires the
  `(documentId, activity, role) → DocumentActivityDecision` contract Gate 13
  defined.
- Only `decision === "AUTHORIZED"` is indexed. `UNAUTHORIZED` and `NOT_CHECKED`
  both exclude, and the distinction survives in the result.
- The resolver is consulted **once per document**, not once per chunk. The current
  code calls it per chunk, which duplicates work and lets a non-deterministic
  callback index part of a document.
- The index reports what it excluded: `excludedDocuments: DocumentActivityDecision[]`,
  sorted by document id. Silent skipping ends. Precisely: one entry per document
  that had at least one chunk and was not `AUTHORIZED`. A document with no chunks
  is never evaluated, because there is nothing to index and therefore nothing to
  refuse.
- The old `authorize` option is gone. `index_authorization_required` still throws
  when no authorization is supplied, so an existing caller fails loudly rather
  than indexing nothing.

## 3. What is explicitly not changed

- `retrieve` (read time) is unchanged: no per-query authorization, no `viewing`
  gate. That is a separate design — it needs a decision about who is asking, and
  this library has no user. Documented as a limitation, not silently added.
- The registry stays in `legal-ingestion`; `legal-search` depends on it already, so
  no new dependency and no cycle.
- No migration, no schema change, no new table.

## 4. Cards

| ID    | Card                                                    | Files                                                |
| ----- | ------------------------------------------------------- | ---------------------------------------------------- |
| G14-A | Index build requires document-activity authorization    | `retrieve.ts`, `types.ts`                            |
| G14-B | Call sites and helper migrated                          | `tests/benchmark/helpers.ts`, 9 test files           |
| G14-C | Registry-backed tests, including wrong-activity refusal | `tests/retrieval/gate14-index-authorization.test.ts` |
| G14-D | Docs, review, decision                                  | `docs/gates/gate-14/`                                |

## 5. Acceptance

- A document whose `(documentId, search_indexing)` decision is not `AUTHORIZED`
  cannot be indexed, and its exclusion is reported with the decision and reason.
- A document authorized only for another activity is not indexed, and the reason
  says no decision exists for `search_indexing`.
- The resolver is called once per document.
- Passing the removed `authorize` option, or no option, throws
  `index_authorization_required`.
- Every existing retrieval, benchmark, security and counsel test still passes with
  the same observable results (the fixture helper now returns the typed decision).
- Full suite green; build exit 0; Biome 0 errors; no migration changed; all 350
  cells still `UNKNOWN`.

## 6. Non-goals

No real corpus, no counsel record, no deployment. No change to ranking, fusion,
scoring or the passage contract. No read-time gate.
