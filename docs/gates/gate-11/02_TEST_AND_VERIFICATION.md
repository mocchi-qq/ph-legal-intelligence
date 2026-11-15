# 02 — Test and Verification Results

**Date:** 2026-11-15
**Baseline:** `bf328c6` (Gate 10) — 598 tests: 588 pass, **1 pre-existing failure**, 9 skipped.
**Final:** **619 tests — 610 pass, 0 failures, 9 skipped.**

| Check                | Baseline                            | Final                               |
| -------------------- | ----------------------------------- | ----------------------------------- |
| Test files           | 62 (59 passed, 1 failed, 2 skipped) | 63 (61 passed, 0 failed, 2 skipped) |
| Tests                | 598 (588 pass, 1 fail, 9 skip)      | **612 (603 pass, 0 fail, 9 skip)**  |
| Build (`pnpm build`) | exit 0                              | exit 0                              |
| Biome                | 0 errors, 85 warnings               | 0 errors, 84 warnings               |

The suite is fully green for the first time since Gate 6. The single failure that
every gate from 7 to 10 had to carry — `tests/unit/docs-structure.test.ts`, which
requires twelve documentation directories — was repaired by creating the four
missing directories, not by weakening the test.

## 1. Documentation (G11-A)

| Artifact                                                | Evidence                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/product/PRODUCT_REQUIREMENTS.md` (108 lines)      | positioning from the research gate; four-layer guarantee table; refuse-to-answer behaviour; current status with the 0 / 350 / 4 boundary numbers |
| `docs/data-governance/DATA_GOVERNANCE.md` (120 lines)   | three separations; append-only tables; the two evidence vocabularies; review outcome vs revocation; governing rule                               |
| `docs/retrieval/RETRIEVAL_SPECIFICATION.md` (120 lines) | `SearchResult` fields, exact-identifier routing, fusion, filters, as-of selection, lexical-proxy limitation                                      |
| `docs/api/API_SPECIFICATION.md` (120 lines)             | library contracts for the three packages, `D1AuthorityStore` methods, the D1 table list, explicit "no HTTP route, no auth, no deployment"        |

`npx vitest run tests/unit/docs-structure.test.ts` → **3 tests passed**.

Two claims were corrected after checking them against the code rather than
against the prose:

- `exactPassage` is **not** part of `SearchResult`. It is computed in the
  exact-identifier ranking and used only as an ordering tie-breaker; the mapped
  result carries the document-level `exactMatch`. `retrieve.ts` said otherwise in
  a source comment, which is now corrected, and the retrieval document records the
  gap instead of promising the field.
- `UNAUTHORIZED` does not abstain in `projectAuthorityState` (it returns outcome
  `UNAUTHORIZED`, state `UNKNOWN`), and `NOT_CHECKED` is accepted by the type but
  not distinguished from `AUTHORIZED`. The API document says that, rather than
  claiming abstention.

## 2. Deterministic ids (G11-B)

`packages/legal-ingestion/src/authority-ids.ts` — pure, no I/O, no clock:

- `canonicalJson(value)` — sorted keys, `undefined` object keys skipped, `undefined`
  array slots become `null`, non-finite numbers and non-plain objects throw rather
  than collide;
- `deriveAuthorityId(kind, fields)` — `${kind}_${32 hex}` of `sha256`;
- five typed wrappers: `pi`, `pm`, `lea`, `lee`, `ler`.

Identity excludes volatile provenance (`recordedAt`, `recordedBy`, `createdAt`,
`checkedAt`) and lifecycle state (assertion `state`, mapping `reviewStatus`,
review `status`). A review's retirement stays separable because
`supersedesReviewId` is identity: a revocation is a new row with its own
supersedes id, so it derives a different id from the row it retires.

**21 tests** in `tests/authority/authority-ids.test.ts` prove:

- determinism and the id shape;
- key-order independence for both `canonicalJson` and reordered record literals;
- sensitivity to genuine identity fields (`claimedEffectiveDate`,
  `targetProvisionIdentityId`, `effectType`, `provisionVersionId`,
  `documentVersionId`, `mappingType`, `rationale`, review `outcome`, reviewer,
  `decisionDate`, `supersedesReviewId`, array order of `conditions`);
- insensitivity to provenance (`recordedAt`, `recordedBy`, `checkedAt`) and to
  lifecycle state (`state`, `reviewStatus`, `status`);
- a replay of an identical assertion at a different state and registrar derives
  the same id and `D1AuthorityStore.recordAssertion` rejects it as
  `duplicate_authority_record`;
- derived ids round-trip through `AuthorityLedger`;
- `canonicalJson` rejects a function, a BigInt, a symbol, a negative zero
  (which would collide with `0`) and a sparse array (which would collide with an
  explicit `undefined`), and names the offending constructor for a Date;
- evidence differing only in `availability` derives the same id, and an assertion
  differing only in `conflictGroupId` derives the same id.

## 3. Comment corrections

`packages/legal-search/src/retrieve.ts`, two comments and one destructuring:

- the `exactPassage` comment no longer claims callers are told something the
  result does not carry;
- the `exactMatch` comment no longer claims it "additionally requires the number
  in the text" — the code is `exactDocumentIds.has(entry.documentId)`;
- `exactPassage` removed from a map callback that never used it, clearing a Biome
  `noUnusedFunctionParameters` warning.

No behaviour change: `tests/retrieval` → 39 tests passed, `tsc` exit 0.

## 4. What is not proven

- D1 is still validated on `node:sqlite` only. No remote D1, no workerd run; the
  Gate 7 binding limitation stands unchanged.
- Deterministic ids make replay detectable, not concurrent writes safe: two racing
  writers both pre-check and both insert, and the loser lands on the trigger.
  Id-based idempotence is verified; distributed idempotence is not.
- No lifecycle transition record type exists, so `state`/`reviewStatus`/`status`
  cannot legitimately change in place; the append-only store rejects such a write
  rather than recording the transition. Deferred, not implemented.
- No real corpus, no counsel determination, no authorization change.
