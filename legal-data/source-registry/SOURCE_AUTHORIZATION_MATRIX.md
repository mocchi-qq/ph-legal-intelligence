# Source Authorization Matrix

**Date:** 2026-11-10
**Machine-readable companion:** `sources.authorization.json`

> **No source is approved for test or bulk use.** Every source is `UNKNOWN` / `NOT_REVIEWED`
> pending documented authorization and Philippine counsel review. Public accessibility is not
> permission. A `robots.txt` that allows crawling is not a reuse licence.

## Status vocabulary

`APPROVED_FOR_TEST` · `APPROVED_FOR_BULK` · `ATTRIBUTION_REQUIRED` · `RESTRICTED` ·
`PROHIBITED` · `UNKNOWN` · `PENDING_COUNSEL` · `NOT_REVIEWED`

`APPROVED_FOR_TEST` never implies `APPROVED_FOR_BULK`.

## Dimensions tracked separately

Legal authority · authenticity · completeness · currency · accessibility ·
reuse permission · redistribution permission · attribution obligation.
These are deliberately not collapsed into one score.

## Matrix

| Source ID            | Organisation                                    | Official status | Domain                    | Bulk access | Reuse   | Redistribution | Counsel  | Authorization status |
| -------------------- | ----------------------------------------------- | --------------- | ------------------------- | ----------- | ------- | -------------- | -------- | -------------------- |
| sc_elibrary          | Supreme Court of the Philippines                | official        | elibrary.judiciary.gov.ph | unknown     | unknown | unknown        | required | UNKNOWN              |
| lawphil              | Arellano Law Foundation                         | secondary       | lawphil.net               | unknown     | unknown | unknown        | required | UNKNOWN              |
| official_gazette     | Office of the President                         | official        | officialgazette.gov.ph    | unknown     | unknown | unknown        | required | UNKNOWN              |
| congress             | House of Representatives                        | official        | congress.gov.ph           | unknown     | unknown | unknown        | required | UNKNOWN              |
| senate               | Senate of the Philippines                       | official        | senate.gov.ph             | unknown     | unknown | unknown        | required | UNKNOWN              |
| bir                  | Bureau of Internal Revenue                      | official        | bir.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| dole                 | Department of Labor and Employment              | official        | dole.gov.ph               | unknown     | unknown | unknown        | required | UNKNOWN              |
| sec                  | Securities and Exchange Commission              | official        | sec.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| dti                  | Department of Trade and Industry                | official        | dti.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| npc                  | National Privacy Commission                     | official        | privacy.gov.ph            | unknown     | unknown | unknown        | required | UNKNOWN              |
| csc                  | Civil Service Commission                        | official        | csc.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| bsp                  | Bangko Sentral ng Pilipinas                     | official        | bsp.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| gppb                 | Government Procurement Policy Board             | official        | gppb.gov.ph               | unknown     | unknown | unknown        | required | UNKNOWN              |
| dof                  | Department of Finance                           | official        | dof.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| doj                  | Department of Justice                           | official        | doj.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| coa                  | Commission on Audit                             | official        | coa.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| comelec              | Commission on Elections                         | official        | comelec.gov.ph            | unknown     | unknown | unknown        | required | UNKNOWN              |
| dar                  | Department of Agrarian Reform                   | official        | dar.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |
| denr                 | Department of Environment and Natural Resources | official        | denr.gov.ph               | unknown     | unknown | unknown        | required | UNKNOWN              |
| ipophilippines       | Intellectual Property Office of the Philippines | official        | ipophil.gov.ph            | unknown     | unknown | unknown        | required | UNKNOWN              |
| nlrc                 | National Labor Relations Commission             | official        | nlrc.dole.gov.ph          | unknown     | unknown | unknown        | required | UNKNOWN              |
| cta                  | Court of Tax Appeals                            | official        | cta.judiciary.gov.ph      | unknown     | unknown | unknown        | required | UNKNOWN              |
| pcc                  | Philippine Competition Commission               | official        | phcc.gov.ph               | unknown     | unknown | unknown        | required | UNKNOWN              |
| insurance_commission | Insurance Commission                            | official        | insurance.gov.ph          | unknown     | unknown | unknown        | required | UNKNOWN              |
| prc                  | Professional Regulation Commission              | official        | prc.gov.ph                | unknown     | unknown | unknown        | required | UNKNOWN              |

## Technical evidence gathered (read-only)

Only `robots.txt` was checked. It records crawler directives, not copyright or reuse terms.

| Domain                    | Observation                                                                                   | Evidence file                                   | Interpretation                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| elibrary.judiciary.gov.ph | HTTP 404 for `/robots.txt`                                                                    | `evidence/robots-elibrary.judiciary.gov.ph.txt` | No robots.txt. Says nothing about reuse.                         |
| lawphil.net               | HTTP 404 for `/robots.txt`                                                                    | `evidence/robots-lawphil.net.txt`               | No robots.txt. Says nothing about reuse.                         |
| officialgazette.gov.ph    | HTTP 200; disallows `/cgi-bin`, `/wp-admin`, `/wp-includes`, `/wp-content`; declares sitemaps | `evidence/robots-officialgazette.gov.ph.txt`    | Public paths are crawlable by directive; still no reuse licence. |

## What would move a source to APPROVED_FOR_TEST / BULK

1. Archived terms of use and copyright notice with retrieval timestamp.
2. Written permission or a documented legal basis reviewed by Philippine counsel.
3. Attribution and linking approach accepted.
4. A signed counsel determination recorded against the source ID.

Until then the only permissible corpus is synthetic.
