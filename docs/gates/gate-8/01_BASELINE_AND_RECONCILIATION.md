# 01 — Baseline and Capability Reconciliation

**Date:** 2026-11-14
**Repository:** `/root/ph-legal-intelligence`
**HEAD verified:** `e948df5` (44 commits), branch `main`, working tree clean.
`e948df5` is the current HEAD and an ancestor of nothing newer; no uncommitted
user work exists.
**Baseline suite:** 456 tests, 446 pass, 1 fail, 9 skipped.
The single failure is pre-existing: `tests/unit/docs-structure.test.ts` expects
`docs/product`, `docs/data-governance`, `docs/retrieval`, `docs/api`, which are
absent at HEAD. The 9 skips are the live-pilot test and the env-gated remote D1
suite (8 tests). Neither is caused by this gate.

## 1. Source-of-truth distinctions applied

- Implemented ≠ tested: a type/table existing is not evidence of behaviour.
- Tested ≠ independently verified: synthetic tests are not legal validation.
- Source record ≠ artifact ≠ document identity ≠ version ≠ provision version.
- Citation exists ≠ passage supports ≠ authority is current.
- Source accessible ≠ authorized; authorized ≠ authentic; authentic ≠ effective.
- Asserted effect ≠ reviewed conclusion; reviewed conclusion ≠ reuse permission.

## 2. What Gates 1–7 actually built

| Capability               | Existing implementation                                                                                                    | Test evidence                                          | Remaining gap                                                                                        | Gate 8 action                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Document identity        | `LegalDocument` (`legal-schema/types.ts`); `identity.ts` parses RA/EO/PD/AO/MC/G.R./A.M.; `identityKey` dedupe in pipeline | `tests/legal-data/identity.test.ts` (10), Gate 2 tests | aliases/alternate titles not modelled; no explicit identity-conflict record; merge abstention ad hoc | Add citation aliases + resolution provenance; do not replace identity.ts                               |
| Provision identity       | `LegalProvision` is version-scoped (`document_id`, `version_id`, `label`)                                                  | Gate 1 provision tests; Gate 3 retrieval               | **no logical provision identity across versions**; no split/merge/renumber mapping                   | Add `ProvisionIdentity` + version mappings with `UNCERTAIN`/`NONE` states                              |
| Immutable versions       | `DocumentVersion` with `effectiveFrom/To`, `isCurrent`; pipeline creates versions                                          | Gate 1 versioning tests                                | existing tables are not append-only at DB level; no correction-event model                           | New tables append-only; document/version immutability enforced in service; no rewrite                  |
| Source provenance        | `SourceManifestation` (URL, hash, retrievedAt, authority level); `IngestionRun`                                            | Gate 1/2 tests                                         | artifact→version lineage is implicit                                                                 | Evidence refs point to manifestation/version/hash                                                      |
| Authority classification | `AuthorityLevel` enum; source registry; `AuthorityLevel` on manifestations                                                 | source-registry tests                                  | no separation of "official source" from "legal effect reviewed"                                      | Plane B/C separation in new model                                                                      |
| Citation parsing         | `parseLegalIdentifier` (7 types, first match only)                                                                         | identity tests                                         | no section/rule/article/paragraph citations; no aliases; no multi-candidate output                   | New structured parser; keep old function intact                                                        |
| Citation resolution      | `resolveIdentityCandidate`-style exact key match in pipeline                                                               | identity tests                                         | no alias resolution, ambiguity, provenance, or alias table                                           | Add resolver with 9 result states                                                                      |
| Citation verification    | Four layers in `citation-engine`; lexical support proxy; explicit states                                                   | Gate 1 citation suite, Gate 3 tests                    | temporal layer reads mutable `legalStatus` fields, not effects ledger                                | Integrate authority-state projection at layer 4 only                                                   |
| Temporal validity        | Multi-date fields; `LEGAL_TEMPORAL_MODEL.md` spec; `effectiveFrom/To` on versions/provisions                               | partial Gate 1 tests                                   | no as-of query engine; no effect interval semantics; no abstention contract                          | Add test-only temporal query service                                                                   |
| Effects ledger           | `DocumentRelationship` edge (type, scope, effectiveDate, evidencePassage, verificationStatus)                              | Gate 1 graph tests                                     | **no assertion/review/evidence separation, no conflicts, no review identity, no supersession**       | Add `EffectAssertion`, `EffectEvidence`, `LegalEffectReview`; keep DocumentRelationship as coarse edge |
| Audit trail              | `authorization_audit_events`, counsel audit, D1 commit ledger                                                              | Gate 5–7 tests                                         | no audit of effect assertions/reviews/provision mappings                                             | Append-only records + audit events                                                                     |
| Authorization            | `ActivityAuthorizationRegistry`, 350 cells, fail-closed; counsel registry                                                  | Gates 4–7                                              | none                                                                                                 | Preserve; projection must call authorization check                                                     |
| Uncertainty / abstention | citation states, counsel projection reasons, evidence states                                                               | Gates 3–7                                              | no authority-state abstention contract                                                               | Add explicit result vocabulary and explanation                                                         |

## 3. What must not be built twice

- Authorization: reuse `ActivityAuthorizationRegistry` and `CounselAuthorizationService`.
- Citation verification: extend `citation-engine`; do not fork a second verifier.
- Document/version storage: extend `legal_documents`, `document_versions`,
  `legal_provisions`; no parallel registry.
- Provenance: reuse `SourceManifestation` and content hashes.
- Audit: reuse append-only patterns from migrations 0004/0005/0007/0008.

## 4. Gate 8 scope (synthetic only)

1. Authority domain types (three planes, effect vocabulary, review model).
2. Logical provision identity + version mappings.
3. Append-oriented effects ledger (assertions, evidence, reviews) with conflicts.
4. Deterministic authority-state projection with abstention.
5. Test-only as-of temporal query service.
6. Structured Philippine citation parser + alias resolver (synthetic fixtures).
7. Additive migration `0009` for durable storage of the new model.
8. Tests: identity, versioning, effects, conflicts, reviews, projection, temporal
   boundaries, citation resolution, negative/authorization cases.
9. Documentation + three independent reviews.

**Explicit non-goals:** no real corpus, no AI answers, no vector search, no new
infrastructure, no production routes, no counsel records, no authorization
changes, no citator at scale, no deployment, no push.

## 5. Architecture decisions

- Keep Cloudflare Workers + D1. New durable tables in migration `0009`; no
  graph database, no R2, no Queues.
- Three planes remain separate in the type system:
  - `AuthorizationDecisionRef` (opaque reference, never a legal conclusion);
  - `DocumentIdentity` / provenance (existing schema);
  - `EffectAssertion` / `LegalEffectReview` / `AuthorityProjection`.
- `EffectAssertion` is immutable. Supersession is a new assertion with
  `supersedesAssertionId`.
- `LegalEffectReview` is immutable. Supersession/revocation is a new review row.
- Projection is pure over a ledger snapshot; it never writes and never guesses.
- Absence of a reviewed assertion yields `UNKNOWN`, never "newest version".
- Evidence unavailable yields `INSUFFICIENT_EVIDENCE` (fail closed).
- Conflicts are returned as `CONFLICTED` with all assertion/review IDs.
- Authorization denial yields `UNAUTHORIZED` even if the legal model has data.

## 6. Task ledger

| ID   | Task                                | Files                                     | Depends | Acceptance                              |
| ---- | ----------------------------------- | ----------------------------------------- | ------- | --------------------------------------- |
| G8-A | Baseline + reconciliation           | `01_…`                                    | —       | verified HEAD, tests, gaps              |
| G8-B | Authority types                     | `legal-schema/src/authority.ts`           | A       | types compile; no logic assumptions     |
| G8-C | Provision identity + mappings       | `legal-ingestion/src/authority-ledger.ts` | B       | split/merge/renumber/uncertain tested   |
| G8-D | Effects ledger + reviews + evidence | same                                      | C       | append-only; validation; conflicts      |
| G8-E | Projection + abstention             | `authority-projection.ts`                 | D       | deterministic; 6 result states          |
| G8-F | As-of temporal queries              | `temporal-query.ts`                       | E       | boundary/unknown/overlap tests          |
| G8-G | Citation parser + resolver          | `citation-resolver.ts`                    | B       | 9 resolution states; no fuzzy promotion |
| G8-H | Migration 0009                      | `migrations/d1/0009_…`                    | D       | FK/CHECK/append-only/indexes            |
| G8-I | D1 ledger adapter                   | `authority-d1-store.ts`                   | H       | persistence parity on shim              |
| G8-J | Tests + fixtures                    | `tests/authority/*`                       | B–I     | positive + negative + regression        |
| G8-K | Docs + 3 reviews                    | `docs/gates/gate-8/`                      | all     | findings remediated                     |
| G8-L | Verdict + status                    | `DECISION.md`, JSON                       | K       | accurate evidence level                 |

## 7. Risks

| Risk                                                      | Mitigation                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| Confusing review of legal effect with reuse authorization | Separate types/tables; negative tests                          |
| Implementing a citator by inference                       | Only explicit assertions/reviews; no text-similarity promotion |
| Rewriting historical versions                             | Append-only new tables; no updates to 0001–0008                |
| Overbuilding beyond synthetic scope                       | Non-goals list; no AI/vector/graph infra                       |
| D1 overclaim                                              | SQLite shim separated from remote D1; no workerd claim         |
| Subagent code drift                                       | One-file briefs, tsc + tests after each task, reviewer pass    |
