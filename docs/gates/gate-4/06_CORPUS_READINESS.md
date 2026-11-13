# Gate 4 — Corpus Readiness Assessment

**Date:** 2026-11-13
**Machine-readable:** `corpus-readiness.json`
**Expansion status:** **BLOCKED**. No document was added or acquired in Gate 4.

## 1. Readiness rule

`READY_FOR_CONTROLLED_INGESTION` requires **all** of the following:

1. Counsel authorization for every activity the ingestion path performs.
2. Authenticity supported by independent corroboration.
3. Required legal dates verified with evidence.
4. All recorded conditions satisfied.
5. No unresolved source-evidence blocker.

A failure at any earlier step prevents a later status from being claimed. Gate 2 technical success is not evidence for any of these.

## 2. Four pilot documents

| Document | Source        | Hash verified | Authenticity             | Legal dates | Authorization | Permitted activities | Readiness                 |
| -------- | ------------- | ------------- | ------------------------ | ----------- | ------------- | -------------------- | ------------------------- |
| RA 12232 | `sc_elibrary` | yes           | SECOND_SOURCE_UNVERIFIED | UNKNOWN     | UNKNOWN       | none                 | **BLOCKED_AUTHORIZATION** |
| RA 10931 | `sc_elibrary` | yes           | SECOND_SOURCE_UNVERIFIED | UNKNOWN     | UNKNOWN       | none                 | **BLOCKED_AUTHORIZATION** |
| RA 12326 | `sc_elibrary` | yes           | SECOND_SOURCE_UNVERIFIED | UNKNOWN     | UNKNOWN       | none                 | **BLOCKED_AUTHORIZATION** |
| RA 12325 | `sc_elibrary` | yes           | SECOND_SOURCE_UNVERIFIED | UNKNOWN     | UNKNOWN       | none                 | **BLOCKED_AUTHORIZATION** |

Each document also has authenticity and legal-date blockers behind the first blocking condition. They are recorded in `corpus-readiness.json`.

## 3. Why each is blocked

| Blocker                                 | Evidence                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `authorization:UNKNOWN`                 | No counsel decision for any activity; 0 of 350 matrix cells determined            |
| `authenticity:SECOND_SOURCE_UNVERIFIED` | No independent government second source consulted; no archived publication record |
| `legal_dates:UNKNOWN`                   | All nine date fields are null/UNKNOWN; no evidence passage                        |
| `permitted_activities:none`             | No activity is authorized, so no ingestion activity may be scheduled              |

## 4. Readiness vocabulary

`NOT_ASSESSED` · `BLOCKED_AUTHORIZATION` · `BLOCKED_AUTHENTICITY` · `BLOCKED_LEGAL_DATES` · `BLOCKED_SOURCE_EVIDENCE` · `CONDITIONALLY_READY` · `READY_FOR_CONTROLLED_INGESTION`

No document reached `CONDITIONALLY_READY` or `READY_FOR_CONTROLLED_INGESTION`.

## 5. Target corpus

The target of approximately 20–50 documents remains **not started**. It would require counsel-approved sources and document-level determinations, independent authenticity evidence, verified dates, and a controlled-ingestion gate. Gate 4 does not create that gate and does not acquire any document.

## 6. Deletion and retention

No stored pilot material was deleted. If counsel prohibits retention, the owner-authorization document states the pilot directory will be deleted and the manifest marked withdrawn. That decision has not been made.
