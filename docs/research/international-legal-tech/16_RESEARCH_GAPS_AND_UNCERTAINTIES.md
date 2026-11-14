# 16 — Research Gaps and Uncertainties

**Research date:** 2026-11-14

This section exists so the dossier cannot be read as more certain than it is.

## 1. Access failures

| Platform                      | What happened       | Consequence                             |
| ----------------------------- | ------------------- | --------------------------------------- |
| CanLII                        | HTTP 403            | capabilities `UNKNOWN`; no deep profile |
| AustLII                       | HTTP 403            | capabilities `UNKNOWN`; no deep profile |
| Indian Kanoon                 | HTTP 403            | capabilities `UNKNOWN`; no deep profile |
| HKLII                         | no content returned | capabilities `UNKNOWN`                  |
| Caselaw Access Project        | page rendered empty | capabilities `UNKNOWN`                  |
| EUR-Lex consolidated/ELI help | JS shell / redirect | consolidation details `U`               |
| legislation.gov.uk help pages | "Coming Soon"       | used XML API instead                    |

## 2. What could not be verified

1. **Pricing** for Westlaw, Lexis, Bloomberg, Harvey, CoCounsel, Vincent and
   CourtListener commercial terms. Only Anycase has a verified public price.
2. **Retrieval quality** for any platform. No vendor publishes recall/precision;
   no independent IR benchmark was found.
3. **Passage-level granularity.** Vendors say "linked citations"; none documents
   span-level alignment.
4. **Treatment methodology.** KeyCite/Shepard's editorial processes are not
   public; how they classify "negative" is `U`.
5. **AI architecture.** RAG is claimed by some; model routing, chunking and
   reranking are undisclosed everywhere.
6. **Corpus counts.** Anycase's 140k vs 160k is an internal inconsistency;
   Westlaw/Lexis/Bloomberg counts are not auditable.
7. **Philippine source reuse terms.** None of the official portals displayed a
   clear reuse licence in this pass.
8. **PH market size and willingness to pay.** No reliable public data; no
   interviews conducted.
9. **PH OCR quality and historical coverage.** Not sampled.
10. **Judge/party analytics ethics** in the Philippine context. Not assessed.

## 3. Threats to validity

- **Marketing asymmetry:** vendors publish strengths, not failure rates.
- **Version drift:** product names and packaging changed during 2025–2026 (Lexis
  rename, vLex/Clio, Harvey expansion). Claims are dated; older comparisons are
  unreliable.
- **Single-reviewer evidence:** most profiles rely on one official page per claim;
  where possible, a second source was used (e.g. S03 + S05 for partner content).
- **Access bias:** paywalled UI behaviour could not be observed; we relied on help
  pages and demos.
- **No primary legal validation:** no Philippine counsel reviewed the legal-status
  recommendations. They are engineering proposals pending counsel.
- **No user research:** segment needs and pricing are hypotheses.

## 4. Questions that must be answered before building

| #   | Question                                                         | Owner                | Why it blocks         |
| --- | ---------------------------------------------------------------- | -------------------- | --------------------- |
| Q1  | Which sources will counsel authorize, and for which activities?  | counsel + owner      | corpus is the product |
| Q2  | What are the effectivity/publication rules per instrument type?  | counsel              | temporal model        |
| Q3  | Can the project lawfully store and serve each source's text?     | counsel              | ingestion + display   |
| Q4  | Which user segment will pay for verification first?              | product + interviews | pricing/roadmap       |
| Q5  | Is a restricted citator legally defensible with named reviewers? | counsel              | Tier 2 feature        |
| Q6  | What accuracy threshold is acceptable for citation support?      | product + counsel    | AI gating             |
| Q7  | What is the OCR quality of the oldest needed documents?          | engineering          | coverage cost         |
| Q8  | Does any official source offer a data licence/API?               | owner + counsel      | acquisition strategy  |

## 5. What would change the recommendations

- Counsel authorizes only a narrow source set → narrow the product to that set and
  defer broad search.
- A government API appears → acquisition cost drops; the moat shifts further to
  verification and workflow.
- Anycase adds a citator → the window narrows; speed to authority state matters.
- Independent testing shows current PH AI is unreliable → strengthen abstention
  and verification-first positioning.
- Users refuse to pay for verification → revisit B (assistant) with strict
  gating, or institutional sales.

## 6. Honest bottom line

The dossier is strong on **what the international products document**, **how
authority state is modelled**, and **what the Philippine infrastructure lacks**.
It is weak on **prices**, **retrieval benchmarks**, **paywalled UI detail** and
**Philippine demand**. Those weaknesses are stated rather than papered over.
