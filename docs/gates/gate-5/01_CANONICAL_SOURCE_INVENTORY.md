# Gate 5 — Canonical Source Inventory

**Date:** 2026-11-13  
**Machine-readable:** `source-inventory.json`  
**Sources:** 25, unchanged  
**Counsel determinations:** 0

## 1. First-review selection

`sc_elibrary` (Supreme Court E-Library) is **selected_for_initial_counsel_review** because it is the source of all four owner-authorized pilot documents. This designation means only that the source is first in the review queue. It does **not** mean authorized, verified, approved, safe for ingestion, or approved for commercial use.

The other four Tier 1 sources remain separately identifiable and are not equivalent or authorized:

| Source ID          | Name                    | Tier 1 | First review |
| ------------------ | ----------------------- | ------ | ------------ |
| `sc_elibrary`      | Supreme Court E-Library | yes    | yes          |
| `lawphil`          | LawPhil Project         | yes    | no           |
| `official_gazette` | Official Gazette        | yes    | no           |
| `congress`         | Congress                | yes    | no           |
| `senate`           | Senate                  | yes    | no           |

## 2. Canonical field

The canonical metadata is now `selected_for_initial_counsel_review` in `legal-data/source-registry/sources.json`, mirrored in `source-inventory.json`. `tier1_designated` preserves the five historical Tier 1 designations. No source ID was changed or deleted.

## 3. All sources

| Source ID              | Name                                            | Owner/publisher                                 | Category           | Tier 1 | First review | Authorization | Authenticity | Legal dates  |
| ---------------------- | ----------------------------------------------- | ----------------------------------------------- | ------------------ | ------ | ------------ | ------------- | ------------ | ------------ |
| `sc_elibrary`          | Supreme Court E-Library                         | Supreme Court of the Philippines                | official_primary   | yes    | yes          | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `lawphil`              | LawPhil Project                                 | Arellano Law Foundation                         | official_secondary | yes    | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `official_gazette`     | Official Gazette                                | Office of the President of the Philippines      | official_primary   | yes    | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `congress`             | Congress                                        | House of Representatives of the Philippines     | official_primary   | yes    | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `senate`               | Senate                                          | Senate of the Philippines                       | official_primary   | yes    | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `bir`                  | Bureau of Internal Revenue                      | Bureau of Internal Revenue                      | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `dole`                 | Department of Labor and Employment              | Department of Labor and Employment              | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `sec`                  | Securities and Exchange Commission              | Securities and Exchange Commission              | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `dti`                  | Department of Trade and Industry                | Department of Trade and Industry                | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `npc`                  | National Privacy Commission                     | National Privacy Commission                     | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `csc`                  | Civil Service Commission                        | Civil Service Commission                        | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `bsp`                  | Bangko Sentral ng Pilipinas                     | Bangko Sentral ng Pilipinas                     | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `gppb`                 | Government Procurement Policy Board             | Government Procurement Policy Board             | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `dof`                  | Department of Finance                           | Department of Finance                           | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `doj`                  | Department of Justice                           | Department of Justice                           | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `coa`                  | Commission on Audit                             | Commission on Audit                             | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `comelec`              | Commission on Elections                         | Commission on Elections                         | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `dar`                  | Department of Agrarian Reform                   | Department of Agrarian Reform                   | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `denr`                 | Department of Environment and Natural Resources | Department of Environment and Natural Resources | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `ipophilippines`       | Intellectual Property Office of the Philippines | Intellectual Property Office of the Philippines | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `nlrc`                 | National Labor Relations Commission             | National Labor Relations Commission             | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `cta`                  | Court of Tax Appeals                            | Court of Tax Appeals                            | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `pcc`                  | Philippine Competition Commission               | Philippine Competition Commission               | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `insurance_commission` | Insurance Commission                            | Insurance Commission                            | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |
| `prc`                  | Professional Regulation Commission              | Professional Regulation Commission              | official_primary   | no     | no           | UNKNOWN       | NOT_ASSESSED | NOT_ASSESSED |

## 4. Missing facts

URLs, owners and categories are the values already recorded in the registry. Where a fact is not recorded it is represented as `null`, `UNKNOWN` or `NOT_ASSESSED`; it was not inferred. Source terms, copyright notices and written permissions remain uncaptured for every source.

## 5. What did not change

- No source authorization status changed.
- No source was marked verified or authentic.
- No counsel determination was recorded.
- The four pilot documents remain `BLOCKED_AUTHORIZATION`.
- No new real document was acquired.
