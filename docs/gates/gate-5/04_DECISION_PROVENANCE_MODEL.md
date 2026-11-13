# Gate 5 — Decision Evidence and Provenance Model

**Date:** 2026-11-13
**Implementation:** `packages/legal-ingestion/src/counsel-determinations.ts`
**Schema:** `migrations/d1/0005_gate5_counsel_determinations.sql`

## 1. Purpose

This model records structured counsel determinations. It does not read or interpret free-form counsel prose, and it does not create authorization from silence, a file upload, a generic opinion or a website's public availability.

## 2. Determination record

Each determination records:

- globally unique determination ID;
- source ID and document scope (empty document list means source-wide);
- counsel ID and professional details;
- date received, date issued, effective date and expiry date;
- determination status;
- scope;
- activity-level decisions;
- evidence references and decision document reference;
- decision document hash, where available;
- recorded-by identity and audit history;
- supersedes reference.

A hash proves only that recorded bytes match the hashed bytes. It does not prove the identity, authority or professional standing of the author.

## 3. Statuses

`NOT_RECEIVED` · `RECEIVED_UNVERIFIED` · `IDENTITY_UNVERIFIED` · `EVIDENCE_INCOMPLETE` · `SCOPE_AMBIGUOUS` · `REVIEW_REQUIRED` · `VERIFIED_FOR_RECORDING` · `SUPERSEDED` · `REVOKED`

`VERIFIED_FOR_RECORDING` means the determination passed the defined identity, evidence and completeness checks for recording. It does **not** mean every activity is authorized; each activity decision still applies independently.

## 4. Activity decisions

The Gate 5 model has 16 activities. This is a versioned extension of the Gate 4 14-cell enforcement model; existing Gate 4 activity identifiers and meanings are preserved.

| Gate 5 activity          | Gate 4 enforcement mapping       |
| ------------------------ | -------------------------------- |
| viewing                  | viewing                          |
| downloading              | downloading                      |
| temporary_processing     | temporary_processing (in memory) |
| temporary_local_storage  | **no current enforcement point** |
| persistent_storage       | persistent_storage               |
| text_extraction          | text_extraction                  |
| ocr                      | ocr                              |
| search_indexing          | search_indexing                  |
| embedding_generation     | embedding_generation             |
| ai_assisted_analysis     | ai_assisted_analysis             |
| citation_display         | citation_display                 |
| quotation                | quotation                        |
| substantial_reproduction | **no current enforcement point** |
| redistribution           | redistribution                   |
| commercial_use           | commercial_use                   |
| retention                | retention                        |

The two unmapped activities are recorded but not projected. They cannot silently reuse another activity's permission.

Each activity decision records: status (`APPROVED`, `APPROVED_WITH_CONDITIONS`, `RESTRICTED`, `PROHIBITED`, `UNRESOLVED`), scope, conditions, limitations, permitted users, effective/expiry dates and evidence reference.

## 5. Evidence requirements

Before `VERIFIED_FOR_RECORDING`:

1. Counsel identity is `VERIFIED` with evidence.
2. The determination has at least one evidence reference.
3. A decision document reference exists.
4. A valid issue date exists.
5. The activity decisions are unique and complete.
6. Conditional decisions have at least one condition.
7. Dates are valid and expiry is after effectiveness.
8. A decision document hash, if supplied, is 64 hex characters.

Missing evidence fails at record time; it does not create a partial determination.

## 6. Projection rules

A determination projects to an activity only when:

- it is active and `VERIFIED_FOR_RECORDING`;
- it matches the exact source;
- it covers the exact activity;
- the document scope matches or is source-wide;
- the effective date has arrived and the expiry date has not passed;
- conditions are satisfied;
- there is no conflicting active determination for the same source/activity.

A decision for `sc_elibrary` does not authorize another source. Downloading does not authorize storage. Extraction does not authorize OCR, indexing, embeddings, quotation or commercial use.

## 7. Automation boundary

No model converts free-form counsel prose into authorization. Any future convenience extraction must be non-authoritative, preserve the original, show the extracted text beside its source, require human confirmation and fail closed on ambiguity. Gate 5 uses structured manual entry only.

## 8. Synthetic-only evidence

All tests use synthetic counsel, synthetic sources and synthetic evidence. No test fixture is a real counsel approval. The repository's real decision file remains empty.
