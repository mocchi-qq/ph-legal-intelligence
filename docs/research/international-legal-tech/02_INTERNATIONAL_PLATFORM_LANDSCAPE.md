# 02 — International Platform Landscape

**Research date:** 2026-11-14
**Method:** `01_RESEARCH_METHODOLOGY.md`
**Evidence classes:** `VERIFIED FACT` = directly observed in an official/primary source;
`COMPANY CLAIM` = vendor assertion, not independently demonstrated; `INDEPENDENT
EVALUATION`; `USER REPORTED`; `RESEARCH INFERENCE`; `UNKNOWN`.

## 1. How the market actually segments

The brief's categories (database / AI research / specialised / open) are a useful
start but blur two different axes: **who owns the corpus** and **what the product
does with it**. The landscape sorts more cleanly into six groups.

| Group                                  | What it sells                                                  | Examples                                                                                                                 | Structural moat                                                   |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| A. Publisher research platforms        | Licensed primary law + editorial citators + secondary guidance | Westlaw, LexisNexis, Bloomberg Law, vLex/Clio, Wolters Kluwer                                                            | Corpus licences, citator editorial layer, brand trust             |
| B. AI workflow layers                  | AI over their own or partner corpora, plus firm documents      | Harvey, CoCounsel Legal, Lexis+ with Protégé, Vincent, Bloomberg AI Assistant                                            | Distribution, integrations, model orchestration, security posture |
| C. Practice-content publishers         | How-to guides, templates, checklists                           | Practical Law, Bloomberg Practical Guidance, Wolters Kluwer                                                              | Attorney-editor labour, not technology                            |
| D. Open legal infrastructure           | Free primary law + APIs + bulk data                            | CourtListener/Free Law Project, Caselaw Access Project, EUR-Lex, legislation.gov.uk, AustLII, CanLII, Indian Kanoon, SSO | Public data, open licences, non-profit or government mandate      |
| E. Analytics / litigation intelligence | Judge, attorney, party, damages analytics                      | Bloomberg Litigation Analytics, vLex litigation profiles, Lex Machina (LexisNexis)                                       | Docket/data normalisation, entity resolution                      |
| F. Regional AI research (Philippines)  | AI answers over a local corpus                                 | Anycase                                                                                                                  | Local corpus + local language/format handling + price point       |

Two consequences matter for the Philippine project:

1. **Nobody wins group A on search alone.** They win on licensed corpus + citator
   - editorial guidance. A new entrant cannot buy that position.
2. **Group B is where AI quality is contested, and it is already under independent
   scrutiny.** The Stanford evaluation (S09) found 17%–33% hallucination in
   Lexis+ AI, Westlaw AI-Assisted Research and Ask Practical Law AI, despite
   "hallucination-free" marketing.

## 2. The database vs AI distinction, precisely

- **Database-first**: the product is the corpus and its findability. AI is an
  added interface. Westlaw, LexisNexis and Bloomberg are database-first; their AI
  is grounded in content they already license.
- **AI-first**: the product is the workflow. Harvey and (largely) CoCounsel Legal
  sell orchestration over content, some of which is licensed from partners.
- **Infrastructure-first**: the product is access — APIs, bulk data, stable
  identifiers. CourtListener and legislation.gov.uk.
- **Regional AI-first**: Anycase is AI-first over a Philippine corpus it
  assembles; its moat is local coverage and price, not a citator.

A Philippine platform that starts as "AI-first" without a defensible corpus and
citation layer is competing on the weakest axis. The evidence points the other
way: citation/authority infrastructure first, AI second.

## 3. Shortlist (22 platforms)

Deep profiles in `03_PLATFORM_PROFILES.md` are marked **D**; brief profiles **b**.

| #   | Platform                           | Owner                                | Jurisdiction focus                         | Group         | Profile                 |
| --- | ---------------------------------- | ------------------------------------ | ------------------------------------------ | ------------- | ----------------------- |
| 1   | Westlaw / Westlaw Edge / Advantage | Thomson Reuters                      | US, UK, CA, AU + others                    | A+B           | D                       |
| 2   | LexisNexis / Lexis+ with Protégé   | RELX                                 | US, UK, CA, AU, EU + others                | A+B           | D                       |
| 3   | vLex / Vincent by Clio             | Clio (Themis Solutions)              | 100+ countries; PH not listed              | A+B           | D                       |
| 4   | Bloomberg Law                      | Bloomberg Industry Group             | US (federal/state)                         | A+B+E         | D                       |
| 5   | Harvey                             | Harvey AI                            | Global enterprises (85+ countries claimed) | B             | D                       |
| 6   | CoCounsel Legal                    | Thomson Reuters                      | US + 100+ via Practical Law Global         | B             | D                       |
| 7   | Practical Law                      | Thomson Reuters                      | Global                                     | C             | b                       |
| 8   | Wolters Kluwer Legal & Regulatory  | Wolters Kluwer                       | EU/US/global                               | A+C           | b                       |
| 9   | HeinOnline                         | William S. Hein & Co.                | US/UK/global historical                    | A (archive)   | b                       |
| 10  | CourtListener                      | Free Law Project                     | US (472 jurisdictions on site)             | D             | D                       |
| 11  | Caselaw Access Project             | Harvard Law School Library           | US historical                              | D             | b (access limited)      |
| 12  | EUR-Lex                            | EU Publications Office               | EU                                         | D             | b (page access limited) |
| 13  | legislation.gov.uk                 | The National Archives                | UK                                         | D             | D                       |
| 14  | AustLII                            | UNSW / AustLII Foundation            | Australia                                  | D             | b (403)                 |
| 15  | CanLII                             | Canadian Legal Information Institute | Canada                                     | D             | b (403)                 |
| 16  | Indian Kanoon                      | Indian Kanoon                        | India                                      | D             | b (403)                 |
| 17  | Singapore Statutes Online          | AGC Singapore                        | Singapore                                  | D             | b                       |
| 18  | HKLII                              | HKU / HKLII                          | Hong Kong                                  | D             | b (no content returned) |
| 19  | Supreme Court E-Library            | Supreme Court of the Philippines     | Philippines                                | D             | D                       |
| 20  | Official Gazette                   | Office of the President (PCO)        | Philippines                                | D             | b                       |
| 21  | LawPhil                            | Arellano Law Foundation              | Philippines                                | D (secondary) | b                       |
| 22  | Anycase                            | Anycase.ai                           | Philippines                                | F             | D                       |

Access failures are recorded deliberately: CanLII, AustLII, Indian Kanoon and
HKLII returned 403/empty to this research environment. Their capabilities are
`UNKNOWN`, not "absent".

## 3.1 Adjacent and acquired platforms (identified, not profiled)

The shortlist is not exhaustive. These matter because they are **content partners
or acquisitions** behind the AI-first products, and because a Philippine analysis
that ignores them understates corpus dependency:

| Platform                | Why it matters                                             | Status in this pass       |
| ----------------------- | ---------------------------------------------------------- | ------------------------- |
| SCC Online (India)      | content partner inside Harvey Knowledge (S05)              | `UNKNOWN` (not inspected) |
| Wolters Kluwer          | global publisher; Harvey partner (S05)                     | brief profile only        |
| Lex Machina             | litigation analytics, owned by LexisNexis (S02)            | `UNKNOWN` (not inspected) |
| Casetext                | acquired by Thomson Reuters; now part of CoCounsel lineage | `UNKNOWN` (not inspected) |
| Fastcase / Docket Alarm | acquired by vLex/Clio (reported; not verified here)        | `UNKNOWN`                 |
| Droit (Canada)          | regulatory/obligation analytics                            | `UNKNOWN`                 |
| Jusbrasil (Brazil)      | large regional legal portal                                | `UNKNOWN`                 |
| LegalOn (Japan/US)      | contract review AI                                         | `UNKNOWN`                 |

Their existence strengthens the main finding: AI-first products depend on
licensed or acquired content, not on model quality alone.

## 4. What changed recently (product packaging)

Verified from official pages on 2026-11-14:

- **LexisNexis renamed Lexis+ AI to "Lexis+ with Protégé" in February 2026** and
  now positions a single assistant across research, drafting and analysis (S02).
- **vLex is now branded "Vincent by Clio"**, with Clio Library as the corpus brand
  (S03). The Vincent coverage list on the page does **not** include the
  Philippines, contradicting the repository's 2026-11-09 competitor note that said
  "Philippines included".
- **Thomson Reuters sells CoCounsel Legal as the AI layer over Westlaw + Practical
  Law Global**, plus Westlaw Advantage (agentic Deep Research) as a separate
  research tier (S01, S06).
- **Bloomberg Law** markets "one platform, one price" and has acquired Regology
  for regulatory intelligence (S04).
- **Harvey** has expanded from document analysis into a platform with Knowledge
  (research), Agents, Vault, Spaces and orchestration (S05).

These are packaging facts, not quality claims. They matter because a 2024-era
comparison is already wrong in 2026.

## 5. What is genuinely differentiating (verified)

| Capability                                                       | Who demonstrably has it                                       | Evidence                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| Editorial citator with treatment signals                         | Westlaw (KeyCite), LexisNexis (Shepard's)                     | S01, S02                    |
| Point-in-time legislation with amendment effects                 | legislation.gov.uk                                            | S08                         |
| Citation lookup as an anti-hallucination API                     | CourtListener                                                 | S07                         |
| Structured statute status buckets (current/repealed/uncommenced) | Singapore SSO                                                 | S14                         |
| Passage-linked citations in AI answers                           | CoCounsel, Vincent, Lexis                                     | S02, S03, S06 (vendor docs) |
| Cross-jurisdiction comparison workflows                          | Vincent (50-state, compare jurisdictions), Westlaw AI surveys | S01, S03                    |
| Docket-grounded analytics                                        | Bloomberg, vLex                                               | S03, S04                    |
| Citation verification of _its own_ AI output                     | Lexis Shepard's Verify                                        | S02                         |

## 6. What is mostly marketing

- "Hallucination-free" / "eliminates hallucinations": contradicted by S09.
- "Works at the level of a senior associate": unfalsifiable; no public benchmark.
- "Most comprehensive" / "industry-leading": unverifiable without corpus audits.
- Productivity percentages (38%, 33%, 25 hours): vendor- or vendor-commissioned
  studies; treat as `COMPANY CLAIM`.
- "Trained on legal data": architecture generally undisclosed; `UNKNOWN`.
- "AI-powered" features that are summarisation or classification: real, but not
  the same as legal reasoning.

## 7. The gap the Philippine project can occupy

Across all categories, the recurring underserved need is **defensible authority
state**: not "an answer", but "this provision, in this version, was in force on
this date, amended by these instruments, and these decisions treated it this
way — with the source linked". Publisher platforms do this through expensive
editorial operations; open infrastructure does fragments of it; regional AI tools
skip it.

Judgement: that is the most plausible position where a small team can be _better_
rather than cheaper. It is also the position the repository's Gates 1–7 already
point at (identity, versioning, citation verification, authorization provenance).
