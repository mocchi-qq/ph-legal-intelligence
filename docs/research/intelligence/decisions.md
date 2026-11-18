# Research Decisions — Philippine Legal Intelligence Platform

**Purpose:** Recommendation decisions derived from synthesized research findings (`research-findings.md`), the research backlog (`research-backlog.md`), and domain syntheses. Each decision carries an ID, the research question it answers, supporting evidence and source links, confidence, expected benefit, the current project gap, the proposed change, dependencies, risks, legal/licensing concerns, estimated complexity, reversibility, additional validation needed, acceptance criteria, and status.

**Status:** initial — created 2026-11-18 as part of R-10.
**Boundary:** research-only. Decisions are recommendations, not implementations. No legal corpus downloaded, no production DB populated, no D1 research tables, no ingestion of real Philippine legal text, no deployment, no authorization change, no push.

---

## Decision statuses (methodology §12)

NEW → INVESTIGATING → EVIDENCE_INSUFFICIENT → RECOMMENDED → ACCEPTED → DEFERRED → REJECTED → IMPLEMENTED → VERIFIED → SUPERSEDED.

Research never automatically implements changes. An ACCEPTED decision routes through the project's normal development and verification workflow (gate → code → test → review → gate acceptance).

---

## D-01 — Build the authority layer, not another chatbot

| Field | Value |
|-------|-------|
| ID | D-01 |
| Research question | QP-01, QP-02 (scope), QP-03, QP-04 |
| Evidence | F-A-9 (RECOMMENDATION); F-INT-6; F-A-1..F-A-7 (verified PH gaps: no citator, no stable IDs, no effects ledger, no reuse clarity) |
| Source links | PH-01, PH-02, IT-01; international dossier 11_PRODUCT_POSITIONING.md |
| Confidence | High (RECOMMENDATION; evidence: VERIFIED FACT + RESEARCH INFERENCE) |
| Expected benefit | Directly addresses the verified Philippine gap: no product shows positive/negative treatment of jurisprudence, stable provision IDs, or versioned statute text. Differentiates from general chatbots (17–33% hallucination in rivals, S09). |
| Problem solved | The "Philippine Harvey / general chatbot" anti-pattern; unverified authority output. |
| Current project gap | Gates 1–7 infrastructure exists on synthetic fixtures only; real-data validation blocked by counsel (0 determinations). |
| Proposed change | Keep the existing authority-layer direction (identity, versioning, citation verification, authorization, audit). Reject general chatbot, corpus-size race, bulk acquisition. |
| Dependencies | Counsel determination B-01/B-02 (externally blocked). |
| Risks | Real-data work cannot proceed until counsel authorizes a source × activity. |
| Legal/licensing concerns | No Philippine source displays a reuse licence (F-I-4); all PH text remains on synthetic fixtures until counsel clearance. |
| Estimated complexity | Medium (architecture direction; implementation via existing gates). |
| Reversibility | Fully reversible (positioning decision). |
| Additional validation needed | Counsel determination on authorized sources; real-data validation on synthetic fixtures first. |
| Acceptance criteria | Authority-layer positioning documented; chatbot/corpus-size/bulk-acquisition anti-patterns explicitly rejected; no real PH text ingested without counsel. |
| Status | RECOMMENDED |

---

## D-02 — No real Philippine legal text enters the pipeline until counsel authorizes a specific source × activity

| Field | Value |
|-------|-------|
| ID | D-02 |
| Research question | QP-01, QP-10 |
| Evidence | F-A-10 (RECOMMENDATION); F-I-5, F-I-6; F-I-4 (no reuse licence observed); current-state authorization: 0 counsel determinations, 350 UNKNOWN cells, 4 pilot docs BLOCKED_AUTHORIZATION |
| Source links | PH-01, PH-02; P-01, P-02 |
| Confidence | High (RECOMMENDATION; evidence: VERIFIED FACT — current gate enforcement) |
| Expected benefit | Prevents unauthorized ingestion/display/reuse of Philippine legal text; keeps the authorization boundary intact. |
| Problem solved | Risk of ingesting text without reuse clearance or counsel determination. |
| Current project gap | All PH work on synthetic fixtures; gate enforces this but research should codify it as a standing decision. |
| Proposed change | Standing decision: no real Philippine legal text may enter the pipeline (ingest, store, display, reuse) until qualified Philippine counsel authorizes the specific source × activity and reuse/display terms. |
| Dependencies | B-01, B-02, B-11 (counsel; externally blocked). |
| Risks | None (this is a protective hold). |
| Legal/licensing concerns | Public availability ≠ redistribution permission (F-I-3, F-I-4); DPA applies to training data containing personal data (P-01). |
| Estimated complexity | Low (policy/gate enforcement). |
| Reversibility | Reversible only by counsel determination. |
| Additional validation none | Counsel determination recorded in the authorization matrix. |
| Acceptance criteria | Standing hold documented; authorization matrix unchanged (0 determinations) until counsel acts. |
| Status | RECOMMENDED |

---

## D-03 — Keep the Cloudflare/D1/Workers stack; design for horizontal scale-out before the 10 GB cap

| Field | Value |
|-------|-------|
| ID | D-03 |
| Research question | QP-05, QP-12 |
| Evidence | F-G-6 (RECOMMENDATION); F-G-1, F-G-2 (D1 limits verified: 10 GB/DB paid, single-threaded per DB, 50 queries/free invocation); C-01, C-02; F-G-4, F-G-5 (independent overload/scale-out experience reports) |
| Source links | C-01, C-02, C-03, C-09, C-10 |
| Confidence | High (RECOMMENDATION; evidence: VERIFIED FACT) |
| Expected benefit | Avoids premature stack replacement; manages the known D1 10 GB cap and single-threaded/overload risk via scale-out design. |
| Problem solved | D1 is a hard-capped (10 GB, cannot increase), single-threaded-per-DB store; overload reported on small DBs by independent teams. |
| Current project gap | D1 used as metadata store (Gates 1–7); no scale-out design documented; overload handling not implemented. |
| Proposed change | Keep Cloudflare/D1/Workers. Design for horizontal scale-out (per-source/per-tenant D1 DBs with scatter-gather in the Worker) before the 10 GB cap. Do not rely on `batch()` atomicity (sequential, recovery-safe only). Add D1 overload handling (retry reads, don't retry writes, backoff). |
| Dependencies | B-07, B-14, B-15, B-19 (load test, failure injection remote). |
| Risks | Real-D1 binding behavior unverified locally (workerd cannot start locally; D1 verified remotely only). |
| Legal/licensing concerns | None (infrastructure decision). |
| Estimated complexity | Medium (architecture + code changes via gates). |
| Reversibility | Reversible (stack decision; data migration required if reversed later). |
| Additional validation needed | Real-D1 load test and failure-injection (remote). |
| Acceptance criteria | Stack decision documented; scale-out design note; overload-handling pattern documented. |
| Status | RECOMMENDED |

---

## D-04 — Use KV only for session/cache, never authorization state

| Field | Value |
|-------|-------|
| ID | D-04 |
| Research question | QP-04 |
| Evidence | F-G-7 (RECOMMENDATION); C-03 (KV: 1 write RPS/key, eventual consistency); capability-matrix row "Authorization" |
| Source links | C-03 |
| Confidence | High (RECOMMENDATION; evidence: VERIFIED FACT) |
| Expected benefit | Prevents authorization decisions from relying on eventually-consistent KV with a 1 write RPS/key limit. |
| Problem solved | KV is suited to session/cache, not to authorization state needing strong consistency. |
| Current project gap | Authorization decisions belong in D1 (stronger consistency); KV usage not audited. |
| Proposed change | Restrict KV to session/cache only. Route all authorization decisions through D1. Add a KV-usage audit (B-20). |
| Dependencies | B-20. |
| Risks | None (protective). |
| Legal/licensing concerns | None. |
| Estimated complexity | Low (code audit + restriction). |
| Reversibility | Fully reversible. |
| Additional validation needed | KV-usage audit against repository. |
| Acceptance criteria | KV restricted to session/cache; authorization in D1; audit documented. |
| Status | RECOMMENDED |

---

## D-05 — Add Vectorize only with a measured evaluation set; exact-match and lexical search first

| Field | Value |
|-------|-------|
| ID | D-05 |
| Research question | QP-11 |
| Evidence | F-G-8 (RECOMMENDATION); capability-matrix rows "Search", "Reranking" (Vectorize not implemented; contract only); F-INT-4 (legislation.gov.uk effects ledger as model) |
| Source links | C-08 (AI Search + D1), C-01 |
| Confidence | Medium (RECOMMENDATION; evidence: RECOMMENDATION gated on evaluation set) |
| Expected benefit | Avoids adopting vector recall without evidence; prevents exact-citation regression; ensures any vector booster is benchmarked. |
| Problem solved | Vectorize is a recall booster, not a substitute for exact citation search; no evaluation set exists for Philippine legal text. |
| Current project gap | Search is lexical + metadata (contract only); no semantic reranker; no evaluation set. |
| Proposed change | Keep exact-match bypass before ranking. Add Vectorize only after a measured evaluation set demonstrates recall gain without exact-citation regression. |
| Dependencies | B-16 (evaluation set; blocked until authorized corpus). |
| Risks | Premature vector adoption could regress exact citation resolution (a Tier-1 feature). |
| Legal/licensing concerns | None (retrieval relevance decision). |
| Estimated complexity | Medium (benchmark + possible Vectorize integration). |
| Reversibility | Fully reversible (can remove Vectorize). |
| Additional validation needed | Evaluation set on authorized data; benchmark. |
| Acceptance criteria | Evaluation set exists; Vectorize go/no-go documented with benchmark results. |
| Status | RECOMMENDED (blocked on B-16/eval set) |

---

## D-06 — Treat all retrieved/user content as untrusted; separate instructions from data; verify citations before display; abstain on failure

| Field | Value |
|-------|-------|
| ID | D-06 |
| Research question | QP-04 |
| Evidence | F-H-4 (RECOMMENDATION); F-H-1 (OWASP LLM01:2025 prompt injection #1); F-H-2 (EchoLeak, ForcedLeak, Slack AI, Bard); S-01, S-02, S-03 |
| Source links | S-01, S-02, S-03 |
| Confidence | High (RECOMMENDATION; evidence: VERIFIED FACT) |
| Expected benefit | Defends against indirect prompt injection over retrieved legal text (the retrieval context is the attack vector), citation hallucination, and output exfiltration. |
| Problem solved | Retrieved corpus text passed to the model can carry instructions that hijack output; rivals hallucinate citations 17–33% (S09). |
| Current project gap | Four-layer verifier exists on synthetic fixtures; AI/retrieval threat model not updated for OWASP LLM01–LLM08 (THREAT_MODEL.md is design-level, pre-AI). |
| Proposed change | Treat all retrieved/user content as untrusted; separate instructions from data; verify citations before display; abstain on failure; sanitize output; rate-limit retrieval endpoints. Review THREAT_MODEL.md against LLM01–LLM08 (B-06). |
| Dependencies | B-06 (threat-model review). |
| Risks | No red-team testing on the citation verifier or retrieval pipeline yet. |
| Legal/licensing concerns | None (security decision). |
| Estimated complexity | Medium (threat-model review + defense implementation via gates). |
| Reversibility | Fully reversible. |
| Additional validation needed | Red-team testing on verifier/retrieval (post-implementation). |
| Acceptance criteria | Threat-model addendum for LLM01–LLM08; defense pattern documented; verifier gated on citation verification. |
| Status | RECOMMENDED |

---

## D-07 — Flag all Philippine legal-status, reuse, and effectivity questions for qualified Philippine counsel; do not convert research into legal determinations

| Field | Value |
|-------|-------|
| ID | D-07 |
| Research question | QP-01, QP-02, QP-08, QP-10, QP-14 |
| Evidence | F-I-5, F-I-6 (RECOMMENDATION); P-01 (NPC Advisory 2024-04); current-state: 0 counsel determinations, all 350 cells UNKNOWN |
| Source links | P-01, P-02; PH-01, PH-02 |
| Confidence | High (RECOMMENDATION; standing rule) |
| Expected benefit | Prevents research findings from being mistaken for legal authority or clearance; keeps authorization boundary honest. |
| Problem solved | Research cannot determine Philippine legal status, reuse permission, or effectivity; these require qualified counsel. |
| Current project gap | Standing rule exists informally; should be codified as a decision so future sessions don't re-litigate it. |
| Proposed change | Standing decision: all Philippine legal-status, reuse, and effectivity questions are routed to qualified Philippine counsel. Research findings are not legal determinations. Counsel determinations remain 0 until externally provided. |
| Dependencies | B-01, B-02, B-05(partially), B-11, B-13, B-18 (counsel; externally blocked). |
| Risks | None (protective). |
| Legal/licensing concerns | This decision itself is not legal advice; it defers to counsel. |
| Estimated complexity | Low (policy/gate). |
| Reversibility | Reversible only by counsel engagement. |
| Additional validation needed | None (standing rule). |
| Acceptance criteria | Standing rule documented; all counsel-blocked questions listed in backlog with "externally blocked" status. |
| Status | RECOMMENDED |

---

## D-08 — Do not build: general chatbot, bulk acquisition/mirroring, predictive judge analytics, national-scale citator at launch, per-query AI pricing for core research, international expansion first

| Field | Value |
|-------|-------|
| ID | D-08 |
| Research question | QP-01 (scope), QP-18 (scope) |
| Evidence | F-R-2 (RECOMMENDATION; carried from Tier 4); F-INT-6 (rejected patterns); F-A-8 (Anycase vendor claims unverified) |
| Source links | international dossier 11_PRODUCT_POSITIONING.md, 14_COMMERCIAL_MODELS.md |
| Confidence | High (RECOMMENDATION) |
| Expected benefit | Focuses resources on the verified-authority moat; avoids low-value / high-risk patterns rejected in Tier 4. |
| Problem solved | Tier 4 patterns (general chatbot, bulk acquisition, predictive analytics, national citator at launch) consume budget without addressing the verified PH gap. |
| Current project gap | Positioning already rejects these; codify as standing decision. |
| Proposed change | Standing decision: do not build general chatbot, bulk acquisition/mirroring, predictive judge analytics, national-scale citator at launch, per-query AI pricing for core research, or international expansion first. |
| Dependencies | None. |
| Risks | None (exclusion decision). |
| Legal/licensing concerns | Bulk acquisition/mirroring would violate the research boundary and likely reuse licences. |
| Estimated complexity | Low (exclusion decision). |
| Reversibility | Reversible (positioning decision). |
| Additional validation needed | None. |
| Acceptance criteria | Exclusion list documented; consistent with Tier 4 rejection in the existing dossier. |
| Status | RECOMMENDED |

---

## D-09 — Priority order of implementation work

| Field | Value |
|-------|-------|
| ID | D-09 |
| Research question | QP-01, QP-02, QP-03, QP-04, QP-05 |
| Evidence | F-R-1 (RECOMMENDATION) |
| Source links | research-findings.md cross-cutting recommendations |
| Confidence | Medium (RECOMMENDATION; evidence: RESEARCH INFERENCE) |
| Expected benefit | Sequences work so authorization and security foundations precede real-data ingestion. |
| Problem solved | Without a priority order, real-data work could start before counsel clearance or security hardening. |
| Current project gap | Gates 11–19 in flight; backlog not yet prioritized into an order. |
| Proposed change | Priority order: (1) resolve QP-01/QP-02 with counsel; (2) close backlog B-2 (synthetic exemption) and B-3 (read-time auth); (3) harden fail-closed authorization; (4) build Tier 1 F1–F8 on synthetic fixtures; (5) R1.5 first authorized ingestion. |
| Dependencies | B-01, B-02 (counsel; externally blocked). |
| Risks | Counsel blockage stalls (1) and (5). |
| Legal/licensing concerns | (5) requires counsel clearance first. |
| Estimated complexity | Medium (sequencing decision). |
| Reversibility | Fully reversible. |
| Additional validation needed | None (sequencing decision). |
| Acceptance criteria | Priority order documented; matches F-R-1. |
| Status | RECOMMENDED |

---

## Decisions not yet made (parked, awaiting input)

| ID | Topic | Awaiting |
|----|-------|----------|
| D-parked-01 | Authorized source × activity list for R1.5 | Qualified Philippine counsel (B-01, B-02, B-11) |
| D-parked-02 | Vectorize go/no-go | Evaluation set on authorized data (B-16) |
| D-parked-03 | Editorial citator (F14) legal defensibility | Counsel + named reviewers (B-18) |
| D-parked-04 | Institutional verification API (F15) | Post-R3; stable verifier (B-23) |

---

## Notes

- **Research never implements.** Every decision above is a recommendation; implementation occurs via the project's normal gate-driven workflow. No deployment, migration, ingestion, or authorization change results from this document alone.
- **No duplication:** Decisions D-01, D-08 echo positioning already in `docs/research/international-legal-tech/`; they are restated here only to tie them to the Philippine-specific findings and backlog. The international dossier remains the source of truth for international platforms, retrieval/AI comparison, authority/temporal, citations, product positioning, evaluation, and commercial models.
- **Counsel determinations remain 0.** No decision substitutes for a counsel determination. All PH legal-status, reuse, and effectivity conclusions are explicitly routed to qualified Philippine counsel.
