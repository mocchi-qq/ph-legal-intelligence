# Gate 4 — Source Authenticity and Legal Date Requirements

**Date:** 2026-11-13
**Machine-readable:** `source-authenticity.json`, `legal-date-evidence.json`

## 1. Authenticity model

Authenticity is not one check. The project records seven separate dimensions:

| Dimension                           | What it proves                                            | Pilot result                                                                           |
| ----------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Official source origin              | The file came from the named institution's domain         | `UNVERIFIED` — owner-authorized retrieval only; no independent provenance confirmation |
| Original file integrity             | The bytes match a recorded acquisition                    | `VERIFIED` — SHA-256 matches `PILOT_MANIFEST.json`                                     |
| Document identity                   | The instrument is the one its identifier claims           | `IDENTIFIER_PARSED` — `REPUBLIC_ACT:<number>`                                          |
| Publication / promulgation evidence | The instrument was issued and published as claimed        | `NONE`                                                                                 |
| Effectivity evidence                | The instrument took effect on a stated date               | `NONE`                                                                                 |
| Version evidence                    | The snapshot is the current or a known historical version | `NONE`                                                                                 |
| Independent corroboration           | A second, independent government source agrees            | `SECOND_SOURCE_UNVERIFIED`                                                             |

**A SHA-256 match proves file integrity relative to one recorded retrieval. It does not prove that the file is an authentic government-issued instrument, that it is current, or that any legal date is correct.**

## 2. Second-source verification rules

Independent corroboration is required before authenticity can be promoted. Acceptable corroboration would be an official issuing-agency repository, the Official Gazette, an official court repository, or another independently maintained government record — **only where access and use are permitted**.

Rules applied:

- Do not bypass a 403 or other access restriction.
- Two URLs on the same underlying website are not independent sources.
- A third-party legal website is not automatically authoritative.
- No second source was contacted in Gate 4; no document was promoted.
- If no suitable source exists, record `SECOND_SOURCE_UNVERIFIED` and leave the status unresolved.

Corroboration record fields: primary source, secondary source, relationship between sources, identity agreement, title agreement, identifier agreement, date agreement, text agreement, discrepancies, outcome.

## 3. Legal date model

Each instrument keeps separate fields. One date is never substituted for another:

`enactment_date` · `approval_date` · `promulgation_date` · `publication_date` · `filing_date` · `effectivity_date` · `amendment_date` · `repeal_date` · `historical_applicability_date`

Not every instrument uses every date. Unknown dates remain `UNKNOWN`. A list-page date, URL, retrieval timestamp or title was **not** treated as a legal date.

Where effectivity depends on publication or another event, documentary evidence and legal review are required.

## 4. Pilot results

| Document | Hash integrity | Official origin | Identity          | Publication | Effectivity | Corroboration            | Authenticity verdict |
| -------- | -------------- | --------------- | ----------------- | ----------- | ----------- | ------------------------ | -------------------- |
| RA 12232 | VERIFIED       | UNVERIFIED      | IDENTIFIER_PARSED | NONE        | NONE        | SECOND_SOURCE_UNVERIFIED | NOT_VERIFIED         |
| RA 10931 | VERIFIED       | UNVERIFIED      | IDENTIFIER_PARSED | NONE        | NONE        | SECOND_SOURCE_UNVERIFIED | NOT_VERIFIED         |
| RA 12326 | VERIFIED       | UNVERIFIED      | IDENTIFIER_PARSED | NONE        | NONE        | SECOND_SOURCE_UNVERIFIED | NOT_VERIFIED         |
| RA 12325 | VERIFIED       | UNVERIFIED      | IDENTIFIER_PARSED | NONE        | NONE        | SECOND_SOURCE_UNVERIFIED | NOT_VERIFIED         |

All nine date fields are `UNKNOWN` for all four documents. No date evidence passage exists. No counsel determination on dates exists.

## 5. Date evidence record

Each date record contains: document ID, date field, extracted value, evidence passage, page or provision, source URL, source hash, verification status, reviewer, and counsel determination where required. The Gate 4 file contains null values and `UNKNOWN` status — nothing was invented.

## 6. Consequence

The four pilot documents are **not authentic for production purposes** and **not date-verified**. They remain internal technical-evaluation material. Authenticity and dates must be resolved, with counsel input where required, before any controlled ingestion.

## 7. Required next evidence

1. Archived official record or issuing-agency confirmation for each document.
2. An independent second source and a recorded agreement/discrepancy result.
3. Documentary evidence for approval, publication and effectivity dates.
4. Legal review of date-dependent effectivity.
5. A version comparison before any legal version is created.
