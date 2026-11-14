# 09 — Jurisdiction Comparison

**Research date:** 2026-11-14
**Caveat:** legal concepts, citation conventions and source authority are **not**
interchangeable. This table compares _information infrastructure_, not legal
doctrine. Items marked `U` were inaccessible or undocumented in this pass.

## 1. Comparison

| Jurisdiction       | Authoritative primary sources                                             | Widely used secondary services                                         | Legal information ecosystem                          | Public access mechanisms                                  | Notable innovation                                                                      | Transferable lesson                                                 |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **United States**  | Congress.gov / govinfo (statutes), court websites, PACER (filings)        | Westlaw, LexisNexis, Bloomberg Law, HeinOnline, Caselaw Access Project | Publisher-dominated; very large free case-law layer  | PACER (fee), CourtListener/RECAP (free), CAP (historical) | Editorial citators (KeyCite/Shepard's), litigation analytics, citation-lookup API (S07) | Citator + citation verification API are the durable differentiators |
| **United Kingdom** | legislation.gov.uk (revised statutes), Find Case Law / BAILII (judgments) | Westlaw UK, LexisNexis UK, Practical Law                               | Official digital statute book with point-in-time law | Free (OGL)                                                | Point-in-time versions + effects metadata, including unapplied effects (S08)            | Effects ledger + explicit `unapplied` state                         |
| **Canada**         | federal/provincial legislation sites, court sites                         | CanLII (non-profit), Westlaw, LexisNexis                               | Strong non-profit free-access layer                  | CanLII free (access blocked here, `U`)                    | National non-profit case-law platform                                                   | Public-interest corpus ownership is viable                          |
| **Australia**      | Federal Register of Legislation, court sites                              | AustLII, Westlaw, LexisNexis                                           | University-backed open infrastructure                | AustLII free (403 here, `U`)                              | Long-running open legal information institute                                           | Open infra needs institutional backing                              |
| **European Union** | EUR-Lex / Official Journal (L and C series)                               | national databases, Westlaw, LexisNexis, vLex                          | Multilingual, multi-level legal order                | EUR-Lex free; OJ authenticity verification (S15)          | ELI stable identifiers, consolidation (details `U`)                                     | Stable identifiers + consolidation metadata                         |
| **India**          | India Code, court sites, Gazette                                          | Indian Kanoon, SCC Online, LexisNexis                                  | Huge, uneven corpus; strong free search              | Indian Kanoon free (403 here, `U`)                        | Large-scale search over heterogeneous case law                                          | Scale is not the same as authority control                          |
| **Singapore**      | Singapore Statutes Online (AGC)                                           | LawNet (commercial), LexisNexis                                        | Compact, highly structured statute book              | SSO free (S14)                                            | Current / repealed-spent / uncommenced buckets; revised editions; daily updates         | Status buckets as a first-class product feature                     |
| **Hong Kong**      | Hong Kong e-Legislation, Judiciary judgments                              | HKLII, Westlaw, LexisNexis                                             | Common-law system with bilingual materials           | HKLII free (no content returned, `U`)                     | Bilingual legal information (details `U`)                                               | Bilingual citation handling                                         |
| **Philippines**    | Supreme Court E-Library, Official Gazette                                 | LawPhil, Anycase, international publishers (limited)                   | Fragmented official sources; no citator; emerging AI | Free portals; no API observed (S10, S11, S12)             | AI research with local pricing (Anycase, S13)                                           | The gap is authority state + verifiable citations                   |

## 2. What is genuinely different across jurisdictions

1. **Effectivity rules.** The UK commences statutes by order and models
   commencement explicitly. The US has federal/state variation and editorial
   codes. The Philippines has its own publication/effectivity rules that counsel
   must confirm; none of the foreign models can be assumed to apply.
2. **Citation conventions.** US citations are reporter-based; UK neutral
   citations; Philippine citations are G.R. numbers, statute numbers and section
   references. A parser built for one will fail on another.
3. **Language.** The EU is multilingual; Hong Kong is bilingual; Philippine legal
   text is English with Filipino statutory/administrative terminology. Semantic
   models trained on US English will miss Philippine usage.
4. **Court structure.** Only the US has a mature commercial litigation-analytics
   market; the Philippine equivalent (judge/panel analytics) raises privacy and
   ethics questions that must be assessed separately, not copied.
5. **Publication authority.** In the UK, legislation.gov.uk is the official
   revised statute book. In the Philippines, the E-Library and Official Gazette
   are official publications, but neither presents a consolidated statute book
   with effects.

## 3. Non-interchangeability warnings

- **Citator treatment ≠ jurisprudence doctrine.** US "negative treatment"
  categories do not map onto Philippine _stare decisis_, _ratio decidendi_ or
  doctrinal treatment. Do not import the labels.
- **UK commencement ≠ PH effectivity.** A UK commencement order is a specific
  instrument; Philippine effectivity may depend on publication and statutory
  clauses. Model the _data_, not the foreign rule.
- **EU consolidation ≠ official codification.** A consolidated EU text is a
  documentation aid; the same is true of any Philippine consolidation the project
  produces.
- **Open licence ≠ global permission.** OGL covers UK Crown content; it says
  nothing about Philippine sources.
- **Scale ≠ quality.** Indian Kanoon indexes a vast corpus; that does not mean its
  results are legally sufficient.

## 4. Lessons ranked by transferability

| Rank | Lesson                                                           | Source                       | Why it transfers                                  |
| ---- | ---------------------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| 1    | Explicit status buckets and version dates                        | SSO, legislation.gov.uk      | Pure data modelling; no foreign law needed        |
| 2    | Effects ledger with commencement and `unapplied` states          | legislation.gov.uk           | Directly addresses PH amendment/repeal complexity |
| 3    | Citation lookup/verification as a service                        | CourtListener                | Language-agnostic pattern; PH parser needed       |
| 4    | Stable provision identifiers                                     | legislation.gov.uk           | Needed for citations and diffs                    |
| 5    | Separate authority classes for source/reproduction/annotation/AI | all publishers               | Prevents category errors                          |
| 6    | Editorial treatment only with named reviewers                    | Westlaw/Lexis                | Protects against unsupported "overruled" claims   |
| 7    | Public-interest or institutional backing for open access         | CanLII/AustLII (as reported) | Sustainability model, not technology              |
| 8    | Cross-jurisdiction comparison workflows                          | Vincent, Westlaw             | Useful later; not a first-release need            |

## 5. Philippine position

The Philippines is not a smaller version of any of these markets. It has:

- official sources with real but uneven digitisation (S10, S11);
- a free secondary compilation with an explicit accuracy disclaimer (S12);
- one local AI product with public pricing but no citator or published evaluation
  (S13);
- no observed public API, no stable provision identifiers, no consolidated
  statute book with effects.

That is a **gap in infrastructure**, not a gap in demand. The jurisdiction
comparison supports building the infrastructure layer first.
