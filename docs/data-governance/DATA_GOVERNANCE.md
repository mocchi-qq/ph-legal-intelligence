# Data Governance

Status: Gate 11 documentation
Owners: Documentation working group
Last updated: 2026-11-15

This document states the governance rules the code and the gate records already
enforce, and the three separations that must never be collapsed. It describes
what exists at this commit: a complete but synthetic-only engineering system, no
real Philippine legal document, no counsel determination.

## 1. The three separations

### 1.1 Source authorization

Whether a source may be used at all, and for which activity, is decided by
counsel and recorded per cell. `docs/gates/gate-4/02_ACTIVITY_AUTHORIZATION_MATRIX.md`
defines 25 registered sources × 14 activities = **350 cells**, all `UNKNOWN`.
The runtime registry (`packages/legal-ingestion/src/authorization.ts`) fails
closed: a missing decision is `UNKNOWN` and blocks the requested activity.
Authorization is never inferred from a source being official, public, reachable,
or previously processed under owner risk acceptance.

### 1.2 Document identity and provenance

Which instrument a text belongs to, which bytes were read, and when, is decided by
the four-object model in `docs/architecture/LEGAL_DATA_MODEL.md`: a
`SourceManifestation` records one retrieval from one source with `contentHash` and
`retrievedAt`; a `LegalDocument` carries identity; a `DocumentVersion` carries one
authoritative text bounded by `[effectiveFrom, effectiveTo)`; a `DocumentChunk`
carries the retrievable slice with `charStart`/`charEnd`. A hash match is
provenance evidence, not a finding of legal authenticity or currency.

### 1.3 Legal-effect assertions and reviews

What a source claims another instrument did — amend, repeal, suspend, reinstate,
invalidate — is a record separate from both the source and the document. An
assertion is one source's claim about one target, with its own evidence and state;
a review is a named human's substantive judgement on that claim. Neither changes a
source's authorization or rewrites a document version.

## 2. Append-only effect records

`migrations/d1/0009_authority_core.sql` defines the ledger. Every table is
append-only: it has a `no_update`, a `no_delete` and a `no_replace` trigger, so a
correction or a supersession is a new row that points at the old one
(`supersedes_assertion_id`, `supersedes_review_id`, `conflict_group_id`).

| Table                        | Holds                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| `provision_identities`       | A logical provision, stable across versions and renumbering       |
| `citation_aliases`           | Alternative citation strings resolving to a document              |
| `legal_effect_assertions`    | One claimed effect by one source on one target                    |
| `legal_effect_evidence`      | Supporting material for an assertion, with class and availability |
| `legal_effect_reviews`       | A named reviewer's decision on one reviewed proposition           |
| `provision_version_mappings` | Maps a logical provision to one concrete provision version        |
| `citation_resolution_events` | Audit of every resolution attempt, including failures             |

`D1AuthorityStore` (`packages/legal-ingestion/src/authority-d1-store.ts`) writes
these rows and reconstructs a scoped snapshot with `loadStateFor(documentId)`.
A duplicate id is rejected as `duplicate_authority_record`; the trigger remains
as defence behind that check.

## 3. Evidence availability classes

Two vocabularies exist and must not be merged:

- **Ledger availability**, on `legal_effect_evidence.availability`:
  `AVAILABLE`, `UNAVAILABLE`, `NOT_RECEIVED` (also exported as
  `EVIDENCE_AVAILABILITY` in `packages/legal-schema/src/authority.ts`).
- **Registry evidence states**, in `packages/legal-ingestion/src/evidence.ts`:
  `NOT_RECEIVED`, `REFERENCE_INVALID`, `FILE_UNAVAILABLE`, `HASH_MISMATCH`,
  `IDENTITY_UNVERIFIED`, `AUTHORITY_UNVERIFIED`, `EVIDENCE_INCOMPLETE`,
  `AVAILABLE_UNVERIFIED`, `VERIFIED_FOR_RECORDING`. Bytes present
  (`AVAILABLE_UNVERIFIED`) are explicitly not a weaker `VERIFIED_FOR_RECORDING`.

Evidence also carries a class: `OFFICIAL_PRIMARY`, `OFFICIAL_SECONDARY`,
`UNOFFICIAL`, `EDITORIAL`, `INFERENCE` or `UNKNOWN`, plus an attestation of
`NONE`, `IDENTITY_ONLY`, `AUTHORITY_ONLY` or `FULL`. No evidence store exists:
`UnavailableEvidenceStore` returns `null` for every reference, and the only
populated catalogue is test-only and refuses references that are not
`synthetic://`.

## 4. Review outcomes are not revocations

`legal_effect_reviews.outcome` is one of `CONFIRMED`,
`CONFIRMED_WITH_CONDITIONS`, `REJECTED`, `INCONCLUSIVE`, `CONFLICTED`. That is
the substantive decision, and it is immutable once written.

`legal_effect_reviews.status` is one of `ACTIVE`, `SUPERSEDED`, `REVOKED`. This
is a lifecycle status on the review row only: `REVOKED` retires a review so it no
longer counts as operative. It is not an effect type, it does not appear in the
effect vocabulary (`ENACTMENT`, `AMENDMENT`, `REPEAL`, `SUSPENSION`,
`JUDICIAL_INVALIDATION`, `REINSTATEMENT`, `EFFECTIVITY`, `CONSOLIDATION`,
`RENUMBERING`, `OTHER`), and it never alters an assertion or a document. Reading
`REVOKED` as a legal revocation of the instrument would be a category error.

The counsel-determination model has its own separate terminal `REVOKED` state for
a determination (`packages/legal-ingestion/src/counsel-determinations.ts`); that
retires a determination, not a document, and it does not delete stored content
(`docs/gates/gate-5/DECISION.md` §Limitations).

## 5. Retention and access

`docs/security/SECURITY_ARCHITECTURE.md` specifies retention windows per audit
category (§7.1), six-layer tenant isolation (§2), encryption at rest and in transit
(§6.1) and signed-URL-only access to stored files (§6.3). These are specifications:
no audit store, no consent or data-subject-request mechanism, and no retention job
is implemented (`docs/architecture/KNOWN_LIMITATIONS.md`, "Privacy implementation —
Specified"). No retention policy for acquired corpus content exists.

## 6. The governing rule

**No real document may be ingested until counsel authorises one specific source
and activity pair.** Ingestion additionally requires counsel-basis decisions for
`temporary_processing`, `persistent_storage`, `text_extraction` and
`search_indexing`; acquisition requires a `downloading` decision. A
determination for one activity does not change any other cell. Until then the
counts stand at 0 determinations, 350 `UNKNOWN`, four pilot documents
`BLOCKED_AUTHORIZATION`, and no real document held.
