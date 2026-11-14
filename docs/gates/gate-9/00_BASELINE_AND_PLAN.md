# Gate 9 — Passage-Level Retrieval and Search Hardening

**Date:** 2026-11-14
**Baseline:** `8d56e58` (45 commits), clean. Gate 8 accepted with limitations.
**Known baseline failure:** `tests/unit/docs-structure.test.ts` (missing docs directories at HEAD); Gate 9 must not add failures.
**Scope:** synthetic-only retrieval contract hardening. No corpus, no AI, no
vector index, no reranker, no deployment.

## 1. Why this gate

Gate 8 built the authority core (version/provision/effect identity). `legal-search`
already retrieves passages, but `SearchResult` omits the identifiers needed to
hand a passage to a version-aware verifier:

| Field              | Index has it              | Result exposes it |
| ------------------ | ------------------------- | ----------------- |
| `versionId`        | yes                       | **no**            |
| `provisionId`      | yes                       | **no**            |
| `effectiveFrom/To` | yes                       | **no**            |
| character span     | chunk has `charStart/End` | **no**            |
| provenance block   | derivable                 | **no**            |
| exact-match flag   | internal                  | **no**            |

So a caller must re-query storage to verify a citation, and cannot prove which
version or span supported an answer.

## 2. Contract changes (additive)

`SearchResult` gains:

```ts
versionId: string;
provisionId: string | null;
effectiveFrom: string | null;
effectiveTo: string | null;
span: { charStart: number; charEnd: number } | null;
provenance: {
  sourceId: string;
  documentId: string;
  versionId: string;
  provisionId: string | null;
  chunkId: string;
};
exactMatch: boolean;
```

All fields are additive for consumers; no field is removed. Constructors of
`SearchResult` (mocks, adapters) must add the new fields at typecheck time.

## 3. Retrieval behaviour

1. Exact citation bypass stays: an identifier-shaped query (including a party-name
   citation with a docket) returns only matching document(s), never fuzzy
   neighbours; `exactMatch` is set only on passages that contain the identifier.
2. `asOfDate` filters by the version's effective interval `[from, to)`.
3. Passage results carry the version/provision/span that produced them.
4. No semantic/vector/reranker is added.
5. Whole-document text is never presented as passage-level support.

## 4. Integration helper

`toCitationInput(result, proposition, relevantDate?)` returns the existing
`CitationInput` shape with `documentId`, `passageId` (chunk id), `location`
(provision label), and the result preserved for provenance. It does not call the
verifier; it removes the manual mapping.

## 5. Non-goals

- No effects-ledger wiring of verifier layer 4 (Gate 8 limitation stands).
- No new index, embedding, model, queue, bucket or table.
- No real Philippine text.
- No production route.

## 6. Acceptance

- New fields are present and correct on synthetic fixtures.
- Exact identifier query returns the exact passage at rank 1 with `exactMatch`.
- An `asOfDate` selects a version whose interval covers the date; it never falls
  back to a non-covering version.
- Span offsets match the source chunk.
- `toCitationInput` yields a verifier input that passes identity/location on the
  fixture; a fabricated proposition fails support, and a passage-against-itself
  proposition passes only through the lexical proxy.
- Existing Gate 1 retrieval, Gate 6 index authorization, and Gate 8 authority
  tests remain green.
- Published baseline for exact lookup and passage retrieval on the synthetic set.

## 7. Task ledger

| ID   | Task                    | Files                                         | Acceptance             |
| ---- | ----------------------- | --------------------------------------------- | ---------------------- |
| G9-A | Contract + helper       | `legal-search/src/types.ts`, `to-citation.ts` | additive; typecheck    |
| G9-B | Index/result plumbing   | `legal-search/src/retrieve.ts`                | fields + exact flag    |
| G9-C | Tests                   | `tests/retrieval/gate9-*`                     | behaviour + boundaries |
| G9-D | Regression + build      | full suite                                    | no new failures        |
| G9-E | Review + docs + verdict | `docs/gates/gate-9/`                          | one independent review |
