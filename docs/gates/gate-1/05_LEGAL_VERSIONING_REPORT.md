# Legal Versioning Report

**Date:** 2026-11-10
**Tests:** `tests/ingestion/pipeline.test.ts`, `tests/citations/citation-verification.test.ts`
**Schema:** `migrations/d1/0002_gate1_ingestion.sql`

## 1. Version model

Versions are append-only. A content change creates version _N+1_; version _N_ is retained, marked `isCurrent = false`, and receives an `effectiveTo` equal to the new version's `effectiveFrom`. Provisions belong to a version, so historical text is never overwritten.

Observed: one synthetic Act has two versions, 9 versions across 8 documents, and the version-1 provisions remain queryable after version 2 is ingested.

## 2. Relationship vocabulary

Extended in migration 0002 and in `DocumentRelationshipType`:

`AMENDS`, `PARTIALLY_AMENDS`, `REPEALS`, `PARTIALLY_REPEALS`, `SUPERSEDES`, `IMPLEMENTS`, `INTERPRETS`, `APPLIES`, `DISTINGUISHES`, `REVERSES`, `MODIFIES`, `CITES`, `CONSOLIDATES`, `DERIVES_FROM`, `RELATED`.

Each edge carries `scope`, `effectiveDate`, `evidencePassage`, `verificationStatus`.

## 3. Evidence rule

A relationship is applied to legal status **only** when it carries a quoted `evidencePassage`. Without evidence the edge is stored as `UNVERIFIED` and no status changes. Textual similarity never creates an edge.

Verified by test: an unevidenced `REPEALS` assertion leaves the target `IN_FORCE`; an evidenced `AMENDS` scoped to `Section 2` marks only that provision `AMENDED` and the instrument `PARTIALLY_AMENDED`.

## 4. Provision-level tracking

- `AMENDS`/`MODIFIES`: provision becomes `AMENDED`; it remains in force (no `effectiveTo`).
- `REPEALS`/`PARTIALLY_REPEALS`: provision becomes `REPEALED` with `effectiveTo` set to the repeal date.
- Sibling provisions are untouched.

Benchmark: 4/4 amendment checks, 4/4 repeal checks, 4/4 historical-version checks.

## 5. Point-in-time retrieval

Retrieval filters chunks by the version in force at `asOfDate`. The citation verifier selects the same version before locating a provision. Verified: the 2019 text is not retrievable as current text in 2021, and the 2021 text is not retrievable at a 2019 date.

## 6. Limitations

- Relationship evidence is a single quoted passage, not a full amendment history.
- Consolidated texts are not generated; each version is stored separately.
- No automatic detection of amendments. Every edge is an explicit assertion.
- Case-treatment relationships (`REVERSES`, `DISTINGUISHES`) are modelled but not populated from real jurisprudence.
