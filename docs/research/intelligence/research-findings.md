# Research Findings — Synthesized

**Status:** synthesized from this runway session (2026-11-18) plus the existing international dossier (2026-11-14).
**Claim classifications:** each finding is labelled VERIFIED FACT / SOURCE CLAIM / INDEPENDENTLY CORROBORATED / RESEARCH INFERENCE / RECOMMENDATION / UNKNOWN / DISPUTED / OUTDATED.

## A. Philippine legal information infrastructure

**F-A-1.** The Supreme Court E-Library provides SC decisions 1996–2026 plus RA/PD/EO/AO/MC/MO, Rules of Court, constitutions, treaties, and the National Administrative Register, but **no citator and no API were observed on the pages checked**. (VERIFIED FACT — direct observation of absence on pages checked, elibrary.judiciary.gov.ph, 2026-11-18. **RESEARCH INFERENCE** — the conclusion that "no citator/API exists anywhere" exceeds observation; absence of evidence is not proof of absence. See limitation L-05.)

**F-A-2.** The E-Library monthly decision index has missing/unlinked months across many years (2026 May, Sep–Nov as of 2026-11-18; May recurs across 2012–2026). (VERIFIED FACT — direct observation.)

**F-A-3.** The Official Gazette returned HTTP 403 on homepage at 2026-11-18. (VERIFIED FACT — access failure.) Previously observed as publication-oriented, not a research system; no citation graph or versioning.

**F-A-4.** LawPhil (Arellano Law Foundation) is a secondary compilation with an explicit accuracy disclaimer, no citator, no API, and **does display a reuse licence** — Creative Commons Attribution-NonCommercial 4.0 Philippine license (lawphil.net/copyright.html). Statutes, Issuances and Court Decisions are works of the Philippine Government; the Lawphil collection itself is CC BY-NC 4.0 PH licensed by the Arellano Law Foundation. Acceptable Use Policy: informational only, accuracy disclaimed, no legal advice (lawphil.net/usepolicy.html). **VERIFIED FACT — copyright + AUP pages read, 2026-11-18.** **Correction:** earlier finding that LawPhil grants no reuse licence is superseded by direct observation of the CC BY-NC 4.0 PH license.

**F-A-5a.** No Philippine service was found that records positive/negative treatment of jurisprudence at scale (no public citator observed on the pages checked). (VERIFIED FACT — observed gap on pages checked; limitation L-05 applies: absence of evidence is not proof of absence.)
**F-A-5b.** Anycase.ai, BatasDB, and Digest AI do not claim a citator. (SOURCE CLAIM — vendor pages state no citator; not independently corroborated.)

**F-A-6.** No Philippine official source exposes stable provision identifiers or a public API. (VERIFIED FACT — observed on E-Library and Gazette.)

**F-A-7.** No consolidated statute book with amendment/repeal/commencement effects exists in the Philippines. (VERIFIED FACT — observed gap.)

**F-A-8.** Anycase.ai is the only identified PH-native paid AI product with public pricing (Free/Pro ₱999/Education ₱599); its "14,000+ users" and "14 hours saved" are unverified company claims; corpus count historically inconsistent (140k vs 160k — see data-quality conflict DQ-01). (SOURCE CLAIM — anycase.ai; not independently corroborated.)

**F-A-9 (RECOMMENDATION).** The project's Gates 1–7 infrastructure (identity, versioning, citation verification, authorization, audit) maps directly onto the verified PH gaps (no citator, no stable IDs, no effects ledger, no reuse clarity). Build the authority layer, not another chatbot.

**F-A-10 (RECOMMENDATION).** No real Philippine legal text may enter the pipeline until counsel authorizes a specific source × activity. All PH work remains on synthetic fixtures.

## B–E, J–M (carried over from the international dossier, 2026-11-14)

**F-B/C/D/E/J/K/M.** Summaries held in `docs/research/international-legal-tech/`. Key conclusions:

- **F-INT-1.** The citator (KeyCite/Shepard's editorial treatment) is the incumbent moat; no PH incumbent occupies a verified-authority position. (Cross-source; S01–S03, S10–S13.)
- **F-INT-2.** Independent testing found 17–33% hallucination in Lexis+ AI, Westlaw AI-Assisted Research, Ask Practical Law AI (Stanford RegLab, 2024). (INDEPENDENTLY CORROBORATED — S09.)
- **F-INT-3.** "Hallucination-free" is false; passage-level support is not documented by any vendor. (S01–S06, S09.)
- **F-INT-4.** legislation.gov.uk is the best public model of point-in-time law with an effects ledger and honest unapplied effects. (S08 — PRIMARY/OFFICIAL.)
- **F-INT-5.** CourtListener provides a citation-lookup API explicitly to fight AI hallucinations. (S07 — PRIMARY/OPEN.)
- **F-INT-6.** Positioning: Philippine legal authority infrastructure delivered through a research engine; AI gated by citation verification. Rejected: corpus-size race, Philippine Harvey, general chatbot. (RESEARCH INFERENCE + RECOMMENDATION.)
- **F-INT-7.** Tier 1 features F1–F8; Tier 2 F9–F13; Tier 3 F16–F20 gated on evidence; Tier 4 rejected (general chatbot, bulk acquisition, predictive analytics, national citator at launch, etc.).

## F. Data architecture & database engineering

**F-F-1.** No new research conducted this session beyond D1 limits (Domain G). Existing project already uses immutable versions + append-only triggers + commit markers (Gates 7–10).

## G. Cloudflare ecosystem

**F-G-1.** D1 limits verified from official docs (C-01): 10 GB max per paid DB (cannot be increased), 500 MB free; 5M reads/day free, 100K writes/day free; 50 queries/free Worker invocation (1,000 paid); 100 bound params/query; 2 MB max row; 100 KB max SQL; 30 s max query; 50 MB max result (from 2026-11-04); single-threaded per DB; 6 simultaneous D1 connections/Worker. (VERIFIED FACT — official docs.)

**F-G-2.** D1 is single-threaded per database and designed for horizontal scale-out across many smaller (per-tenant/per-entity) DBs, not one monolithic 10 GB DB. (VERIFIED FACT — official docs.)

**F-G-3.** `batch()` runs statements sequentially on real D1 — safe recovery, not binding atomicity. (INDEPENDENTLY CORROBORATED — official Cloudflare semantics state `db.batch()` counts as ONE query; C-09 and C-10 independently report sequential batch behaviour; Gate 7 remote testing was partial — workerd cannot start locally so no local binding test.)

**F-G-4.** Independent experience report: D1 overload errors on small DBs (noisy neighbor); DO 128 MB memory and >10 s cold starts; one team moved shared DB to PlanetScale Postgres via Hyperdrive. (INDEPENDENT — C-09.)

**F-G-5.** Community architecture review: 8.8 GB single D1 DB (88% of cap); FTS5 export blocked; ~3,000 DO invocations per queue consumer due to rate-limiter DO contention; horizontal scale needs scatter-gather. (INDEPENDENT — C-10.)

**F-G-6 (RECOMMENDATION).** Keep the Cloudflare/D1/Workers stack. No stack replacement justified. Design for horizontal scale-out (per-source/per-tenant D1 DBs) before the 10 GB cap.

**F-G-7 (RECOMMENDATION).** Use KV only for session/cache, not authorization state (eventual consistency, 1 write RPS/key). Authorization decisions belong in D1.

**F-G-8 (RECOMMENDATION).** Add Vectorize only with a measured evaluation set; exact-match and lexical search first.

## H. Security

**F-H-1.** OWASP LLM Top 10 (2025): Prompt Injection (LLM01, direct + indirect) is #1; followed by sensitive info disclosure (LLM02), data/model poisoning (LLM04), system prompt leakage (LLM07), vector/embedding weaknesses (LLM08). (VERIFIED FACT — OWASP.)

**F-H-2.** Real incidents: EchoLeak (M365 Copilot, zero-click indirect injection), ForcedLeak (Salesforce Agentforce), Slack AI (retrieved-message exfiltration), Google Bard (markdown image exfiltration). (INDEPENDENTLY CORROBORATED — S-03.)

**F-H-3.** The platform's AI attack surface: user queries, retrieved corpus text, fetched web content, verifier/generator prompts, saved research/notes, agent tool use, rendered output. (RESEARCH INFERENCE.)

**F-H-4 (RECOMMENDATION).** Treat all retrieved/user content as untrusted; separate instructions from data; verify citations before display; abstain on failure; sanitize output; rate-limit retrieval endpoints.

**F-H-5 (RECOMMENDATION).** Review the existing THREAT_MODEL.md against OWASP LLM01–LLM08 before any AI feature is gated behind the verifier.

## I. Privacy, licensing, legal risk

**F-I-1.** RA 10173 (Data Privacy Act of 2012) effective 8 Sep 2012; NPC regulator; IRR enforceable 9 Sep 2016. (VERIFIED FACT — privacy.gov.ph.)

**F-I-2.** NPC Advisory No. 2024-04 (19 Dec 2024) applies the DPA to AI systems processing personal data including training/testing: transparency, accountability, human intervention, fairness, accuracy, minimization, lawful basis, data-subject rights. (VERIFIED FACT — full advisory text read.)

**F-I-3.** Publicly available personal data does NOT lose DPA protection merely because it is public. (VERIFIED FACT — NPC decision EA and TA v. EJ.)

**F-I-4.** No Philippine **official** source (E-Library, Gazette) displays a reuse licence; public availability is not redistribution permission. LawPhil is a **secondary** compilation by the Arellano Law Foundation (not an official government source) and does display a CC BY-NC 4.0 Philippine license (see F-A-4). **VERIFIED FACT — observed on E-Library and Gazette.** **Correction:** LawPhil removed from the "official source" list; it is secondary and carries a CC BY-NC 4.0 PH license (non-commercial, so commercial reuse still requires clearance).

**F-I-5 (RECOMMENDATION).** Flag all Philippine legal-status, reuse, and effectivity questions for qualified Philippine counsel; do not convert research into legal determinations.

**F-I-6 (RECOMMENDATION).** Before any real PH text enters the pipeline: counsel determination on source × activity, reuse/display permission, effectivity rules (project's R1.5 gate).

**F-I-7 (RECOMMENDATION).** If the platform handles user personal data: PIA, PIC/PIP, privacy-by-design, data-subject-rights mechanisms. Do not train AI on unlicensed content.

## Cross-cutting recommendations

**F-R-1 (RECOMMENDATION).** Priority order of work: (1) resolve QP-01/QP-02 with counsel; (2) close backlog items B-2 (synthetic exemption) and B-3 (read-time auth); (3) harden fail-closed authorization; (4) build Tier 1 F1–F8 on synthetic fixtures; (5) R1.5 first authorized ingestion.

**F-R-2 (RECOMMENDATION).** Do not build: general chatbot, bulk acquisition/mirroring, predictive judge analytics, national-scale citator at launch, per-query AI pricing for core research, international expansion first. (Carried from Tier 4.)

## Contradictions and unresolved items

- D1 is officially positioned as read-heavy and horizontally scalable, but independent reports show overload on small DBs — the documented mitigation (read replication, indexes) did not help one team. Treat as a known operational risk to be monitored, not a blocker.
- Anycase's corpus count (140k vs 160k) and user count (14,000+) are inconsistent company claims; do not cite as market size.
- All Philippine legal-status conclusions await qualified Philippine counsel.

## Storage and isolation confirmation

- No legal corpus downloaded. No bulk downloads. No production database populated. No D1 research tables created. No documents ingested. No vector index created for research. No deployment. No authorization state changed.
- All research artifacts are Markdown under `docs/research/intelligence/`.
