# Research Questions — Prioritized Unanswered Questions

**Status:** initial set. Each question carries a priority and the evidence needed to answer it.
**Source of questions:** existing architecture, known limitations, current gates (Gate 11–19 in flight), previous research (international dossier), user workflows, security findings, new technologies, unresolved product decisions, technical debt, reliability gaps, legal/licensing uncertainties, opportunities.

## P0 — Critical (prevents unauthorized activity, incorrect legal authority, security compromise, data loss, major correctness failures)

| ID | Question | Why it matters | Evidence needed |
|----|----------|----------------|-----------------|
| QP-01 | Which Philippine sources × activities will counsel authorize, and under what reuse/display terms? | Corpus is the product; no real text may enter until a determination exists. | Counsel determination (external); not researchable. |
| QP-02 | What are the effectivity/publication rules per Philippine instrument type (RA, EO, PD, CA, BP, court rule, circular)? | Needed for correct version model and "in force" claims. | Qualified Philippine counsel. |
| QP-03 | Is the current fail-closed authorization (NOT_CHECKED → UNKNOWN) correctly enforced at every read path (retrieve, index build, verification)? | A single fail-open path exposes incorrect authority. | Code review + tests against repository. |
| QP-04 | Does any research or retrieved content reach the model with instruction-following privilege (prompt injection / indirect injection)? | Retrieved legal text is the retrieval context; indirect injection can hijack output. | Threat-model review; OWASP LLM01 mapping. |

## P1 — High (material improvement to reliability, authority tracking, citation verification, retrieval, core UX, operational safety)

| ID | Question | Why it matters | Evidence needed |
|----|----------|----------------|-----------------|
| QP-05 | Which D1 limits (10 GB per DB, single-threaded, 50 queries/free invocation, 50 MB result cap) bind the project at current and projected scale? | Determines whether D1 can remain the metadata store or needs sharding/read-replicas. | Official docs (done) + load test. |
| QP-06 | Does the project have a working read-time authorization for `retrieve`? (Backlog B-3) | Holding an index is currently sufficient to search it — an enforcement gap. | Code inspection + test. |
| QP-07 | Is the `synthetic: true` ingestion exemption still allowing callers to skip four activity checks? (Backlog B-2) | Guard is only a `synthetic://` URL prefix. | Code inspection + test. |
| QP-08 | Which sources will counsel authorize first, and what is the authorized source set for R1.5? | Gates all real-data work. | Counsel (external). |
| QP-09 | What is the OCR quality of the oldest needed Philippine documents? | Affects coverage cost and ingestion feasibility. | Sample scanned decisions; not yet sampled. |
| QP-10 | Can the project lawfully store and serve each candidate source's text under Philippine copyright/database rules? | Ingestion + display gate. | Counsel. |

## P2 — Medium (useful improvements, meaningful but noncritical)

| ID | Question | Why it matters | Evidence needed |
|----|----------|----------------|-----------------|
| QP-11 | Does Vectorize add measurable recall over lexical search on Philippine legal text, without exact-citation regression? | Vector is a recall booster; needs an evaluation set before adoption. | Benchmark on synthetic fixtures. |
| QP-12 | What is the real Cloudflare cost at 10k / 100k / 1M document profiles? | Pricing for business model and capacity planning. | Not load-tested; estimate from official pricing. |
| QP-13 | Which Philippine citation formats appear for the same case, and how often do they conflict? | Drives citation parser/resolver (F4) robustness. | Corpus-wide citation extraction on authorized data (blocked until counsel). |
| QP-14 | Is a restricted editorial citator (F14) legally defensible in the Philippines with named reviewers? | Potential moat; needs reviewer liability/insurance. | Counsel. |
| QP-15 | What durability/recovery behavior does D1 show under failure injection on real D1? | Confirms commit-marker pattern. | Real-D1 failure-injection test (Gate 7 done partially). |

## P3 — Exploratory (speculative, trends, future opportunities)

| ID | Question | Why it matters | Evidence needed |
|----|----------|----------------|-----------------|
| QP-16 | Could a government API or structured data feed appear for Philippine legislation? | Would drop acquisition cost; shift moat to verification/workflow. | Monitor Official Gazette / Congress / Senate. |
| QP-17 | Will Anycase or BatasDB add a citator? | Narrows the window; speed to authority state matters. | Monitor vendor pages; not actionable now. |
| QP-18 | Should the project offer an institutional verification API (F15)? | B2B revenue; needs stable verifier + terms. | Post-R3. |
| QP-19 | Is multi-language (Filipino/English) UI or legal-text handling needed? | Not the first constraint; defer. | User research. |

## Questions answered / closed this session (recorded for deduplication)

| ID | Question | Answer | Source |
|----|----------|--------|--------|
| QC-01 | What are D1's hard limits and pricing? | Verified: 10 GB/DB paid, 500 MB free; 5M reads/day free, 100K writes/day free; 50 queries/free invocation; 100 bound params; 2 MB row; 50 MB result (from 2026-11-04); single-threaded per DB; $0.75/GB-mo storage over 5 GB. | C-01, C-02 |
| QC-02 | Does the NPC have AI guidelines? | Yes — Advisory No. 2024-04 (19 Dec 2024) applying DPA to AI systems incl. training/testing; transparency, accountability, human intervention, fairness, accuracy, minimization, data subject rights. | P-01 |
| QC-03 | Is prompt injection the top LLM risk? | Yes — OWASP LLM01:2025; direct + indirect; real incidents EchoLeak, ForcedLeak, Slack AI. | S-01, S-03 |
| QC-04 | What Philippine legal resources exist and what are their gaps? | SC E-Library (no citator/API, missing months), Official Gazette (403 at check), LawPhil (no reuse, disclaimer), SC main site, Anycase/BatasDB/Digest AI (vendor claims, no citator). | PH-01, PH-02, IT-01 |

## Research-question rules

- A question is removed only when answered with evidence, or explicitly deferred with rationale.
- No question is researched twice without noting why a re-investigation is needed.
- Questions requiring counsel (QP-01, QP-02, QP-08, QP-10, QP-14) are not researchable by this runway; they are routed to human decision.
