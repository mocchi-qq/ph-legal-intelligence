# I — Privacy, Licensing, and Legal Risk

**Domain:** I (privacy, licensing, legal risk)
**Research date:** 2026-11-18
**Status:** synthesized
**Source register:** `docs/research/intelligence/source-register.md` (P-01, P-02, P-03; plus S12 LawPhil AUP from international dossier)
**Constraint:** never convert a research conclusion into a legal determination. Flag matters requiring qualified Philippine counsel.

## 1. Philippine Data Privacy Act (RA 10173) — verified

| Element | Verified detail |
|---------|-----------------|
| Law | Republic Act No. 10173, Data Privacy Act of 2012 |
| Effective | 8 September 2012 |
| Regulator | National Privacy Commission (NPC), established 2016 |
| Implementing Rules | IRR enforceable 9 September 2016 |
| Scope | Collection, recording, organization, storage, updating/modification, retrieval, consultation, use, consolidation, blocking, erasure, destruction of personal data |
| Lawful basis | Sections 12 and 13 of the DPA |
| Public data | Publicly available personal data does **not** lose DPA protection simply because it is public (NPC Advisory, EA and TA v. EJ) |

## 2. NPC Advisory No. 2024-04 (AI guidelines) — verified (full text read)

Issued 19 December 2024. Applies the DPA, IRR, and NPC issuances to **AI systems processing personal data, including training and testing**. Key provisions:

- **Transparency:** inform data subjects of nature, purpose, extent of processing; explain purpose, factors/inputs, risks, output, impact, dispute mechanisms.
- **Accountability:** PIC remains accountable even when processing is outsourced; demonstrable measures; governance mechanisms.
- **Human intervention:** meaningful human intervention for automated decisions with significant risk; right to question and contest automated decisions.
- **Fairness:** no AI washing; identify and monitor bias.
- **Accuracy:** keep personal data correct and up to date.
- **Data minimization:** exclude by default personal data unlikely to improve the AI system.
- **Lawful basis:** determine under Sections 12–13 before processing.
- **Data subject rights:** object, rectification, erasure/blocking; mechanisms before/during/after AI development/deployment.

## 3. Data scraping advisory

- NPC Advisory No. 2026-01 (reported 2026-06-15): guidelines for lawful data scraping of publicly available personal data. (Secondary report; primary text not read.)
- LawPhil AUP: informational only; no warranty of accuracy; verify independently; no legal advice; **grants a Creative Commons Attribution-NonCommercial 4.0 Philippine license** (lawphil.net/copyright.html), non-commercial — commercial reuse still requires clearance.

## 4. Relevance to the platform

| Area | Implication | Research-only (no legal determination) |
|------|-------------|----------------------------------------|
| User queries / saved research | May contain personal data → DPA applies if the platform is a PIC | Needs counsel review; PIA likely required |
| AI answers over retrieved text | If personal data is in retrieved docs or training data, Advisory 2024-04 applies | Counsel + human-in-the-loop |
| Legal corpus (Philippine laws/cases) | Primary law is generally not personal data, but annotations/pleadings may contain personal data | Counsel review per source |
| Research runway itself | Reading public pages only; no personal data collected | No DPA issue for research |
| Retention/deletion | Data subject rights (erasure/rectification) apply to user data | Counsel review |
| Cross-border | Cloudflare D1 `us` jurisdiction option exists; data residency may matter | Counsel review |

## 5. Licensing / reuse risk (verified)

- **No Philippine official source (E-Library, Gazette) displays a reuse licence.** LawPhil is a secondary compilation (Arellano Law Foundation) and displays a CC BY-NC 4.0 Philippine license (non-commercial; commercial reuse still requires clearance). The E-Library displays no reuse terms. The Gazette was inaccessible (403).
- **Public availability ≠ reuse permission.** Publicly posted legal text may still be subject to terms; redistribution, AI training, and commercial reuse require clearance.
- **AI training restrictions:** model/provider terms may prohibit training on retrieved content; do not train on unlicensed corpus.

## 6. Recommendations (research-backed, not legal advice)

1. **Flag all Philippine legal-status, reuse, and effectivity questions for qualified Philippine counsel.** Do not treat research findings as legal determinations.
2. **Before any real Philippine text enters the pipeline:** obtain counsel determination on source × activity, reuse/display permission, and effectivity rules (project's R1.5 gate already codifies this).
3. **If the platform handles user personal data:** conduct a PIA, appoint a PIC/PIP, implement privacy-by-design, and provide data-subject-rights mechanisms (object, rectify, erase).
4. **Do not train AI models on retrieved/unlicensed content.** Provider terms may restrict it; DPA applies to training data containing personal data.
5. **Document retention and deletion** for user research data; support erasure requests.
6. **Consider data residency** (D1 `us` jurisdiction option) if Philippine data residency becomes required.

## 7. What remains unverified

- Whether any Philippine official source offers a machine-readable data licence or API (owner + counsel).
- The precise scope of personal data in Philippine court decisions and statutes (counsel).
- NPC enforcement posture toward legal-AI platforms (no public guidance beyond Advisory 2024-04).

## 8. Boundary statement

This research grants no legal permission and changes no authorization state. Counsel determinations remain 0. All Philippine legal-status conclusions await qualified Philippine counsel.
