# Limitations and Unknowns — Philippine Legal Intelligence Platform Research Runway

**Purpose:** Disclose the limitations of the research runway and enumerate what remains unknown, so future sessions and reviewers can judge the confidence of the findings and avoid treating research as authority.

**Status:** initial — created 2026-11-18 as part of R-10 / R-11.
**Boundary:** research-only. No legal corpus downloaded, no production DB populated, no D1 research tables, no ingestion of real Philippine legal text, no deployment, no authorization change, no push.

---

## 1. Scope limitations of the research runway

| # | Limitation | Explanation |
|---|------------|-------------|
| L-01 | **No real Philippine legal text is ingested.** | All Philippine work is on synthetic fixtures. Counsel determinations are 0; all 350 source-authorization cells are UNKNOWN; four pilot documents are BLOCKED_AUTHORIZATION. No conclusion about real PH text is valid until counsel authorizes a source × activity. |
| L-02 | **No D1 research tables, no vector index, no production DB population.** | Research memory is Markdown only under `docs/research/intelligence/`. D1 limits are cited from official documentation, not load-tested locally (workerd cannot start locally due to TCMalloc mmap failure). |
| L-03 | **No bulk downloads, no mirroring, no crawling, no scraping, no paywall circumvention.** | Research is limited to public pages, public documentation, and public data. Access failures (Official Gazette 403; international dossier's blocked sources) are recorded as access failures, not worked around. |
| L-04 | **Research is not legal advice and does not change authorization.** | No finding converts into a legal determination, reuse clearance, or authorization change. All Philippine legal-status, reuse, and effectivity questions are routed to qualified Philippine counsel. |
| L-05 | **Absence of observation is not proof of absence.** | "No citator / no API / no reuse licence observed" is recorded as an observed gap on the pages checked, not proof that none exists anywhere. |
| L-06 | **Vendor claims are not independently corroborated.** | Anycase (14,000+ users, 14 hours saved, corpus count 140k vs 160k), BatasDB, Digest AI claims are SOURCE CLAIM / VENDOR only. Not cited as market size. |
| L-07 | **No local Cloudflare runtime testing.** | workerd cannot start locally (TCMalloc `MmapAligned(1GiB)` fail on ARM64/PRoot). D1 verified remotely via HTTP API only; real-D1 binding behavior under concurrent load and failure injection is unverified locally. |
| L-08 | **No red-team or load testing.** | No red-team testing on the citation verifier or retrieval pipeline. No D1 load test at 10k/100k/1M document profiles. Cost estimates are from official pricing, not measured. |
| L-09 | **Existing security/threat docs predate AI/retrieval work.** | `docs/security/THREAT_MODEL.md` is STRIDE, design-level, pre-AI. Not yet reviewed against OWASP LLM01–LLM08. |

---

## 2. Unknowns (explicitly not resolved by this research)

| ID | Question | Why unknown | Who can resolve |
|----|----------|-------------|-----------------|
| U-01 | Which Philippine sources × activities will counsel authorize, and under what reuse/display terms? | Externally blocked; not researchable. | Qualified Philippine counsel (QP-01, B-01). |
| U-02 | What are the effectivity/publication rules per Philippine instrument type (RA, EO, PD, CA, BP, court rule, circular)? | Externally blocked; not researchable. | Qualified Philippine counsel (QP-02, B-02). |
| U-03 | Is fail-closed authorization enforced at every read path (retrieve, index build, verification)? | Requires code review + tests against repository; not yet completed as a research deliverable. | Engineering (QP-03, B-03/B-05). |
| U-04 | Does any research/retrieved content reach the model with instruction-following privilege? | Threat-model review vs OWASP LLM01–LLM08 not yet done. | Security review (QP-04, B-06). |
| U-05 | Which D1 limits bind at current and projected scale? | Not load-tested; D1 verified remotely only. | Engineering + real-D1 access (QP-05, B-07/B-12/B-15). |
| U-06 | Working read-time authorization for `retrieve`? | Code inspection needed. | Engineering (QP-06, B-08). |
| U-07 | `synthetic: true` ingestion exemption guard scope? | Code inspection needed. | Engineering (QP-07, B-04/B-09). |
| U-08 | Which sources will counsel authorize first / authorized source set for R1.5? | Externally blocked. | Qualified Philippine counsel (QP-08). |
| U-09 | OCR quality of the oldest needed Philippine decisions? | Not sampled; blocked until counsel authorizes a source. | Engineering (QP-09, B-10). |
| U-010 | Lawful storage/serving terms per candidate source under Philippine copyright/database rules? | Externally blocked; not researchable. | Qualified Philippine counsel (QP-10, B-11). |
| U-011 | Philippine citation-format frequency and conflict map? | Blocked until authorized corpus. | Engineering (QP-13, B-13). |
| U-012 | Restricted editorial citator (F14) legal defensibility with named reviewers? | Externally blocked; not researchable. | Qualified Philippine counsel (QP-14, B-18). |
| U-013 | D1 durability/recovery under real-D1 failure injection? | Gate 7 partial; workerd cannot start locally. | Engineering + real D1 remote (QP-15, B-15). |
| U-014 | Vectorize recall benefit over lexical search on Philippine legal text? | No evaluation set; blocked until authorized corpus. | Engineering (QP-11, B-16). |
| U-015 | Real Cloudflare cost at 10k/100k/1M document profiles? | Not load-tested. | Engineering (QP-12, B-12). |
| U-016 | Will a government API/structured feed appear for Philippine legislation? | Future possibility; monitor only. | Technology watch (QP-16, B-21). |
| U-017 | Will Anycase/BatasDB/Digest AI add a citator? | Vendor roadmap unknown; monitor only. | Technology watch (QP-17, B-22). |
| U-018 | Institutional verification API (F15) viability? | Post-R3; needs stable verifier. | Product/engineering (QP-18, B-23). |
| U-019 | Multi-language (Filipino/English) need? | User research not done. | Product (QP-19, B-24). |

---

## 3. Known data-quality issues (recorded as conflicts, not averaged)

| ID | Issue | Detail |
|----|-------|--------|
| DQ-01 | Anycase corpus count inconsistent | 140k vs 160k historically; user count "14,000+" unverified. Not cited as market size. |
| DQ-02 | D1 independent reports conflict with official positioning | Official: read-heavy, horizontally scalable. Independent: overload on small DBs despite indexes/read replication/caching. Treated as a known operational risk to monitor, not a blocker. |
| DQ-03 | Official Gazette inaccessible | HTTP 403 on homepage at 2026-11-18; prior observations noted but not re-verified. |
| DQ-04 | E-Library missing-month pattern | May recurs across 2012–2026; 2026 May, Sep–Nov unlinked as of 2026-11-18. Unresolved whether display bug or genuine gap. |

---

## 4. Source-quality distribution (this runway session)

| Level | Count | Sources |
|-------|-------|---------|
| A — Primary/Official | 9 | C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, P-01, P-02, PH-02 (Cloudflare docs, NPC, SC Judiciary) |
| B — Strong secondary | 0 | — |
| C — Informative | 4 | PH-01 (LawPhil), IT-01 (GlobaLex/NYU), P-03 (DataGuidance/NPC secondary) |
| D — Unverified | 2 | C-09, C-10 (independent experience reports — anecdotal, distinguished from verified fact) |

Note: vendor sources (Anycase, BatasDB, Digest AI) are recorded as SOURCE CLAIM, not assigned a Level A–D reliability rating for factual claims.

---

## 5. What research does NOT authorize

Research under this runway does **not**:

- Download, ingest, or index any Philippine legal document.
- Populate D1, R2, a vector index, or any production table with research data.
- Create D1 research tables or a research vector database.
- Change any source-authorization cell (stays at UNKNOWN) or counsel determination (stays at 0).
- Unblock the four pilot documents (stay BLOCKED_AUTHORIZATION).
- Deploy anything or push any branch.
- Change authorization state or grant any reuse permission.
- Substitute for qualified Philippine counsel on any legal-status, reuse, or effectivity question.

---

## 6. Mitigation plan for each limitation

| Limitation | Mitigation |
|------------|------------|
| L-01 (no real PH text) | Continue on synthetic fixtures; record B-01/B-02/B-11 as counsel-blocked; do not proceed to real-data ingestion until clearance. |
| L-02 (no local D1) | Verify D1 remotely via HTTP API where possible; mark load/failure tests as requiring remote D1 access. |
| L-03 (no crawling/scraping) | Record access failures as such; do not work around paywalls or blocks. |
| L-04 (not legal advice) | Every PH legal-status finding carries "not a legal determination" and routes to counsel. |
| L-05 (absence ≠ proof) | Phrase gaps as "observed gap on pages checked"; re-check if new evidence appears. |
| L-06 (vendor claims) | Label as SOURCE CLAIM; never cite as market size or fact. |
| L-07 (no local workerd) | Remote D1 testing only; document local limitation. |
| L-08 (no red-team/load test) | Add to backlog (B-14, B-15, B-12); defer until remote access available. |
| L-09 (pre-AI threat model) | Add B-06 (review THREAT_MODEL.md vs OWASP LLM01–LLM08). |

---

## 7. Statement

This research grants no legal permission, changes no authorization state, and implements no production change. Counsel determinations remain 0. All Philippine legal-status conclusions await qualified Philippine counsel.
