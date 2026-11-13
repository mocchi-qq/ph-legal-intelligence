# Gate 5 — Authenticity and Legal-Date Governance

**Date:** 2026-11-13

## 1. Separation rule

Reuse authorization, file integrity, source origin, document identity, authenticity and legal dates are separate determinations. A counsel reuse decision does not prove authenticity or effectivity. A hash match does not prove that a document is an authentic government instrument.

## 2. Authenticity states

| Dimension                     | States                                                        | Gate 5 result                                             |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| File integrity                | VERIFIED / FAILED / NOT_ASSESSED                              | VERIFIED for the four pilot files (hash matches manifest) |
| Source origin                 | VERIFIED / UNVERIFIED / CONFLICT / NOT_ASSESSED               | UNVERIFIED — no independent provenance confirmation       |
| Official publication evidence | PRESENT / NONE / NOT_ASSESSED                                 | NONE                                                      |
| Document identity             | VERIFIED / IDENTIFIER_PARSED / AMBIGUOUS / NOT_ASSESSED       | IDENTIFIER_PARSED                                         |
| Independent corroboration     | VERIFIED / SECOND_SOURCE_UNVERIFIED / CONFLICT / NOT_ASSESSED | SECOND_SOURCE_UNVERIFIED                                  |
| Authenticity assessment       | VERIFIED / NOT_VERIFIED / CONFLICT / NOT_ASSESSED             | NOT_VERIFIED                                              |

A second source is independent only when its provenance is genuinely separate and documented. Two URLs on the same site are not independent. A third-party legal website is not automatically authoritative. No second source was contacted and no access restriction was bypassed.

## 3. Legal date fields

Kept separate: enactment, approval, promulgation, publication, filing, effectivity, amendment, repeal and historical applicability.

All nine fields remain `UNKNOWN` for all four pilot documents. No date was inferred from a URL, title, search result, list page or retrieval timestamp. No counsel reuse determination is treated as date evidence.

## 4. Evidence required before readiness

A future controlled-ingestion assessment must record:

1. Official source record or issuing-agency confirmation.
2. Archived publication/promulgation evidence.
3. Effectivity evidence, including the triggering publication event where relevant.
4. Independent second-source corroboration with agreement/discrepancy notes.
5. Version evidence distinguishing current and historical text.
6. Counsel determination for reuse activities, kept separate from authenticity.

## 5. Status

No authenticity or legal-date status was promoted in Gate 5. The four pilot documents remain `BLOCKED_AUTHORIZATION`; authenticity and date blockers remain behind the authorization blocker.
