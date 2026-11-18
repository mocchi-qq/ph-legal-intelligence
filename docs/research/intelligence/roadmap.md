# Research Roadmap — Philippine Legal Intelligence Platform

**Purpose:** Prioritized phased research roadmap derived from `research-backlog.md`, `research-questions.md`, `research-findings.md`, and `capability-matrix.md`. Each phase states its research objective, the questions it answers, the evidence it needs, its dependencies, its output, and its status.

**Status:** initial — created 2026-11-18 as part of R-10.
**Boundary:** research-only. No legal corpus downloaded, no production DB populated, no D1 research tables, no ingestion of real Philippine legal text, no deployment, no authorization change, no push.

---

## How the roadmap relates to development

Research phases inform, but do not implement, development. An ACCEPTED research recommendation routes through the project's normal gate-driven workflow (design → code → test → review → gate acceptance). Development phases (Gates 11–19, R0–R5 from the existing international dossier) remain owned by the engineering team; this roadmap covers only the research that enables them.

---

## Phase 0 — Baseline and authorization resolution (immediate / P0)

**Objective:** Establish the verified project baseline and resolve the authorization gate that blocks all real-data work.

**Research questions answered:** QP-01, QP-02 (counsel determinations), QP-03, QP-04, QP-06, QP-07.

**Backlog items:** B-01, B-02, B-03, B-04, B-05, B-06.

**Evidence needed:**
- Qualified Philippine counsel determination on which Philippine sources × activities are authorized and under what reuse/display terms (externally blocked — not researchable).
- Qualified Philippine counsel determination on effectivity/publication rules per instrument type (externally blocked).
- Code review and tests confirming fail-closed authorization (NOT_CHECKED → UNKNOWN) at every read path.
- Code inspection confirming the `synthetic: true` ingestion exemption guard scope.
- Threat-model review against OWASP LLM01–LLM08.

**Dependencies:** None internal; B-01/B-02 are externally blocked by counsel availability.

**Output:**
- `decisions.md` populated with authorization-related recommendations (NEW → RECOMMENDED, awaiting counsel).
- Authorization-readiness memo *template* documenting required read-path verification (fail-closed enforcement); findings pending completion of backlog items B-03 (read-time auth) and B-05 (fail-closed enforcement at every read path).
- Security threat-model addendum covering LLM01–LLM08 (pending B-06).

**Status:** In Progress (baseline documents complete; counsel-blocked items awaiting external determination).

---

## Phase 1 — Cloudflare/D1 operational verification (P1, short term)

**Objective:** Verify the production data plane (Cloudflare Workers + D1 + R2) against real usage patterns so the project can decide whether D1 remains the metadata store or needs scale-out design before the 10 GB cap.

**Research questions answered:** QP-05, QP-12, QP-15.

**Backlog items:** B-07, B-12, B-14, B-15, B-19.

**Evidence needed:**
- Official D1 limits/pricing (already verified: C-01, C-02) — confirmed sufficient for current synthetic scale.
- Load/cost estimate at 10k / 100k / 1M document profiles (not load-tested).
- D1 overload behavior and handling pattern (retry reads, don't retry writes; backoff).
- Real-D1 failure-injection test confirming commit-marker recovery (Gate 7 partial; workerd cannot start locally, so real D1 via remote HTTP API only).
- Horizontal scale-out design: per-source/per-tenant D1 DBs with scatter-gather.

**Dependencies:** Real D1 access (remote). Local workerd cannot start (TCMalloc mmap fail) — all real-D1 verification must be remote.

**Output:**
- D1 capacity-and-cost brief with per-profile estimates.
- Overload-handling design note.
- Real-D1 failure-injection result (remote).
- Scale-out architecture recommendation.

**Status:** Not started (D1 docs verified; load test and failure injection pending remote access).

---

## Phase 2 — Philippine source and citation research (P1–P2, counsel-gated)

**Objective:** Map the Philippine source landscape in detail (citation formats, effectivity rules, OCR quality) to inform the citation resolver (F4), temporal model, and ingestion feasibility — but only for sources counsel authorizes.

**Research questions answered:** QP-09, QP-10, QP-13, QP-14, QP-16.

**Backlog items:** B-10, B-11, B-13, B-18, B-21.

**Evidence needed:**
- Counsel-authorized source list (R1.5 gate).
- OCR quality sample of oldest needed Philippine decisions (blocked until counsel authorizes a source).
- Lawful storage/serving terms per candidate source under Philippine copyright/database rules (counsel).
- Philippine citation-format frequency and conflict map (blocked until authorized corpus).
- Editorial citator (F14) legal defensibility with named reviewers (counsel).
- Monitoring watch on government API/structured feed for Philippine legislation (Official Gazette / Congress / Senate).

**Dependencies:** B-01/B-02 counsel determinations (externally blocked).

**Output:**
- Authorized source × activity matrix (from counsel, recorded, not created by research).
- Citation-format inventory for authorized sources.
- OCR-quality brief.
- Licensing/reuse clearance memo (counsel-sourced).

**Status:** Blocked (awaits counsel determinations B-01/B-02).

---

## Phase 3 — Capability and evaluation research (P2, medium term)

**Objective:** Evaluate optional capabilities (Vectorize recall, institutional verification API, editorial citator) against measured evidence before adoption.

**Research questions answered:** QP-11, QP-18, QP-23 (multi-language), QP-24 (institutional API).

**Backlog items:** B-16, B-20, B-23, B-24.

**Evidence needed:**
- Measured evaluation set for Philippine legal text before any Vectorize adoption.
- Exact-match and lexical search baseline (must remain before any vector recall booster).
- Stable verifier for institutional API (F15) — post-R3.
- Multi-language need assessment (user research; defer).

**Dependencies:** Authorized corpus (for citation/eval); stable verifier.

**Output:**
- Vectorize go/no-go recommendation with benchmark results.
- Institutional API feasibility note (post-R3).
- Multi-language deferral note.

**Status:** Not started.

---

## Phase 4 — Competitor and technology watch (P3, ongoing)

**Objective:** Keep the Philippine and competitor landscape current without re-researching settled questions.

**Research questions answered:** QP-17, QP-21, QP-22.

**Backlog items:** B-22 (Anycase/BatasDB/Digest AI citator watch), plus recurring monitoring.

**Evidence needed:**
- Vendor page monitoring (Anycase, BatasDB, Digest AI) for citator addition.
- Technology watch on Cloudflare D1/Workers changes affecting the stack decision.

**Dependencies:** None.

**Output:**
- Quarterly watch brief (market, citator movement, stack changes).
- Updates to `research-findings.md` contradictions/unresolved items as new evidence arrives.

**Status:** Not started (ongoing watch, low frequency).

---

## Phase ordering and dependency summary

```
Phase 0 (baseline + authorization) ──counsel-blocked──> Phase 2 (PH sources/citations)
      │                                                        │
      └────────────────────────────────────────────────────────┘
Phase 1 (Cloudflare/D1 ops) ─────────────────────────────────┐
                                                             ▼
                                                     Phase 3 (capability/eval)
                                                             │
                                                     Phase 4 (watch, ongoing)
```

Phase 0 and Phase 1 are independent and can proceed in parallel. Phase 2 is blocked on counsel determinations from Phase 0. Phase 3 needs an authorized corpus/eval set from Phase 2. Phase 4 runs continuously at low frequency.

---

## Notes

- **No duplication:** This roadmap does not duplicate `docs/research/international-legal-tech/` development roadmap (R0–R5). It covers the research runway's own phased work (Philippine infrastructure, Cloudflare ops, security, privacy, capability matrix).
- **Counsel determinations remain 0.** No research finding substitutes for a counsel determination. All PH legal-status, reuse, and effectivity conclusions are explicitly routed to qualified Philippine counsel.
- **Statuses follow the methodology (research-methodology.md §12):** NEW, INVESTIGATING, EVIDENCE_INSUFFICIENT, RECOMMENDED, ACCEPTED, DEFERRED, REJECTED, IMPLEMENTED, VERIFIED, SUPERSEDED.
