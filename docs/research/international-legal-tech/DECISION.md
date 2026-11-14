# DECISION — International Legal Technology Landscape Research

**Date:** 2026-11-14
**Verdict:** **ACCEPTED WITH LIMITATIONS**
**Scope:** research and product direction only.

## 1. Verdict rationale

The research meets the gate's acceptance criteria for coverage, sourcing,
comparison and review:

- 22 platforms identified, 10 deep profiles, 18 normalized capabilities compared
  across 9 products.
- 9 jurisdictions examined, with non-interchangeability warnings.
- Search, retrieval, citation, temporal validity, AI quality, provenance and
  operations analysed.
- The Philippine landscape assessed from observed evidence.
- A source register (17 entries) supports material claims; vendor claims are
  separated from independent evidence; `UNKNOWN` stays `UNKNOWN`.
- 18 deliverables plus three machine-readable files.
- Two independent read-only reviews completed; findings recorded and remediated.
- No code, schema, corpus, authorization state or deployment changed.

It is **not** `ACCEPTED` because material gaps remain:

- CanLII, AustLII, Indian Kanoon, HKLII and Caselaw Access Project could not be
  inspected (403/empty).
- Pricing is undisclosed for every platform except Anycase.
- Retrieval quality is unpublished industry-wide; no independent IR benchmark was
  found.
- No Philippine user interviews were conducted; demand and willingness to pay are
  hypotheses.
- Counsel determinations remain **0**; legal-status recommendations are
  engineering proposals pending Philippine counsel.

It is not `BLOCKED` because the material research was completed; and not
`REJECTED` because no fabrication, false evidence or constraint violation was
found.

## 2. Acceptance criteria checklist (§21)

| Criterion                                                 | Result                                          |
| --------------------------------------------------------- | ----------------------------------------------- |
| ≥15 relevant platforms identified                         | 22                                              |
| ≥8 meaningful deep profiles                               | 10                                              |
| ≥5 compared in depth                                      | 9 in the matrix (18 capabilities)               |
| Major jurisdictions examined                              | US, UK, CA, AU, EU, IN, SG, HK, PH              |
| Search/retrieval/citation/temporal/AI analysed            | yes, `05`–`08`                                  |
| Philippine landscape assessed                             | yes, `10`                                       |
| Normalized feature matrix                                 | yes, MD + CSV + JSON                            |
| Source register supports material claims                  | 17 sources, every `Sxx` resolves                |
| Company claims separated from facts                       | yes (classes + matrix scale note)               |
| UNKNOWN remains explicit                                  | yes (blocked platforms, pricing, mechanisms)    |
| Opportunities prioritized by value/feasibility/dependency | yes, `12`, `17`                                 |
| Architecture compatible or departure justified            | yes, `13` (no stack change)                     |
| Authorization boundaries preserved                        | yes; 0 determinations, 350 `UNKNOWN`, 4 blocked |
| Independent reviews complete                              | 2 reviews, remediated                           |
| No code/schema/corpus/deployment changes                  | confirmed (`git diff` = docs only)              |

## 3. Independent reviews

### Review 1 — research accuracy and source quality

| ID    | Severity | Finding                                                                                                                                      | Disposition                                                                                                 |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A1    | BLOCKER  | Stale `COMPETITOR_RESEARCH.md` contradicted the new vLex finding and repeated unverified USD prices and an unregistered hallucination study. | **FIXED** — superseded banner added; stale figures marked unusable.                                         |
| A2–A5 | MAJOR    | Vendor-documented architecture/quality claims (semantic, hybrid, AI classification, contract benchmarking) were marked as verified.          | **FIXED** — downgraded to `P`; methodology and matrix now state `V` = documentation coverage, not efficacy. |
| A6–A8 | MAJOR    | Feature matrix conflated feature existence, mechanism disclosure and quality.                                                                | **FIXED** — matrix v2; AI Q&A and summarisation `P`; passage-level `U`; provenance `U` for vendors.         |
| A9    | MAJOR    | "Citation verification" conflated citator treatment with verification of AI output.                                                          | **FIXED** — row split conceptually (`Citation treatment (editorial)` vs `AI-output citation verification`). |
| A10   | MAJOR    | Missing adjacent/acquired platforms (SCC Online, Wolters Kluwer, Lex Machina, Casetext, Fastcase, etc.).                                     | **PARTIALLY FIXED** — added §3.1 with `UNKNOWN` status; not deep-profiled (limitation).                     |
| A11   | MAJOR    | CourtListener docket count, Vincent 38%/3.67×, Harvey valuation were not traceable to the register.                                          | **FIXED** — claims added to S03/S05/S07.                                                                    |
| A12   | MAJOR    | `COMPETITOR_RESEARCH.md` cited a hallucination study absent from the register.                                                               | **FIXED** by the deprecation banner; the dossier uses S09 only.                                             |
| A13   | MINOR    | EUR-Lex ELI described as an innovation despite blocked pages.                                                                                | **FIXED** — marked "claimed; inaccessible, `U`".                                                            |
| A14   | MINOR    | CanLII/AustLII classified as "secondary services".                                                                                           | **FIXED** — column renamed; described as free primary case law.                                             |
| A15   | MINOR    | UK commencement mechanism risked being imported as a PH schema assumption.                                                                   | **FIXED** — recommendations now say "effectivity dates", counsel validation required.                       |
| A16   | MINOR    | Anycase corpus-count inconsistency not noted in the matrix.                                                                                  | **FIXED** — row 1 opportunity notes 140k–160k inconsistency.                                                |
| A17   | NIT      | Gate 1 benchmark referenced without an internal source.                                                                                      | **FIXED** — S17 added.                                                                                      |
| A18   | NIT      | S09 product-version scope not stated in the Westlaw profile.                                                                                 | **FIXED** — "tested 2022–23 versions".                                                                      |

Reviewer confirmed clean: methodology, jurisdiction warnings, PH gap evidence,
S09 representation, authorization alignment, architecture fidelity, source
conflicts, commercial pricing discipline, gaps, roadmap stops.

### Review 2 — product strategy and Philippine applicability

| ID  | Severity | Finding                                                                                | Disposition                                                                       |
| --- | -------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P1  | BLOCKER  | Tier 1 acceptance criteria assumed authorized real data that cannot legally exist yet. | **FIXED** — two-stage acceptance rule; real-data validation `BLOCKED_ON_COUNSEL`. |
| P2  | MAJOR    | "Only position incumbents have not taken" was asserted as fact.                        | **FIXED** — relabelled as judgement based on observed absence.                    |
| P3  | MAJOR    | Tier 2 assumed editorial capacity/insurance that does not exist.                       | **FIXED** — `BLOCKED_ON_EDITORIAL_CAPACITY` gate added.                           |
| P4  | MAJOR    | Roadmap lacked a visible "first authorized ingestion" boundary.                        | **FIXED** — R1.5 added.                                                           |
| P5  | MAJOR    | Strategic conclusions ("defensible moat", "meaningful advantage") were unlabelled.     | **FIXED** — labelled judgement.                                                   |
| P6  | MAJOR    | "Project already owns the right infrastructure" overstated maturity.                   | **FIXED** — "specified and tested core components; production hardening remains". |
| P7  | MAJOR    | Commercial model presented as decided.                                                 | **FIXED** — section labelled hypothetical pending R0 interviews.                  |
| P8  | MAJOR    | Tier 1 re-listed already-built verifier/audit/abstention without crediting them.       | **FIXED** — status lines added for F6–F8.                                         |
| P9  | MINOR    | Assessment table ratings looked measured.                                              | **FIXED** — labelled team judgements.                                             |
| P10 | MINOR    | User-segment table could be skimmed as validated personas.                             | **FIXED** — explicit "all hypotheses, no interviews" banner.                      |
| P11 | MINOR    | "Fits PH?" column asserted fit without data.                                           | **FIXED** — "Plausible fit (untested)".                                           |
| P12 | MINOR    | "One architectural bet" ignored existing A1/A2/A10.                                    | **FIXED** — now "one new thing: A3 effects ledger".                               |

Reviewer confirmed clean: methodology/source discipline, feature matrix, S09
handling, temporal patterns, gate honesty, Cloudflare fidelity, roadmap non-goals.

## 4. Residual limitations (disclosed, not fixed)

1. Five platforms inaccessible; capabilities `UNKNOWN`.
2. Pricing undisclosed except Anycase.
3. No independent retrieval benchmark exists; none was invented.
4. No Philippine user interviews; demand/pricing are hypotheses.
5. Adjacent/acquired platforms identified but not profiled.
6. Vendor mechanism claims remain partly undocumented even after downgrades.
7. All Philippine legal-status conclusions await counsel.
8. Reviewers are AI agents, not Philippine lawyers or market analysts.

## 5. Boundary statement

This decision grants no legal permission and changes no authorization state.
Counsel determinations remain **0**; all **350** cells remain `UNKNOWN`; the four
pilot documents remain `BLOCKED_AUTHORIZATION`. Research cannot clear the legal
blocker.

No code, schema, migration, corpus, Worker or deployment was changed. Nothing was
pushed.

## 6. Next action

Run R0 (interviews + counsel scoping) before committing to R1. The first
engineering change, when authorized, should be the authority core (F1–F5), not an
AI feature.
