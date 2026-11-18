# Research Backlog — Philippine Legal Intelligence Platform

**Purpose:** Prioritized backlog of research recommendations, open questions, and capability gaps derived from the synthesized research findings (research-findings.md), research questions (research-questions.md), capability matrix (capability-matrix.md), and domain syntheses. Each item carries an ID, priority, source linkage, dependencies, and current status.

**Status:** initial — created 2026-11-18 as part of R-10.
**Boundary:** research-only. No legal corpus downloaded, no production DB populated, no D1 research tables, no ingestion of real Philippine legal text, no deployment, no authorization change, no push.

---

## How backlog items map to decisions

Backlog items feed `decisions.md` (statuses NEW → INVESTIGATING → EVIDENCE_INSUFFICIENT → RECOMMENDED → ACCEPTED → DEFERRED → REJECTED → IMPLEMENTED → VERIFIED → SUPERSEDED). Research never implements a change directly; an ACCEPTED recommendation routes through the project's normal development workflow (gate → code → test → review).

---

## P0 — Critical (blocks real-data work, correctness, security, authorization)

| ID | Title | Domain | Source linkage | Dependencies | Status |
|----|-------|--------|----------------|--------------|--------|
| B-01 | Obtain qualified Philippine counsel determination on QP-01: which Philippine sources × activities are authorized, and under what reuse/display terms | I / A | QP-01; F-I-5, F-I-6; F-A-10; PH-01, PH-02 | None (externally blocked — not researchable) | NEW |
| B-02 | Obtain qualified Philippine counsel determination on QP-02: effectivity/publication rules per Philippine instrument type (RA, EO, PD, CA, BP, court rule, circular) | I / A | QP-02; F-I-6 | None (externally blocked — not researchable) | NEW |
| B-03 | Close capability gap: read-time authorization for `retrieve` (holding an index is currently sufficient to search it — an enforcement gap) | Authorization | QP-06; capability-matrix row "Authorization" | Code review + test against repository | NEW |
| B-04 | Close capability gap: `synthetic: true` ingestion exemption still allows callers to skip four activity checks (`synthetic://` URL prefix only) | Authorization | QP-07; capability-matrix row "Authorization" | Code inspection + test | NEW |
| B-05 | Verify fail-closed authorization (NOT_CHECKED → UNKNOWN) is enforced at every read path (retrieve, index build, verification) — no single fail-open path | Authorization | QP-03; F-H-4; current-state gate 12/13/14 | Code review + tests | NEW |
| B-06 | Review existing THREAT_MODEL.md against OWASP LLM01–LLM08 before any AI feature is gated behind the verifier | Security | QP-04; F-H-5; THREAT_MODEL.md (design-level, pre-AI) | Security review | NEW |

---

## P1 — High (material improvement to reliability, authority tracking, citation verification, retrieval, core UX, operational safety)

| ID | Title | Domain | Source linkage | Dependencies | Status |
|----|-------|--------|----------------|--------------|--------|
| B-07 | Confirm which D1 limits (10 GB/DB, single-threaded, 50 queries/free invocation, 50 MB result cap) bind the project at current and projected scale; decide sharding/read-replica strategy before the 10 GB cap | F / G | QP-05; F-G-1, F-G-2, F-G-6; C-01, C-02 | None (docs verified; load test optional) | NEW |
| B-08 | Verify working read-time authorization for `retrieve` exists (backlog item B-3 overlap — confirm not already covered) | Authorization | QP-06 | Code inspection + test | NEW |
| B-09 | Confirm `synthetic: true` ingestion exemption guard is only a `synthetic://` URL prefix and close it (overlap with B-4 — confirm single owner) | Authorization | QP-07 | Code inspection + test | NEW |
| B-10 | Sample OCR quality of oldest needed Philippine decisions to assess coverage cost and ingestion feasibility | A | QP-09 | Sample scanned decisions (blocked until counsel authorizes a source) | NEW |
| B-11 | Determine lawful storage/serving terms for each candidate source's text under Philippine copyright/database rules (ingestion + display gate) | I | QP-10; F-I-4, F-I-5 | Counsel determination | NEW |
| B-12 | Benchmark Cloudflare/D1 cost at 10k / 100k / 1M document profiles for business model and capacity planning | G | QP-12; F-G-2, F-G-5; C-02 | Not load-tested; estimate from official pricing | NEW |
| B-13 | Map Philippine citation formats for the same case, conflict frequency, to drive citation parser/resolver (F4) robustness | E | QP-13 | Corpus-wide citation extraction on authorized data (blocked until counsel) | NEW |
| B-14 | Add D1 overload handling: retry read-only queries, do not retry writes, surface overload as retryable transient error with backoff | G | F-G-4, F-G-5; recommendation F-G-6 point 6 | Real D1 (remote) | NEW |
| B-15 | Run real-D1 failure-injection test to confirm commit-marker recovery pattern under failure (durability/recovery behavior) | F / G | QP-15; Gate 7 partial; C-05/C-06 | Real D1 remote (workerd cannot start locally) | NEW |

---

## P2 — Medium (useful improvements, meaningful but noncritical)

| ID | Title | Domain | Source linkage | Dependencies | Status |
|----|-------|--------|----------------|--------------|--------|
| B-16 | Benchmark Vectorize recall over lexical search on Philippine legal text, without exact-citation regression; add only with a measured evaluation set | E / G | QP-11; F-G-8; capability-matrix row "Reranking" | Evaluation set; blocked until authorized data | NEW |
| B-18 | Investigate restricted editorial citator (F14) legal defensibility in the Philippines with named reviewers; reviewer liability/insurance | A / I | QP-14; F-A-1 (no public citator gap) | Counsel | NEW |
| B-19 | Design horizontal scale-out: per-source/per-tenant D1 databases with scatter-gather in the Worker before the 10 GB cap | G | F-G-2, F-G-6; C-10 | Real-D1 load data | NEW |
| B-20 | KV usage audit: confirm KV is used only for session/cache, never authorization state (eventual consistency, 1 write RPS/key) | G / Security | QP-04; F-G-7; capability-matrix row "Authorization" | Code inspection | NEW |

---

## P3 — Exploratory (speculative, trends, future opportunities)

| ID | Title | Domain | Source linkage | Dependencies | Status |
|----|-------|--------|----------------|--------------|--------|
| B-21 | Monitor whether a government API or structured data feed appears for Philippine legislation (Official Gazette / Congress / Senate) — would drop acquisition cost | A | QP-16; F-A-6 | Monitor sources | NEW |
| B-22 | Monitor Anycase/BatasDB/Digest AI for citator addition; narrows window to authority-state moat | A | QP-17 | Monitor vendor pages | NEW |
| B-23 | Evaluate institutional verification API (F15) — B2B revenue; needs stable verifier + terms | Product | QP-18; capability-matrix row "API" | Post-R3; verifier stable | NEW |
| B-24 | Assess multi-language (Filipino/English) UI or legal-text handling needs | Product | QP-19 | User research | NEW |

---

## Items already closed / answered this cycle

| ID | Title | Resolution | Source |
|----|-------|------------|--------|
| QC-01 | D1 hard limits and pricing | Verified (C-01, C-02) | research-questions.md |
| QC-02 | NPC AI guidelines | Advisory No. 2024-04 confirmed (P-01) | research-questions.md |
| QC-03 | Prompt injection is top LLM risk | OWASP LLM01:2025 confirmed (S-01, S-03) | research-questions.md |
| QC-04 | Philippine legal resources and gaps | SC E-Library / Gazette / LawPhil / Anycase mapped (PH-01, PH-02, IT-01) | research-questions.md |

---

## Notes

- **Counsel-blocked items:** B-01, B-02, B-05 (partially), B-11, B-13, B-18 require qualified Philippine counsel and are not researchable by this runway. They are recorded here so they are visible, prioritized, and routed to human decision — not assumed answered.
- **Authorization state is constant:** 0 counsel determinations; all 350 source-authorization cells UNKNOWN; four pilot documents BLOCKED_AUTHORIZATION. No backlog item changes this.
- **No duplication:** This backlog does not duplicate `docs/research/international-legal-tech/` items already covered there (international platforms, retrieval/AI comparison, authority/temporal, citations, product positioning, evaluation, commercial models, roadmap R0–R5). It adds the Philippine-specific, Cloudflare-specific, security-specific, and privacy-specific backlog.
