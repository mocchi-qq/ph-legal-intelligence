# API Specification

Status: Gate 11 documentation
Owners: Documentation working group
Last updated: 2026-11-15

This document specifies the **library-level** contracts a caller can use at this
commit. Everything here is an in-process TypeScript import from a workspace
package. **No HTTP route, no deployed service, no authentication surface, and no
authorisation middleware exist.** `apps/api/src/index.ts` is a stub `fetch`
handler that returns the fixed string `PHLI API` with status 200 and routes
nothing. There is no OpenAPI document, no pagination contract, no rate limit and
no SLA.

## 1. `@phli/legal-search`

Entry point `packages/legal-search/src/index.ts` re-exports three modules.

| Export                                                                                                      | Kind     | Contract                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `buildSearchIndex(corpus, options)`                                                                         | function | Builds `SearchIndex` from `CorpusState`; `options.authorize` is required and throws `index_authorization_required` when absent |
| `retrieve(index, query, defaultLimit?)`                                                                     | function | Returns `SearchResult[]`; default limit 10                                                                                     |
| `isIdentifierQuery(text)`                                                                                   | function | True when the query is a bare typed citation rather than a question                                                            |
| `toCitationInput(result, proposition, relevantDate?)`                                                       | function | Maps a result to `CitationPassageInput` for the verifier                                                                       |
| `SearchQuery`, `SearchFilters`, `SearchResult`                                                              | types    | Query, constraints and result shape                                                                                            |
| `ChunkMetadata`, `RetrievalConfig`, `RetrievalMode`, `RankFusionMethod`, `RetrievalScoreBreakdown`          | types    | Metadata, tuning and score breakdown                                                                                           |
| `IndexEntry`, `SearchIndex`, `IndexBuildOptions`, `IndexAuthorizationRequest`, `IndexAuthorizationDecision` | types    | Index construction surface                                                                                                     |

`buildSearchIndex` is the only place authorization is consulted; a denied
document is silently excluded from the index rather than reported.

## 2. `@phli/citation-engine`

Entry point `packages/citation-engine/src/index.ts` re-exports `types` and
`verifier`.

| Export                                                                    | Kind     | Contract                                                                                                                                 |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `createCitationVerifier(corpus, options?)`                                | function | Returns `CitationVerifier` with `verify(citation): Promise<CitationVerificationResult>`                                                  |
| `selectVersion(versions, documentId, relevantDate?)`                      | function | Resolves one in-force version, or reports `conflict`                                                                                     |
| `supportCoverage(passage, proposition)`                                   | function | Fraction of proposition terms present in the passage                                                                                     |
| `SUPPORT_THRESHOLD`                                                       | const    | `0.8`                                                                                                                                    |
| `stripInstructions(passage)`                                              | function | Removes instruction-like sentences before support scoring                                                                                |
| `normalizeProvisionLabel(label)`                                          | function | Canonicalises `"2"`, `"Section 2"`, `"Sec. 2"`                                                                                           |
| `CitationInput`                                                           | type     | `citationText`, optional `documentId`/`passageId`/`location`, `proposition`, optional `relevantDate`/`supportAnnotation`                 |
| `CitationVerificationResult`                                              | type     | Per-layer booleans, `layerResults`, `verificationStatus`, `states`, `supportClass`, `supportMethod`, `temporalSource`, `authorityStatus` |
| `AuthorityStatusView`, `AuthorityStatusLookup`, `CitationVerifierOptions` | types    | Injected layer-4 contract                                                                                                                |
| `CitationCorpusView` and its four view types                              | types    | Read-only corpus the verifier reads                                                                                                      |
| `VerificationLayer`, `VerificationMethod`, `VerificationStatus`           | enums    | Identity/location/support/temporal; automated/manual/hybrid; verified/partial/failed/pending                                             |

`options.authority` is the layer-4 injection point. Without it the verifier
evaluates the legacy document and provision date fields and labels the result
`temporalSource: "legacy_fields"`.

## 3. `@phli/legal-ingestion`

Entry point `packages/legal-ingestion/src/index.ts` re-exports 23 modules,
including acquisition, authorization and its audit, citation resolution, the
counsel registry and stores, evidence, extraction, identity, the pipeline,
snapshot, the D1 store types and `authority-ids`. `temporal-query.ts` exists in
the package but is not re-exported by the index.

The two surfaces a verification caller needs:

```ts
const store = new D1AuthorityStore(db); // db: D1DatabaseLike
const lookup = createAuthorityStatusLookup(store, {
  authorization: "AUTHORIZED",
});
const verifier = createCitationVerifier(corpus, { authority: lookup });
```

| Export                                                                                                             | Kind      | Contract                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `D1AuthorityStore`                                                                                                 | class     | `constructor(db: D1DatabaseLike)`; see methods below                                                                                                                                                                                                                                                                                       |
| `createAuthorityStatusLookup(store, { authorization })`                                                            | function  | Adapts ledger plus projection to `AuthorityStatusLookup`                                                                                                                                                                                                                                                                                   |
| `projectAuthorityState(request)`                                                                                   | function  | Pure projection of reviewed evidence at an as-of date                                                                                                                                                                                                                                                                                      |
| `ActivityAuthorizationRegistry`                                                                                    | class     | Fail-closed activity gate over the 350-cell matrix                                                                                                                                                                                                                                                                                         |
| `assessCorpusReadiness(signals)`                                                                                   | function  | Returns `BLOCKED_AUTHORIZATION` and similar readiness states                                                                                                                                                                                                                                                                               |
| `canonicalJson(value)`                                                                                             | function  | Deterministic JSON for hashing: sorted keys, `undefined` keys skipped, non-plain objects and non-finite numbers throw rather than collide                                                                                                                                                                                                  |
| `deriveAuthorityId(kind, fields)`                                                                                  | function  | `${kind}_${32 hex}` of `sha256(canonicalJson(fields))`; `kind` must match `^[a-z][a-z0-9]*$`                                                                                                                                                                                                                                               |
| `deriveProvisionIdentityId`, `deriveProvisionMappingId`, `deriveAssertionId`, `deriveEvidenceId`, `deriveReviewId` | functions | The five typed wrappers over `deriveAuthorityId`: deterministic content-addressed ids over a record's identity fields, excluding volatile provenance (`recordedAt`, `recordedBy`, `createdAt`, `checkedAt`) and lifecycle state (`state`, `reviewStatus`), so a replay derives the same id and is rejected as `duplicate_authority_record` |

`D1AuthorityStore` methods: `recordProvisionIdentity`,
`recordProvisionMapping`, `recordAssertion`, `recordEvidence`, `recordReview`,
`getAssertion`, `listAssertionsFor`, `listEvidence`, `listReviews`,
`loadStateFor`. Writes are append-only; a duplicate id throws
`duplicate_authority_record`.

`createAuthorityStatusLookup` requires an explicit `authorization` value and has
no default. `UNAUTHORIZED` returns outcome `UNAUTHORIZED` with state `UNKNOWN`.
`NOT_CHECKED` is accepted by the type but is not distinguished from `AUTHORIZED`
by `projectAuthorityState`, so it does not itself cause an abstention.

## 4. D1 tables (`migrations/d1/0009_authority_core.sql`)

| Table                        | Purpose                                                   | Append-only                             |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------- |
| `provision_identities`       | Logical provision identity, unique per document and label | Yes — no update/delete/replace triggers |
| `citation_aliases`           | Alternative citation strings per document                 | Yes                                     |
| `legal_effect_assertions`    | One claimed effect by one source on one target            | Yes                                     |
| `legal_effect_evidence`      | Evidence for an assertion, with class and availability    | Yes                                     |
| `legal_effect_reviews`       | Reviewer decision, outcome, status, supersession          | Yes                                     |
| `provision_version_mappings` | Logical provision to concrete provision version           | Yes                                     |
| `citation_resolution_events` | Resolution attempts and outcomes, including failures      | Yes                                     |

The migration is validated against a SQLite shim only. No remote D1 or workerd
run has been performed, so the adapter is `IMPLEMENTED_UNVERIFIED` against real
D1 (`docs/gates/gate-10/DECISION.md` §2).

## 5. Errors and failure modes

Errors are thrown as `Error` with string codes, not a class hierarchy:
`index_authorization_required`, `duplicate_authority_record` and
`synthetic_evidence_reference_required` from the test catalogue. Verification never
throws on a failed layer; it returns `FAILED` or `PARTIALLY_VERIFIED` with evidence.

## 6. What is not implemented

No HTTP route, no request/response schema, no authentication, no tenant scoping
inside `retrieve`, no pagination, no streaming, no rate limiting, no deployment,
and no client SDK. The contracts above are internal composition surfaces used by
tests and evaluation harnesses.
