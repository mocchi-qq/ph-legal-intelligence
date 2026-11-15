# Gate 10 — Authority-Aware Verification and D1 Ledger Persistence

**Date:** 2026-11-15
**Baseline:** `381ebe4` (47 commits), clean. Gate 9 accepted.
**Scope:** synthetic only. No corpus, no AI, no deployment.

## 1. Two carry-overs from Gates 8–9

1. **Citation-verifier layer 4 is not wired to the effects ledger.** The verifier
   still reads mutable `legalStatus`/date fields; the authority projection exists
   but is unused by verification.
2. **The effects ledger has no durable writer.** Migration `0009` is validated on
   the SQLite shim only; there is no adapter that persists assertions, evidence,
   reviews or mappings, and no reader that reconstructs an `AuthoritySnapshot`.

## 2. Design

### 2.1 Verifier injection (no package cycle)

`citation-engine` must not import `legal-ingestion`. The verifier accepts an
optional authority lookup:

```ts
interface AuthorityStatus {
  outcome: string;   // AuthorityQueryOutcome
  state: string;     // AuthorityState
  explanation: string;
  abstained: boolean;
}

type AuthorityStatusLookup = (request: {
  documentId: string;
  provisionId?: string | null;
  asOf: string;
}) => Promise<AuthorityStatus>;

createCitationVerifier(corpus, { authority?: AuthorityStatusLookup })
```

Layer 4 behaviour:

- if `authority` is supplied and a relevant date exists: pass only when
  `outcome === "DETERMINED_WITH_REVIEWED_EVIDENCE"` and the state is operative
  (`IN_FORCE`, `AMENDED`, `PARTIALLY_AMENDED`, `REINSTATED`, `CONSOLIDATED`,
  `RENUMBERED`);
- otherwise fail with the projection outcome/state/explanation as evidence;
- if no authority callback is supplied, preserve the existing field-based check
  and label the source;
- the result records which source was used (`authority_projection` or
  `legacy_fields`).

### 2.2 D1 writer adapter

`D1AuthorityStore` implements the ledger's persistence surface against the
`D1DatabaseLike` used by Gate 7:

- `recordAssertion`, `recordEvidence`, `recordReview`, `recordProvisionIdentity`,
  `recordProvisionMapping`;
- `loadState(source? / targets)` reconstructing an `AuthoritySnapshot`;
- `getAssertion`, `listReviews`, append-only (no update/delete);
- all reads parameterized; no SQL legal logic.

Validation stays in the domain layer; the adapter maps constraint failures to
stable errors.

## 3. Non-goals

- No real corpus or counsel records.
- No new tables (0009 is sufficient); no migration changes.
- No production route.
- No UI, embeddings or model.

## 4. Acceptance

- A confirmed, operative projection makes layer 4 pass; unreviewed/conflicted/
  unauthorized/repealed projections fail with the projection evidence.
- No authority callback → existing Gate 1–9 behaviour unchanged.
- D1 adapter round-trips assertion/evidence/review/identity/mapping on the shim,
  preserves append-only semantics, and reconstructs a snapshot usable by
  `projectAuthorityState`.
- Full suite green apart from the pre-existing docs-structure failure.
- No real documents, authorization cells or counsel records changed.
