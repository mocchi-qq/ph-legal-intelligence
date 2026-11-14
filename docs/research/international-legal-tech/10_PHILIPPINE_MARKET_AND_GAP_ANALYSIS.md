# 10 — Philippine Market and Gap Analysis

**Research date:** 2026-11-14
**Rule:** every claim below is labelled `VERIFIED`, `COMPANY CLAIM`,
`HYPOTHESIS` (to be tested) or `UNKNOWN`. Hypotheses are not findings.

## 1. What exists (verified)

| Resource                      | Operator                      | What it provides                                                                                                                                 | Verified limitations                                                                        |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Supreme Court E-Library (S10) | SC Library Services           | SC decisions 1996–2026, Philippine Reports e-books, RA/PD/EO/AO/MC/MO, Rules of Court, constitutions, treaties, National Administrative Register | no citator/API observed; monthly index has missing months; no consolidated statute versions |
| Official Gazette (S11)        | Office of the President (PCO) | official journal: RAs, EOs, proclamations, AOs, MCs, MOs, master list, constitutions                                                             | publication-oriented, not a research system; no citation graph or versioning observed       |
| LawPhil (S12)                 | Arellano Law Foundation       | secondary compilation of jurisprudence/statutes                                                                                                  | AUP disclaims accuracy; informational only; no citator/API                                  |
| Anycase (S13)                 | Anycase.ai                    | PH legal AI, 140k–160k docs claimed, daily updates, drafting, uploads                                                                            | no citator; corpus count inconsistent between pages; no published evaluation                |
| International publishers      | Westlaw/Lexis/Bloomberg/vLex  | limited or no PH-specific coverage                                                                                                               | vLex coverage list excludes PH (S03); others not PH-focused                                 |

**Verified structural gaps**

1. **No public citator.** No Philippine service was found that records positive/
   negative treatment of jurisprudence at scale.
2. **No stable provision identifiers or public API.** Neither the E-Library nor
   the Gazette exposes one (observed).
3. **No consolidated statute book with effects.** Statutes are published, not
   maintained as versioned texts with amendment/repeal edges.
4. **Incomplete digitisation is visible.** The E-Library's monthly index omits
   several months (e.g. 2026 May and Sep–Nov; 2024 Mar; 2023 May/Aug/Sep) as of
   2026-11-14.
5. **Free does not mean reusable.** LawPhil disclaims accuracy and grants no
   reuse; the E-Library displays no reuse terms. The authorization matrix is right
   to keep these `UNKNOWN`.

## 2. What the market looks like commercially

- **Anycase** is the only identified PH-native paid AI product with public
  pricing: Free (15 credits), Pro from ₱999/month, Education ₱599/month (S13).
- International platforms are priced for large firms and are not PH-focused.
- No verified public data was obtained on market size, lawyer counts, or
  willingness to pay. **Do not estimate these without a source.**

`COMPANY CLAIM` signals (not market proof): Anycase states 14,000+ legal
professionals and "14 hours saved per week". These are unverified.

## 3. User segments (hypotheses to test)

| Segment                       | Likely job to be done                                  | What would make them pay        | Evidence status |
| ----------------------------- | ------------------------------------------------------ | ------------------------------- | --------------- |
| Litigators in small firms     | find contrary authority; check if a case is still good | citator + fast, citable answers | HYPOTHESIS      |
| Corporate/compliance counsel  | track amendments and regulatory changes                | alerts + versioned statutes     | HYPOTHESIS      |
| Tax practitioners             | BIR issuances + CTA cases                              | regulatory update + citation    | HYPOTHESIS      |
| Government legal offices      | official text + provenance                             | audit trail + official sourcing | HYPOTHESIS      |
| Law students                  | case digests, doctrine search                          | affordable, cited summaries     | HYPOTHESIS      |
| Law professors                | research datasets, citation networks                   | exportable data + APIs          | HYPOTHESIS      |
| Legal researchers/journalists | find relationships, histories                          | graph + timeline                | HYPOTHESIS      |

The international evidence does not settle Philippine demand. It only shows which
capabilities are technically possible and which are expensive.

## 4. Philippine-specific problems: verify before building

| Hypothesis                                               | Status                                                           | What would verify it                  |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| Inconsistent metadata across official sources            | PARTLY VERIFIED — E-Library and Gazette use different structures | sample 50 documents across both       |
| Multiple citation formats for the same case              | HYPOTHESIS                                                       | corpus-wide citation extraction       |
| Multiple versions of statutes circulate                  | HYPOTHESIS                                                       | compare RA texts across sources       |
| Amendment/repeal relationships are not machine-readable  | VERIFIED for the sources observed (no effects data)              | confirm with counsel/publishers       |
| Historical validity is hard to establish                 | HYPOTHESIS (strong)                                              | user interviews + task tests          |
| OCR quality is poor for older documents                  | UNKNOWN                                                          | sample scanned decisions              |
| Related jurisprudence is hard to find                    | HYPOTHESIS                                                       | task-based usability test             |
| Conflicting/outdated references are common               | HYPOTHESIS                                                       | citation audit of published pleadings |
| Passage-level citations are rare                         | VERIFIED in the product landscape (no PH tool claims it)         | —                                     |
| Advanced search is limited                               | PARTLY VERIFIED (E-Library search UI only)                       | feature audit                         |
| Government legal information is fragmented               | VERIFIED (multiple portals, no shared IDs)                       | —                                     |
| Students lack affordable tools                           | HYPOTHESIS                                                       | student survey                        |
| Philippine terminology/abbreviations break foreign tools | HYPOTHESIS                                                       | query test set                        |

## 5. The underserved job

Across segments, the recurring job is not "answer my question". It is:

> "Show me the authority, in the version that applied, with the passage that
> supports the proposition, and tell me what you could not verify."

That job is underserved because it requires:

- stable documents and versions (no PH infrastructure);
- citation parsing and resolution (no PH service);
- passage alignment (no PH tool);
- explicit uncertainty (contrary to AI marketing);
- source authorization and provenance (the project's Gates 4–7).

## 6. Competitive response risk

- **Anycase** could add a citator or API. Its current differentiation is price and
  local AI, not authority state.
- **International publishers** could add PH content if licensing made it
  worthwhile. They have not, which suggests the market is small or the rights are
  hard — both are signals, not proofs.
- **Government** could publish structured data. That would help the project
  (better inputs) and reduce one moat, but would not solve citation verification
  or workflow.

## 7. What the evidence does not support

- A claim that Philippine lawyers will pay a specific price. No verified data.
- A claim that the corpus is "complete" or "authoritative". The official index
  itself has gaps.
- A claim that AI answers are reliable in Philippine law. No evaluation exists.
- A claim that international platforms ignore the Philippines for lack of
  interest. The reason is `UNKNOWN`.

## 8. Conclusion

The Philippine market has demand signals (a paid local AI product, a large
professional base claimed by that vendor) but no verified infrastructure for
authority state. The project should not compete on "more AI" or "more documents".
It should compete on **verified authority and reproducible citations**, and it
should validate demand with interviews before pricing anything.
