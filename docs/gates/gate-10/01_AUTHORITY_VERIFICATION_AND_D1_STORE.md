# 01 — Authority-Aware Verification and D1 Persistence Design

**Date:** 2026-11-15

## 1. Verifier injection (no package cycle)

`@phli/citation-engine` remains independent. It accepts an optional callback:

```ts
interface AuthorityStatusView {
  outcome: string;
  state: string;
  explanation: string;
  abstained: boolean;
}

type AuthorityStatusLookup = (request: {
  documentId: string;
  provisionId?: string | null;
  asOf: string;
}) => Promise<AuthorityStatusView>;

createCitationVerifier(corpus, { authority?: AuthorityStatusLookup })
```

`legal-ingestion` (or a service) supplies the callback from
`projectAuthorityState`; the verifier never imports the ledger.

### Layer 4 rules

Pass only when:

- `outcome === "DETERMINED_WITH_REVIEWED_EVIDENCE"`, and
- `state` is operative: `IN_FORCE`, `AMENDED`, `PARTIALLY_AMENDED`,
  `REINSTATED`, `CONSOLIDATED`, `RENUMBERED`.

Everything else fails with the projection outcome/state/explanation as evidence:
`UNKNOWN`, `PARTIALLY_DETERMINED`, `CONFLICTED`, `INSUFFICIENT_EVIDENCE`,
`UNAUTHORIZED`, and non-operative states (`REPEALED`, `PARTIALLY_REPEALED`,
`SUSPENDED`, `INVALIDATED`, `NOT_YET_EFFECTIVE`).

No callback → existing field-based `checkTemporal` runs; the result records
`temporalSource: "legacy_fields"`. With a callback, `temporalSource:
"authority_projection"` and `authorityStatus` are recorded.

## 2. D1 store

`D1AuthorityStore` (`packages/legal-ingestion/src/authority-d1-store.ts`):

| Method                                                             | Behaviour                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `recordProvisionIdentity`                                          | insert, parameterized                                                                           |
| `recordProvisionMapping`                                           | insert, parameterized                                                                           |
| `recordAssertion`                                                  | insert; pre-checks id so a duplicate surfaces as `duplicate_authority_record`                   |
| `recordEvidence`                                                   | insert                                                                                          |
| `recordReview`                                                     | insert; conditions/evidence refs as JSON arrays                                                 |
| `getAssertion`, `listAssertionsFor`, `listEvidence`, `listReviews` | parameterized reads                                                                             |
| `loadStateFor(documentId)`                                         | documents/versions/provisions/identities/mappings + assertions/evidence/reviews for that target |

No update or delete. Constraint errors map to `duplicate_authority_record` or
`append_only_violation`.

`loadStateFor` scopes every query to the target document (or to its versions or
assertion ids), so a snapshot cannot leak another document's effects. Unknown
document → empty snapshot, which projects `UNKNOWN` rather than a guess.

## 3. Integration example (synthetic)

```ts
const store = new D1AuthorityStore(db);
const authority = createAuthorityStatusLookup(store, {
  authorization: "AUTHORIZED", // explicitly chosen by the caller
});
const verifier = createCitationVerifier(corpus, { authority });
```

`createAuthorityStatusLookup` resolves the verifier's provision-version id to a
provision identity through the snapshot's mappings, passes `undefined` (not
`null`) when there is no pinpoint, and returns the projection's `missing` and
`versionId` so layer 4 can reject `VERSION_NOT_IN_EFFECT`.

## 4. Limitations

- D1 validation is on the SQLite shim only; no remote D1 or workerd run.
- `loadStateFor` loads one target document at a time; multi-document conflict
  detection at verification time is the caller's responsibility.
- The verifier still does not provide passage support beyond the lexical proxy.
- No real corpus or counsel determination exists.
