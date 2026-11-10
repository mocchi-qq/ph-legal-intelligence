# Data Source Register — Philippine Legal Intelligence Platform

**Retrieval date:** 2026-11-09
**Status:** All sources marked `acquisition_status: "Pending"` — no source marked `Approved` without documented evidence.

---

## Tier 1 — Core National Legal Authorities

| Source ID        | Name                    | Institution                      | Authority          | Jurisdiction | Coverage                                                                         | Access Method      | Reuse Review |
| ---------------- | ----------------------- | -------------------------------- | ------------------ | ------------ | -------------------------------------------------------------------------------- | ------------------ | ------------ |
| sc_elibrary      | Supreme Court E-Library | Supreme Court of the Philippines | official_primary   | PH           | supreme_court_decisions, national_statutes, court_issuances, executive_issuances | reviewed_connector | required     |
| lawphil          | LawPhil Project         | Arellano Law Foundation          | official_secondary | PH           | jurisprudence, statutes, legal_materials                                         | reviewed_connector | required     |
| official_gazette | Official Gazette        | Office of the President          | official_primary   | PH           | presidential_issuances, official_publications                                    | reviewed_connector | required     |
| congress         | Congress                | House of Representatives         | official_primary   | PH           | bills, legislative_records, legislative_history                                  | reviewed_connector | required     |
| senate           | Senate                  | Senate of the Philippines        | official_primary   | PH           | bills, resolutions, legislative_materials                                        | reviewed_connector | required     |

---

## Tier 2 — Executive and Regulatory Issuances

| Source ID | Name                                | Institution | Authority        | Jurisdiction | Coverage                                                                     | Access Method      | Reuse Review |
| --------- | ----------------------------------- | ----------- | ---------------- | ------------ | ---------------------------------------------------------------------------- | ------------------ | ------------ |
| bir       | Bureau of Internal Revenue          | BIR         | official_primary | PH           | revenue_regulations, revenue_memorandum_orders, revenue_memorandum_circulars | reviewed_connector | required     |
| dole      | Department of Labor and Employment  | DOLE        | official_primary | PH           | department_orders, labor_advisories                                          | reviewed_connector | required     |
| sec       | Securities and Exchange Commission  | SEC         | official_primary | PH           | memorandum_circulars, opinions, regulations                                  | reviewed_connector | required     |
| dti       | Department of Trade and Industry    | DTI         | official_primary | PH           | department_administrative_orders, consumer_protection_issuances              | reviewed_connector | required     |
| npc       | National Privacy Commission         | NPC         | official_primary | PH           | circulars, advisories, decisions, guidelines                                 | reviewed_connector | required     |
| csc       | Civil Service Commission            | CSC         | official_primary | PH           | memorandum_circulars, resolutions, rules                                     | reviewed_connector | required     |
| bsp       | Bangko Sentral ng Pilipinas         | BSP         | official_primary | PH           | circulars, regulations, supervisory_issuances                                | reviewed_connector | required     |
| gppb      | Government Procurement Policy Board | GPPB        | official_primary | PH           | procurement_policies, resolutions                                            | reviewed_connector | required     |
| dof       | Department of Finance               | DOF         | official_primary | PH           | department_orders, regulations                                               | reviewed_connector | required     |
| doj       | Department of Justice               | DOJ         | official_primary | PH           | department_circulars, opinions                                               | reviewed_connector | required     |

---

## Tier 3 — Specialized Authorities

| Source ID            | Name                                            | Institution | Authority        | Jurisdiction | Coverage                           | Access Method      | Reuse Review |
| -------------------- | ----------------------------------------------- | ----------- | ---------------- | ------------ | ---------------------------------- | ------------------ | ------------ |
| coa                  | Commission on Audit                             | COA         | official_primary | PH           | government_auditing, coa_decisions | reviewed_connector | required     |
| comelec              | Commission on Elections                         | COMELEC     | official_primary | PH           | election_laws, resolutions         | reviewed_connector | required     |
| dar                  | Department of Agrarian Reform                   | DAR         | official_primary | PH           | agrarian_reform_laws, issuances    | reviewed_connector | required     |
| denr                 | Department of Environment and Natural Resources | DENR        | official_primary | PH           | environmental_regulations          | reviewed_connector | required     |
| ipophilippines       | Intellectual Property Office of the Philippines | IPOPHL      | official_primary | PH           | ip_laws, administrative_decisions  | reviewed_connector | required     |
| nlrc                 | National Labor Relations Commission             | NLRC        | official_primary | PH           | labor_decisions, procedural_rules  | reviewed_connector | required     |
| cta                  | Court of Tax Appeals                            | CTA         | official_primary | PH           | tax_jurisprudence                  | reviewed_connector | required     |
| pcc                  | Philippine Competition Commission               | PCC         | official_primary | PH           | competition_regulations, decisions | reviewed_connector | required     |
| insurance_commission | Insurance Commission                            | IC          | official_primary | PH           | insurance_regulations              | reviewed_connector | required     |
| prc                  | Professional Regulation Commission              | PRC         | official_primary | PH           | professional_regulatory_issuances  | reviewed_connector | required     |

---

## Tier 4 — Local Government and Regional Materials

**Not yet registered.** Nationwide coverage requires:

- Provincial ordinances
- City ordinances
- Municipal ordinances
- Barangay ordinances (where published and lawfully obtainable)
- Local executive orders
- Local revenue codes
- Zoning ordinances
- Local regulatory issuances

**Potential sources:** LGU websites, official gazettes, public information offices, authorized local-government repositories.

**Geographic metadata structure:** `region → province → city/municipality → barangay`

**Do not claim nationwide ordinance coverage until every geographic coverage claim has been measured against actual collected records.**

---

## Acquisition Status Definitions

| Status         | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| **Approved**   | Collection and intended reuse reviewed and authorized |
| **Restricted** | Limited access or use conditions apply                |
| **Manual**     | Human-assisted collection required                    |
| **Pending**    | Technical or legal review outstanding                 |
| **Rejected**   | Acquisition method is prohibited or unacceptable      |

**All sources in this register currently have `acquisition_status: "Pending"`.** No source is marked `Approved` without documented evidence of authorized reuse rights.

---

## Access Policy

- The platform must not bypass authentication, CAPTCHAs, paywalls, access controls, or technical restrictions.
- Public accessibility does not automatically mean unrestricted commercial redistribution.
- Each source requires a `reuse_review` before bulk ingestion.
- `access_method: "reviewed_connector"` indicates a purpose-built, reviewed ingestion connector.
