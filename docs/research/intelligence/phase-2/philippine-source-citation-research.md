# Phase 2 — Philippine Source & Citation Research

**Part of:** Research Roadmap (roadmap.md), Phase 2.
**Status:** In Progress — counsel-gated; preparatory work (B-21 government API monitoring, citation-format inventory from public sources) in progress.
**Research questions:** QP-09, QP-10, QP-13, QP-14, QP-16.
**Backlog items:** B-10, B-11, B-13, B-18, B-21.
**Counsel-gated items:** B-10 (OCR quality — needs authorized source), B-11 (lawful storage/serving terms — counsel), B-13 (citation-format frequency on authorized corpus — needs authorized corpus), B-18 (editorial citator defensibility — counsel).
**Non-counsel-gated items:** B-21 (government API/structured feed monitoring — public sources only), preparatory citation-format inventory (public sources only).

---

## 2.1 B-21 — Government API / structured data feed monitoring (NOT counsel-gated)

**Objective:** Determine whether a government API or structured data feed exists for Philippine legislation (Official Gazette / Congress / Senate), which would drop acquisition cost and shift the moat to verification/workflow.

**Evidence needed:**
- Whether Official Gazette (officialgazette.gov.ph) offers any machine-readable API or structured feed
- Whether Congress of the Philippines (congress.gov.ph) offers a legislative tracking/bill API
- Whether the Senate of the Philippines (senate.gov.ph) offers a legislative API
- Whether any PH government open-data portal hosts legislative/legal data in structured form
- Terms of use / reuse licence for any such feed

**Sources to check (public, no scraping):**
- Official Gazette website (note: previously returned HTTP 403 at 2026-11-18 — access failure recorded, do not work around)
- Congress of the Philippines website
- Senate of the Philippines website
- PH open data portal (data.gov.ph)
- SC E-Library (already verified: no API)

**Status:** In Progress — findings below (public research, no scraping).

## Findings (B-21 — public research, verified 2026-11-18)

### Official government sources — no machine-readable legislative API found

| Source | API / structured feed? | Details | Reliability |
|--------|----------------------|---------|-------------|
| **Official Gazette** (officialgazette.gov.ph / gov.ph) | **None found** | Previously returned HTTP 403 on homepage at 2026-11-18 (access failure — recorded, not worked around). No API or structured feed identified. Publication-oriented, not a research system. | VERIFIED FACT (access failure) + secondary observation |
| **Congress of the Philippines** (congress.gov.ph) | **None found (official)** | LEGIS Search (congress.gov.ph/legis) is a web UI for browsing bills 8th–20th Congress. House Bills & Resolutions page (congress.gov.ph/legislative-documents) is search/filter UI. No public REST API documented on the official site. | SECONDARY (web UI observed; no API documented) |
| **Senate of the Philippines** (senate.gov.ph) | **None found (official)** | Senate Bills page (senate.gov.ph/legislative-documents/bills) is a search UI. Issuances Library (issuances-library.senate.gov.ph) hosts PDFs. No public REST API documented. | SECONDARY (web UI observed; no API documented) |
| **Presidential Communications Office** (pco.gov.ph) | **None found (official)** | Issuances Archive hosts Executive Orders as PDF downloads. No API. | SECONDARY |
| **data.gov.ph (Open Data Philippines)** | Portal exists; legislative dataset not verified | Official open data portal managed by the Open Data Philippines Task Force. Datasets page exists (data.gov.ph/index/public/dataset/). No legislative/legal dataset confirmed in this research session. | SECONDARY (portal exists; dataset not verified) |
| **SC E-Library** (elibrary.judiciary.gov.ph) | **None found (official)** | Homepage and search page are web UI only. Monthly decision index has missing/unlinked months (May recurs across years). No citator, no API, no public reuse licence displayed. NPC registration certificate displayed on site. | VERIFIED FACT (direct observation of live page and search page) |
| **SC main site** (sc.judiciary.gov.ph) | **None found (official)** | SC decisions with G.R. numbers and promulgation dates; court locator. Web UI only. | VERIFIED FACT |

### Third-party / community legislative APIs (NOT official government)

| Source | Type | Details | Reliability |
|--------|------|---------|-------------|
| **Open Congress API** (open-congress-api.bettergov.ph) | Third-party REST API | Modern REST API (Deno + Neo4j) for Philippine congressional data: bills, senators, representatives, congresses. OpenAPI 3.0 docs at /api/scalar. Data is **manually encoded** — "may contain inaccuracies." Public domain unless otherwise specified. GitHub: bettergovph/open-congress-api + open-congress-data. | THIRD-PARTY / VENDOR — manually encoded, not official |
| **BatasWatch** (bills.juris.ph/api) | Third-party JSON API | Public JSON API for Philippine bills, authors, committees, policy areas. | THIRD-PARTY / VENDOR — not verified independently |
| **LawPhil** (lawphil.net) | Secondary compilation (Arellano Law Foundation) | **Reuse licence displayed:** Creative Commons Attribution-Non-Commercial 4.0 Philippine license (lawphil.net/copyright.html). Acceptable Use Policy: informational only, accuracy disclaimed, no legal advice, grants no legal authority (lawphil.net/usepolicy.html). **No citator or API.** AsianLII mirror noted. Statutes/Issuances/Court Decisions are works of the Philippine Government; the Lawphil collection itself is CC BY-NC 4.0 PH licensed by Arellano Law Foundation. | VERIFIED FACT (copyright + AUP pages read) |

### Interpretation for B-21

**No official Philippine government API or structured legislative data feed was found.** The Official Gazette, Congress, Senate, PCO, and SC E-Library expose web UIs and PDF downloads only, not machine-readable APIs. data.gov.ph exists as an open data portal but no legislative dataset was confirmed.

Third-party APIs exist (Open Congress API by BetterGov.ph, BatasWatch) but are community-managed, manually encoded, and not official government sources — so they carry accuracy risk and cannot be treated as authoritative legal data.

**Correction to earlier finding (F-A-4 / F-I-4):** LawPhil **does** display a reuse licence — Creative Commons Attribution-Non-Commercial 4.0 Philippine license (lawphil.net/copyright.html). However, LawPhil is a **secondary** compilation by the Arellano Law Foundation (not an official government source), and it carries an explicit accuracy disclaimer and no citator/API. The broader finding stands: **no official Philippine government source** (Official Gazette, Congress, Senate, SC E-Library, SC main site) displays a reuse licence. Public availability ≠ redistribution permission remains valid for official sources. LawPhil's CC BY-NC 4.0 PH license is non-commercial, so commercial reuse would still require clearance.

**Impact on the project:** The project cannot rely on a government structured feed to drop acquisition cost. Acquisition of Philippine legislative/jurisprudence text will require authorized sources + ingestion pipeline (counsel-gated), consistent with the existing boundary (no real PH text until counsel authorization). The moat remains verification/authority tracking, not bulk acquisition — aligning with D-01/D-08 (reject bulk acquisition; build authority layer).

**Status:** Findings documented; item complete at documentation level.

## 2.2 Preparatory citation-format inventory (NOT counsel-gated)

**Objective:** Inventory Philippine citation formats for the same case from public secondary sources, to inform the citation parser/resolver (F4) robustness. This does NOT require an authorized corpus — it documents formats observed in public legal commentary/secondary sources.

**Evidence needed:**
- Common Philippine case citation formats (G.R. No., SCRA, Phil., etc.)
- How the same case is cited across different sources (format conflicts)
- Statute citation formats (Republic Act number, section, etc.)
- Frequency of conflicts (qualitative, from public sources)

**Status:** Not started.

---

## 2.3 Counsel-gated items (blocked — not researchable by this runway)

| Item | Blocker | Resolution needed |
|------|---------|-------------------|
| B-10 | OCR quality of oldest needed Philippine decisions | Needs counsel-authorized source to sample |
| B-11 | Lawful storage/serving terms per candidate source | Qualified Philippine counsel determination |
| B-13 | Citation-format frequency & conflict map | Needs authorized corpus (counsel determination first) |
| B-18 | Editorial citator (F14) legal defensibility | Qualified Philippine counsel + named reviewers |

---

## Boundary confirmation

- No legal corpus downloaded. No production DB populated. No D1 research tables created. No documents ingested. No vector index created for research. No deployment. No push. No authorization state changed.
- All research on public pages/documentation only. No scraping, no crawling, no paywall circumvention.
- Counsel determinations remain 0; all 350 source-authorization cells UNKNOWN; 4 pilot docs BLOCKED_AUTHORIZATION.
