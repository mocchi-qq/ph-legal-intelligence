# Legal Data Model

Status: Gate 0 specification
Owners: Legal Data working group
Last updated: 2026-11-09

This document specifies the four-object legal data model implemented by
`@phli/legal-schema` and by `migrations/d1/0001_legal_documents.sql`. It is the
reference for ingestion, retrieval, the citation graph and the citation
verification engine. Temporal semantics are specified separately in
[`LEGAL_TEMPORAL_MODEL.md`](./LEGAL_TEMPORAL_MODEL.md).

## 1. Why four objects

A legal instrument is not a file. The same statute arrives as a scan of the
printed Official Gazette, an HTML page, a PDF from a private repository and an
unofficial mirror. The text may be identical, truncated or silently altered. If
the platform stored "documents", it could not say which copy an answer came
from, nor reconcile conflicts between copies.

The model therefore separates four objects, each with one responsibility:

| #   | Object        | Interface                          | Responsibility                                            |
| --- | ------------- | ---------------------------------- | --------------------------------------------------------- |
| 1   | **Source**    | `SourceManifestation`              | One retrieval of a document from one source               |
| 2   | **Canonical** | `LegalDocument`, `DocumentVersion` | The identity and authoritative versions of the instrument |
| 3   | **Extracted** | `ExtractedText`, `LegalProvision`  | Machine-readable text and provision structure             |
| 4   | **Chunks**    | `DocumentChunk`                    | Retrievable slices with provenance back to the source     |

Edges and records bind them together: `DocumentCitation`,
`DocumentRelationship` and `VerificationRecord`.

```
SourceManifestation ──(extraction job)──▶ ExtractedText
        │                                      │
        │                                      ▼
        │                              LegalProvision ──▶ DocumentChunk
        │
        ▼ (identity resolution)
   LegalDocument ──▶ DocumentVersion ──▶ LegalProvision
        │
        ├── DocumentCitation ──▶ LegalDocument
        ├── DocumentRelationship ──▶ LegalDocument
        └── VerificationRecord
```

## 2. Object 1 — Source (`SourceManifestation`)

A manifestation is the atomic, physical-to-digital unit: **one retrieval of one
artifact from one source at one time**. Fields that anchor provenance:

- `sourceId`, `sourceUrl`, `sourceType` — where it came from.
- `authorityLevel` — `official_primary`, `official_secondary` or `unofficial`.
- `acquisitionStatus` — `Approved`, `Restricted`, `Manual`, `Pending`, `Rejected`.
- `contentHash` — sha-256 of the retrieved bytes; the dedup key for sources.
- `retrievedAt` — when the platform fetched it (irrecoverable later).
- `storageKey` — the archived copy in object storage, if retained.
- `isPrimary` — at most one manifestation per document is the authoritative copy.

Manifestations are never edited. A re-retrieval is a new row; the old row is
kept so a citation can always be resolved to the exact bytes that were read.

## 3. Object 2 — Canonical (`LegalDocument`, `DocumentVersion`)

`LegalDocument` is the identity of the instrument, independent of any file. It
carries the taxonomy (`documentType`), the canonical citation (`citationText`,
`docketNumber`), the issuing body, jurisdiction, the multi-date temporals (see
the temporal model) and the current `legalStatus`, `verificationStatus` and
`authorityLevel`.

`DocumentVersion` is one authoritative text of that document:

- `versionNumber` is monotonic per document.
- `contentHash` is the hash of the normalized canonical text — two manifestations
  of the same version resolve to the same hash.
- `effectiveFrom` / `effectiveTo` bound the version in time.
- `isCurrent` marks the live version; amendments insert a new version rather than
  mutating an old one, so answers remain reproducible.

## 4. Object 3 — Extracted (`ExtractedText`, `LegalProvision`)

`ExtractedText` is the machine-readable output of one `extraction_jobs` run over
one manifestation. It records `rawText`, `normalizedText`, `ocrUsed`,
`ocrConfidence` and `parserVersion` so a poor extraction is explainable and
re-runnable.

`LegalProvision` is the structural unit of a version — an article, section, rule,
paragraph or clause — with `label`, `text`, `ordinal` and `parentProvisionId`.
Provisions, not whole documents, are the unit of amendment tracking, so
`legalStatus`, `effectiveFrom`, `effectiveTo` and `amendedByDocumentId` live on
the provision as well as the document.

## 5. Object 4 — Chunks (`DocumentChunk`)

A chunk is a retrievable slice of extracted text. Every chunk carries
`documentId`, `versionId` and optional `provisionId`, plus `charStart`, `charEnd`
and `pageNumber`, so any retrieved passage resolves back to a provision and from
there to the byte range in the source manifestation. Chunks are derived and may
be rebuilt; provisions and versions are authoritative and may not.

## 6. Deduplication strategy

Deduplication runs at three levels, strongest first.

### 6.1 Manifestation level (exact bytes)

Two manifestations with the same `contentHash` are the same bytes. The second is
recorded but never extracted again; it is linked to the existing `ExtractedText`.
This catches the common case of the same PDF mirrored on two sites.

### 6.2 Version level (normalized text)

Two manifestations with different bytes may carry the same text (re-encoded PDF,
HTML vs DOCX). After extraction, text is normalized (whitespace, ligatures,
Unicode NKFD for accents, page furniture stripped) and hashed. Equal normalized
hashes collapse to one `DocumentVersion`.

### 6.3 Document level (identity)

Identity resolution (section 7) decides whether two unequal versions are two
versions of the **same** instrument or two different instruments. Only then is a
new `LegalDocument` created.

## 7. Identity resolution

Identity resolution maps a batch of manifestations and versions onto canonical
documents. It is deterministic and auditable; a false merge is worse than a
missed merge, because it corrupts the citation graph.

Deterministic keys, in priority order:

1. **Explicit identifier.** An official citation, `docketNumber` (G.R. number),
   Republic Act number, or Executive Order number. Exact match under
   normalization.
2. **`identityKey`.** A stable, computed key derived from
   `documentType + normalized identifier + year`. Stored on `legal_documents`
   with a unique index, so two ingestion runs cannot create two rows for one Act.
3. **Title + type + date.** Normalized title match within a type and a tolerance
   window on the temporal dates (promulgation/approval).
4. **Content similarity.** Near-duplicate normalized text (section 6.2) where the
   identifiers are absent, always queued for human review, never auto-merged.

Outcomes:

| Outcome                    | Action                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Exact identifier match     | Attach manifestation/version to the existing document               |
| `identityKey` collision    | Attach; flag for verification                                       |
| Title match, no identifier | Attach and set `verificationStatus = PENDING_REVIEW`                |
| Similar text, ambiguous    | Create candidate link, do **not** merge, queue review               |
| No match                   | Create a new `LegalDocument` with `verificationStatus = UNVERIFIED` |

Every automated decision writes a `VerificationRecord` with `method` and
`findings`, so the resolution can be audited and reversed. A merge or split
requires `verificationStatus` to be recomputed and is always operator-confirmed.

## 8. Verification and trust

`verificationStatus` is the trust state of a document: `UNVERIFIED`,
`PENDING_REVIEW`, `VERIFIED`, `CONFLICT_DETECTED` or `DEFECTIVE_EXTRACTION`. The
citation verification engine reconciles all manifestations of a document against
authoritative sources. A `CONFLICT_DETECTED` document is never presented as
settled law: the conflict, and each side's source, is surfaced to the user.

## 9. Invariants

1. A `LegalDocument` has at least one current `DocumentVersion`.
2. A `DocumentVersion` belongs to exactly one `LegalDocument`; version numbers
   are unique per document.
3. A `SourceManifestation` may exist before it is resolved to a document
   (`documentId` is nullable); once resolved it never moves to another document
   without an audited re-resolution.
4. A `LegalProvision` belongs to exactly one version (and thus one document).
5. Every `DocumentChunk` resolves to a version; a citation can always be walked
   back to a manifestation and its bytes.
6. `isPrimary` is true for at most one manifestation per document.
