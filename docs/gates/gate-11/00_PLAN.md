# Gate 11 — Maintenance and Ingest Idempotence

**Date:** 2026-11-15
**Baseline:** `bf328c6` (Gate 10), clean. Gate 10 accepted with limitations.
**Scope:** engineering maintenance only. No corpus, no counsel records, no
authorization change, no deployment.

## 1. Why this gate exists

Gate 10's decision records that the corpus-readiness gate is blocked on a genuine
counsel determination. Until one exists, the only justified work is maintenance:

1. **One test has been red since Gate 6.** `tests/unit/docs-structure.test.ts`
   requires twelve documentation directories; `docs/product`,
   `docs/data-governance`, `docs/retrieval` and `docs/api` do not exist. Every
   gate since has had to report "1 pre-existing failure", which weakens the
   signal of the remaining 588 tests. The `README.md` already links
   `docs/product/`, so the gap is real documentation debt, not a bad test.
2. **Authority records have caller-supplied ids.** Gate 10's D1 store rejects
   duplicate ids, but the id itself is arbitrary, so re-running the same
   ingestion produces a duplicate-rejection instead of an idempotent no-op, and
   two independent writers can mint different ids for the same fact. That
   blocks any bounded real-ingest trial the moment counsel unblocks one.

## 2. Cards

| ID    | Card                                                                     | Concern                     |
| ----- | ------------------------------------------------------------------------ | --------------------------- |
| G11-A | Restore the four missing documentation directories with accurate content | docs only                   |
| G11-B | Deterministic, content-addressed authority record ids                    | one new pure module + tests |
| G11-C | Full-suite verification, independent review, decision record             | evidence                    |

## 3. G11-A — documentation

Create `docs/product`, `docs/data-governance`, `docs/retrieval`, `docs/api`.

Content must describe **what exists at `bf328c6`**, not aspirations:

- product: the positioning accepted at the international research gate
  (Philippine legal authority infrastructure — versions, effects, citations,
  provenance — surfaced through a research engine, with AI gated by verification),
  the synthetic-only status, and the blocked corpus.
- data-governance: source authorization separated from document identity and
  from legal-effect assertions; append-only effect records; the 350 `UNKNOWN`
  authorization cells; no real documents held.
- retrieval: the Gate 9 `SearchResult` contract, passage spans, exact-identifier
  routing, as-of selection, and the lexical (not semantic) support proxy.
- api: the implemented library surfaces and the D1 tables, explicitly marked as
  library-level contracts with no production route.

No invented endpoints, no compliance claims, no vendor promises.

## 4. G11-B — deterministic ids

New `packages/legal-ingestion/src/authority-ids.ts`:

```ts
canonicalJson(value: unknown): string        // recursive, key-sorted
deriveAuthorityId(kind, fields): string      // `${kind}_${sha256(canonicalJson(fields)).slice(0,32)}`
deriveProvisionIdentityId(identity)
deriveProvisionMappingId(mapping)
deriveAssertionId(assertion)
deriveEvidenceId(evidence)
deriveReviewId(review)
```

Rules:

- the id is a pure function of the record's **identity fields**;
- volatile provenance (`recordedAt`, `checkedAt`, `createdAt`, `recordedBy` as a
  timestamp-like field) is excluded, so a replay of the same fact yields the
  same id;
- review identity includes `reviewerId`, `decisionDate`, `outcome`,
  `propositionReviewed` and `supersedesReviewId`, so two reviewers or two
  decisions never collapse into one row;
- arrays are normalised (order preserved for ordered data, sorted where the
  field is set-like) and documented;
- no crypto beyond `node:crypto` `sha256`, already used by `store.ts`;
- no change to the ledger, the store or the migrations — this module is opt-in.

## 5. Non-goals

- No real document acquisition, extraction or indexing.
- No migration changes; `0001`–`0009` untouched.
- No mapping-review workflow redesign (deferred: it needs a review contract
  larger than one card).
- No semantic support verification; the lexical proxy stands.
- No deployment, no push.

## 6. Acceptance

- `tests/unit/docs-structure.test.ts` passes; full suite has no failures.
- Deterministic ids: same input → same id across processes; field order does not
  matter; a changed identity field changes the id; a changed provenance field
  does not; a derived record round-trips through `AuthorityLedger` and
  `D1AuthorityStore`, with a replay rejected as `duplicate_authority_record`.
- Build exit 0; Biome error count 0.
- Boundaries unchanged: 0 counsel determinations, 350 `UNKNOWN` cells, 4 blocked
  pilot documents, no real documents.
