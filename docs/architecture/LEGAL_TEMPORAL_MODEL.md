# Legal Temporal Model

Status: Gate 0 specification
Owners: Legal Data working group
Last updated: 2026-11-09

This document specifies how the platform represents time in the legal data
model: the multiple dates a Philippine legal instrument carries, the temporal
statuses derived from them, and how provision-level amendment tracking makes
point-in-time retrieval possible. It is the temporal companion to
[`LEGAL_DATA_MODEL.md`](./LEGAL_DATA_MODEL.md) and governs the date columns in
`migrations/d1/0001_legal_documents.sql`.

## 1. Why one date is not enough

A law has no single "date". A Republic Act is **approved** by the President,
**published** in the Official Gazette (or a newspaper of general circulation),
and takes **effect** fifteen days after publication unless it says otherwise. A
court decision is **promulgated** on a date that is not its filing date nor its
publication date. Some instruments are **amended** and **repealed** years later.
Conflating these into one `date` column makes it impossible to answer the only
question that matters in practice: _was this provision in force on the day of
the act in question?_

The model therefore stores each date separately, each nullable, each meaning
exactly one thing.

## 2. The multi-date model

Dates live on `LegalDocument`; retrieval time lives on `SourceManifestation`.

| Field              | Meaning                                                          | Typical instruments                        |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------ |
| `approvalDate`     | Date the Executive/legislature approved or signed the instrument | Statutes, RAs, EOs, AOs                    |
| `promulgationDate` | Date the instrument was officially issued/proclaimed             | Court decisions, court rules, POs          |
| `publicationDate`  | Date it was published (Official Gazette or newspaper)            | Laws requiring publication                 |
| `effectivityDate`  | Date it became legally in force                                  | All                                        |
| `amendmentDate`    | Date of the most recent amendment                                | Amended instruments                        |
| `repealDate`       | Date it was expressly repealed                                   | Repealed instruments                       |
| `retrievedAt`      | Date the platform fetched this manifestation                     | On `SourceManifestation`, not the document |

Rules:

- Dates are stored as ISO-8601 calendar dates (`YYYY-MM-DD`) in `TEXT` columns,
  never as epoch integers, so they sort lexically and read exactly as published.
- A date that is unknown is `NULL`, never a sentinel such as `0000-00-00` or a
  guessed value. Where a source states only a month or year, the uncertainty is
  recorded in the extraction findings rather than invented precision.
- `effectivityDate` defaults to `publicationDate + 15 days` **only** for
  instruments whose text delegates effectivity, and the derived value is flagged
  so it is never mistaken for a stated date.
- `retrievedAt` answers "as of when did this platform know this?" and is
  distinct from every legal date. It is the anchor for cache and freshness
  logic and is never used in a legal-status calculation.

## 3. Temporal statuses

Two status layers are maintained.

### 3.1 Document status (`LegalStatus`)

| Status              | Meaning                                                     |
| ------------------- | ----------------------------------------------------------- |
| `NOT_YET_EFFECTIVE` | Enacted/approved but `effectivityDate` is in the future     |
| `IN_FORCE`          | In effect and unamended                                     |
| `PARTIALLY_AMENDED` | Some provisions amended or repealed, the rest in force      |
| `AMENDED`           | Amended as a whole; superseded text replaced                |
| `REPEALED`          | Expressly repealed by a later instrument (`repealDate` set) |
| `SUPERSEDED`        | Replaced in practice without an express repeal clause       |
| `EXPIRED`           | Lapsed by its own terms or a sunset clause                  |
| `UNDER_REVIEW`      | Status contested or awaiting verification                   |
| `UNKNOWN`           | Default until verified                                      |

### 3.2 Provision status (`LegalStatus` on `LegalProvision`)

Provision status is _not_ the document status copied down. A document may be
`PARTIALLY_AMENDED` while most of its provisions are `IN_FORCE` and a few are
`REPEALED`. Provision status is authoritative for point-in-time queries.

## 4. How status is derived (as-of evaluation)

Status is a function of the dates and **the instant being asked about**, not a
stored boolean:

```
status(provision, asOf):
  if asOf < provision.effectiveFrom:            return NOT_YET_EFFECTIVE
  if provision.effectiveTo and asOf >= effectiveTo: return REPEALED / SUPERSEDED
  if provision.amendedByDocumentId and asOf >= amendmentDate:
                                                return AMENDED
  return IN_FORCE
```

The `LegalDocument.legalStatus` column is a **materialized cache** of the status
at "now", recomputed whenever a version or provision changes. Point-in-time
queries always re-derive from the dates on the selected version rather than
trusting the cache, so a historical answer cannot be poisoned by a later
amendment.

## 5. Provision-level amendment tracking

Amendment tracking is the reason provisions are first-class.

1. **Amendments create versions.** A new text of the document is ingested as a
   new `DocumentVersion` with its own `effectiveFrom`. The prior version gets an
   `effectiveTo` and `isCurrent = 0`. Historical text is never overwritten.
2. **Provisions carry their own lifespan.** Each `LegalProvision` has
   `effectiveFrom`, `effectiveTo`, `legalStatus` and `amendedByDocumentId`.
   Amending section 5 of an Act:
   - closes the old Section 5 (`effectiveTo` = amendment effectivity,
     `legalStatus = AMENDED`),
   - inserts the new Section 5 with a new `effectiveFrom`,
   - sets `amendedByDocumentId` to the amending instrument,
   - updates the document to `PARTIALLY_AMENDED`.
3. **Repeal without replacement** closes the provision (`effectiveTo`,
   `legalStatus = REPEALED`) with no successor.
4. **The relationship graph records intent.** `DocumentRelationship` edges
   (`AMENDS`, `REPEALS`, `SUPERSEDES`, `CONSOLIDATES`) carry the human-readable
   provenance; the provision dates carry the machine-applicable effect. Both are
   written together.

A "consolidated" view (an Act as amended) is a read-time composition of the
versions in force at the requested date, never a stored document.

## 6. Point-in-time retrieval

A query may ask for the law "as of" a date D. Retrieval filters to provisions
where `effectiveFrom <= D` and (`effectiveTo` is NULL or `effectiveTo > D`), on
the version that was current at D. This yields the text that was actually in
force, including provisions later repealed. Because versions and provisions are
immutable and dated, the same query over the same corpus always returns the same
answer.

## 7. Freshness and re-verification

- `retrievedAt` on the newest `SourceManifestation` drives a freshness policy: a
  document not re-retrieved within its window is marked stale for verification,
  not for legal status.
- A re-retrieval that produces a different `contentHash` for a supposedly
  unchanged version raises `CONFLICT_DETECTED` and queues human review; it never
  silently replaces the canonical version.
- A newly published amending instrument is ingested as a new document first, then
  linked through `DocumentRelationship` and applied to provisions, so the graph
  is consistent even if the application step is delayed or fails.

## 8. Invariants

1. `effectivityDate >= publicationDate` where both are known, unless the text
   expressly provides otherwise; a violation flags the extraction.
2. `effectiveTo > effectiveFrom` on every version and provision that has both.
3. At most one `DocumentVersion` per document has `isCurrent = 1`.
4. Every `LegalProvision` has an `effectiveFrom`; `effectiveTo` is set exactly
   when its `legalStatus` is `AMENDED`, `REPEALED`, `SUPERSEDED` or `EXPIRED`.
5. `repealDate` is set exactly when `legalStatus` is `REPEALED`.
6. Legal dates are never derived from `retrievedAt`.
