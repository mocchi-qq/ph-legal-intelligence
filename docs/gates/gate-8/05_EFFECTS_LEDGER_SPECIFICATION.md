# 05 — Effects Ledger Specification

**Date:** 2026-11-14
**Status:** specification + synthetic implementation target.
**Central rule:** an asserted effect is evidence, not a conclusion. Only a recorded
review can promote it, and only within the reviewed scope.

## 1. Purpose

The ledger records claims that one legal instrument affects another — amendments,
repeals, effectivity, suspensions, invalidations, reinstatements, consolidations,
renumbering — with their evidence, review state and conflicts. It does not decide
what Philippine law means.

## 2. Vocabulary

| Field                       | Values                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effectType`                | `ENACTMENT`, `AMENDMENT`, `PARTIAL_AMENDMENT`, `REPEAL`, `PARTIAL_REPEAL`, `SUSPENSION`, `JUDICIAL_INVALIDATION`, `REINSTATEMENT`, `EFFECTIVITY`, `CONSOLIDATION`, `RENUMBERING`, `OTHER` |
| `state` (assertion)         | `UNREVIEWED`, `PENDING_REVIEW`, `CONFLICTED`, `SUPERSEDED`, `UNKNOWN`                                                                                                                     |
| `outcome` (review)          | `CONFIRMED`, `CONFIRMED_WITH_CONDITIONS`, `REJECTED`, `INCONCLUSIVE`, `CONFLICTED`                                                                                                        |
| `status` (review record)    | `ACTIVE`, `SUPERSEDED`, `REVOKED`                                                                                                                                                         |
| `availability` (evidence)   | `AVAILABLE`, `UNAVAILABLE`, `NOT_RECEIVED`                                                                                                                                                |
| `classification` (evidence) | `OFFICIAL_PRIMARY`, `OFFICIAL_SECONDARY`, `UNOFFICIAL`, `EDITORIAL`, `INFERENCE`, `UNKNOWN`                                                                                               |
| `mappingType` (provision)   | `SAME`, `RENUMBERED`, `SPLIT`, `MERGED`, `DELETED`, `NEW`, `UNCERTAIN`, `NONE`                                                                                                            |

These are technical labels. They do not import foreign legal doctrine.

## 3. Records

### 3.1 EffectAssertion (immutable)

Required: `id`, `effectType`, `sourceDocumentId`, `targetDocumentId`, `scope`,
`evidenceId`, `assertionOrigin`, `recordedAt`, `recordedBy`, `state`.

Optional/nullable: `sourceVersionId`, `sourceProvisionId`,
`targetProvisionIdentityId`, `targetVersionId`, `claimedDate`,
`claimedEffectiveDate`, `sourceLocator`, `supersedesAssertionId`,
`conflictGroupId`.

Rules:

- `scope` must be non-empty and describe what is claimed (e.g. "s.2 of target").
- `evidenceId` must resolve to an `EffectEvidence` row.
- `claimedEffectiveDate`, when present, must be a valid ISO date.
- `state` is descriptive only; projection derives the effective state from reviews.
- A superseding assertion is a **new** record; the old one is never mutated.

### 3.2 EffectEvidence

- Identifies the artifact/version/hash/passage that supports the claim.
- `availability` is mandatory and explicit.
- A hash proves bytes, not authenticity; `classification` records what kind of
  evidence it is.
- `UNAVAILABLE`/`NOT_RECEIVED` is a valid state and forces fail-closed projection.
- Evidence may be synthetic-only in this gate; no real evidence is stored.

### 3.3 LegalEffectReview (immutable)

Required: `id`, `assertionId`, `outcome`, `reviewerId`, `reviewerCapacity`,
`decisionDate`, `scope`, `propositionReviewed`, `evidenceRefs`, `status`,
`recordedAt`.

Rules:

- `reviewerId` must be non-empty; in synthetic fixtures it must be an unmistakably
  synthetic identity (e.g. `synth-reviewer-01`).
- `reviewerCapacity` records the role (e.g. `synthetic-legal-reviewer`), not a
  claim of real counsel.
- `propositionReviewed` must state the exact proposition, not "the law".
- `CONFIRMED_WITH_CONDITIONS` requires at least one condition.
- `REJECTED`/`INCONCLUSIVE` do not project a confirmed effect.
- A review can be superseded by a new review (`supersedesReviewId`) or revoked
  (`status = REVOKED` in a new record); history is never rewritten.
- **This is not an authorization record.** It cannot be used to permit storage,
  display or reproduction.

### 3.4 ProvisionIdentity / ProvisionVersionMapping

- `ProvisionIdentity` is a logical provision belonging to one document.
- `ProvisionVersionMapping` links it to a version-specific `LegalProvision`.
- Mapping types make continuity explicit. `UNCERTAIN` and `NONE` are first-class.
- A mapping requires a rationale; `REVIEWED` requires a reviewer decision in a
  later workflow (not inferred here).
- Section number equality or text similarity does not create a `SAME` mapping.

## 4. Conflict semantics

Conflicts are preserved, never resolved by recency, source count or similarity.

| Situation                                         | Projection                                               |
| ------------------------------------------------- | -------------------------------------------------------- |
| No assertion                                      | `UNKNOWN`                                                |
| Assertions, none reviewed                         | `PARTIALLY_DETERMINED` (assertions exist, no conclusion) |
| One active `CONFIRMED` review, evidence available | state from effect + date                                 |
| Two active reviews, different outcomes            | `CONFLICTED`                                             |
| Only `REJECTED` reviews                           | `UNKNOWN`                                                |
| `INCONCLUSIVE` review                             | `INSUFFICIENT_EVIDENCE`                                  |
| Confirmed but evidence unavailable                | `INSUFFICIENT_EVIDENCE`                                  |
| Confirmed but no effective date, as-of query      | `INSUFFICIENT_EVIDENCE`                                  |
| Confirmed but authorization denied                | `UNAUTHORIZED`                                           |
| Superseded review                                 | not active; ignored                                      |
| Revoked review                                    | not active; ignored                                      |

## 5. Supersession

- A new assertion may set `supersedesAssertionId`. Both remain; the old one is
  marked `SUPERSEDED` only by the new record's reference, never by mutation.
- A new review may set `supersedesReviewId`. The prior review stays in history.
- A revocation is a new review record with `status = REVOKED` and a reason in
  `notes`; the projection ignores it as an active conclusion.

## 6. Storage mapping (migration 0009)

| Table                        | Purpose                         | Append-only            |
| ---------------------------- | ------------------------------- | ---------------------- |
| `legal_effect_assertions`    | assertions                      | yes (no update/delete) |
| `legal_effect_evidence`      | evidence metadata               | yes                    |
| `legal_effect_reviews`       | substantive reviews             | yes                    |
| `provision_identities`       | logical provisions              | yes                    |
| `provision_version_mappings` | mapping edges                   | yes                    |
| `citation_aliases`           | approved aliases for resolution | yes                    |
| `citation_resolution_events` | resolver audit                  | yes                    |

Enforced with `BEFORE UPDATE`/`BEFORE DELETE` triggers, foreign keys, `CHECK`
constraints on vocabularies and dates, and indexes on target IDs, assertion
state, review assertion ID, and mapping provision IDs.

The migration is additive; `0001`–`0008` are unchanged.

## 7. Example (synthetic, non-authoritative)

```json
{
  "assertion": {
    "id": "synth-assert-0001",
    "effectType": "PARTIAL_AMENDMENT",
    "sourceDocumentId": "SYNTH-ACT-0002",
    "sourceVersionId": "SYNTH-ACT-0002-v1",
    "sourceProvisionId": "SYNTH-SEC-0003",
    "targetDocumentId": "SYNTH-ACT-0001",
    "targetProvisionIdentityId": "SYNTH-PROV-0002",
    "targetVersionId": null,
    "scope": "SYNTH-ACT-0001 s.2",
    "claimedDate": "2026-01-15",
    "claimedEffectiveDate": "2026-02-01",
    "evidenceId": "synth-evidence-0001",
    "sourceLocator": "s.3",
    "assertionOrigin": "synthetic-fixture",
    "recordedAt": "2026-01-15T00:00:00Z",
    "recordedBy": "synth-fixture-loader",
    "state": "UNREVIEWED",
    "supersedesAssertionId": null,
    "conflictGroupId": null
  },
  "evidence": {
    "id": "synth-evidence-0001",
    "assertionId": "synth-assert-0001",
    "documentVersionId": "SYNTH-ACT-0002-v1",
    "provisionVersionId": "SYNTH-SEC-0003",
    "artifactId": "synth-artifact-0002",
    "contentHash": "0000000000000000000000000000000000000000000000000000000000000000",
    "passage": "Synthetic section 3 amends synthetic section 2.",
    "locator": "s.3",
    "evidenceDate": "2026-01-15",
    "classification": "OFFICIAL_PRIMARY",
    "availability": "AVAILABLE",
    "checkedAt": "2026-11-14T00:00:00Z"
  },
  "review": {
    "id": "synth-review-0001",
    "assertionId": "synth-assert-0001",
    "outcome": "CONFIRMED",
    "reviewerId": "synth-reviewer-01",
    "reviewerCapacity": "synthetic-legal-reviewer",
    "decisionDate": "2026-03-01",
    "scope": "SYNTH-ACT-0001 s.2, effectivity only",
    "propositionReviewed": "SYNTH-ACT-0002 s.3 amends SYNTH-ACT-0001 s.2 effective 2026-02-01",
    "conditions": [],
    "evidenceRefs": ["synth-evidence-0001"],
    "notes": "Synthetic fixture. Not a real counsel determination.",
    "supersedesReviewId": null,
    "status": "ACTIVE",
    "recordedAt": "2026-03-01T00:00:00Z"
  }
}
```

## 8. Non-goals

- No implied repeal inference.
- No automatic invalidation from a decision's text.
- No consolidation treated as authoritative.
- No production citator.
- No real counsel record.
