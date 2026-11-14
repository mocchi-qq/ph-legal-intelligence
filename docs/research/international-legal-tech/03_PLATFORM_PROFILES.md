# 03 — Platform Profiles

**Research date:** 2026-11-14
**Legend:** `V` VERIFIED (documented in an official source or directly observed) ·
`P` PARTIALLY VERIFIED · `N` NOT FOUND · `NA` NOT APPLICABLE · `U` UNKNOWN.
`V` means "the feature is documented in a public source", not "the feature works as
claimed" and not "the mechanism is disclosed". Vendor architecture and performance
claims are `P` or `COMPANY CLAIM`. Source IDs refer to `15_SOURCE_REGISTER.md`.

---

## D1. Westlaw / Westlaw Edge / Westlaw Advantage

**Identity.** Thomson Reuters. US-centred with UK/Canada/Australia/international
content. Law firms, corporate, government, academic. Commercial subscription.
(S01)

**Core functionality.**

| Feature                                         | Status | Evidence                                                        |
| ----------------------------------------------- | ------ | --------------------------------------------------------------- |
| Full-text search, Boolean, citation search      | V      | standard Westlaw behaviour; pricing/feature pages               |
| Natural-language / AI answers                   | V      | AI-Assisted Research (Edge), Deep Research (Advantage)          |
| Citator with treatment                          | V      | KeyCite; "KeyCite Overruling Risk"                              |
| Statute/regulation version comparison           | V      | "compare any two versions of a statute or regulation" (S01)     |
| Related-authority discovery via document upload | V      | upload a brief to find missed/contrary authority (S01)          |
| Litigation analytics                            | V      | judges, courts, attorneys, firms, damages (S01)                 |
| Jurisdictional surveys                          | V      | "AI Jurisdictional Surveys" (S01)                               |
| Brief checking                                  | V      | "AI-enhanced Quick Check" (S01)                                 |
| Agentic multi-step research                     | V      | Westlaw Advantage "Deep Research" (S01)                         |
| Passage-level citation in AI output             | P      | marketing shows linked citations; exact passage granularity `U` |
| Conflicting-authority detection                 | V      | KeyCite flags + contrary-authority upload (S01)                 |

**Infrastructure.** Licensed primary law plus editorial enhancements. KeyCite is
an editorial classification layer over citing references, not raw text matching.
Version comparison implies stored historical versions. Provenance is shown as
citation links, not as a full source-lineage model. Update frequency and
conflict-handling policy: `U`.

**AI.** AI-Assisted Research and Deep Research are grounded in Westlaw content and
return linked citations (vendor docs). Retrieval architecture is undisclosed.
The independent Stanford evaluation found Westlaw AI-Assisted Research hallucinated
in 17%–33% of tested queries across systems (S09); it tested 2022–23 versions, not
the 2026 products. Quality is real but not guaranteed.

**UX.** Search-first; filters by jurisdiction/court/date; folder-based research
organisation; KeyCite flags inline; document comparison view. Accessibility and
mobile: `U`.

**Commercial.** Published plan pages exist, but the repository will not repeat
prices that were not re-verified on a live page during this research; treat
pricing as quote-based (`U` for exact figures). Law-firm segmentation and free
trials exist.

**Strengths.** Deepest citator + editorial layer; version comparison; document
checking against authority; integrated Practical Law guidance.
**Weaknesses for PH.** US/Commonwealth-centric corpus; Philippine coverage not a
product focus; cost and seat licensing; no Philippine-language/format handling.

---

## D2. LexisNexis / Lexis+ with Protégé

**Identity.** RELX. US, UK, Canada, Australia, EU and others. Law firms,
corporate, government, academic. Commercial. (S02)

**Core functionality.**

| Feature                                    | Status | Evidence                                                                                                                                         |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full-text/Boolean/citation search          | V      | core LexisNexis research                                                                                                                         |
| Citator with treatment                     | V      | Shepard's                                                                                                                                        |
| Citation verification inside AI output     | V      | "Shepard's Verify checks citations in AI responses, documents, and drafts — surfacing legal authority and flagging unsupported statements" (S02) |
| AI research + drafting + analysis          | V      | Protégé across research, drafting, integrations (S02)                                                                                            |
| Multi-model AI (legal-optimised + general) | V      | Protégé Legal AI blends multiple LLMs; General AI uses OpenAI/Google/Anthropic (S02)                                                             |
| Document vault with retention limits       | V      | 50 vaults, 1–500 docs; 10-doc sessions purged; results 90 days (S02)                                                                             |
| DMS integration                            | V      | iManage, SharePoint, NetDocuments (S02)                                                                                                          |
| Passage-level support                      | P      | "verified and traceable" (S02); exact passage UI not inspectable                                                                                 |
| Contradictory-authority detection          | P      | "flags unsupported statements" (S02); scope `U`                                                                                                  |

**Infrastructure.** Licensed primary law + "exclusive secondary sources" +
Practical Guidance (25 practice areas). Shepard's is an editorial citator. The
company claims 2,000+ technologists/data scientists/SMEs involved in AI (COMPANY
CLAIM). Customer data is not used to train models (S02).

**AI.** Protégé is the assistant; "Shepard's Verify" is the distinctive piece —
citation checking applied to generated text, not just retrieval. That is the
closest documented analogue to the project's citation-verification gate.
Independent evaluation (S09) tested the earlier Lexis+ AI product and found
17%–33% hallucination across the systems tested.

**UX.** Single prompt box plus traditional search; Workrooms for collaboration;
Vault for document sets; integration into Microsoft 365.

**Commercial.** No public price; custom quote; 2-day trial (S02).

**Strengths.** Citator + verification of its own output; strong secondary sources;
DMS integrations.
**Weaknesses for PH.** US/UK-centric; Philippines is not a core content market;
opaque architecture; cost.

---

## D3. vLex / Vincent by Clio

**Identity.** Clio (Themis Solutions Inc.). Global: 100+ countries, 1B+ documents,
25+ years of data. Coverage page lists Brazil, Chile, Colombia, Ecuador, EU,
France, Hong Kong, Ireland, Italy, Mexico, New Zealand, Peru, Portugal, Singapore,
Spain, UK, US — **the Philippines is not listed** (S03).

**Core functionality.**

| Feature                                   | Status | Evidence                                                                       |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Global full-text search                   | V      | Clio Library (S03)                                                             |
| Natural-language research with cited memo | V      | "Ask a Research Question" → fully cited memo with links (S03)                  |
| Multi-jurisdiction surveys                | V      | 50-state survey; compare jurisdictions (S03)                                   |
| Litigation document analysis              | V      | complaint/pleadings/proceeding analysis (S03)                                  |
| Judicial/attorney/party analytics         | V      | litigation profiles (S03)                                                      |
| Contract/redline comparison               | V      | (S03)                                                                          |
| Semantic/vector retrieval                 | V      | company article: vector search over 1B documents (S03)                         |
| Hybrid retrieval                          | V      | "hybrid AI pipeline combines generative and rules-based AI" (S03)              |
| Passage-level citation                    | P      | "full citations with direct links to primary sources"; passage granularity `U` |

**Infrastructure.** Aggregated global corpus from publishers and public sources;
country-specific workflows. The coverage list is the single most important fact
for this project: a "global" platform can still exclude the Philippines.

**AI.** Vincent uses a "Workflow Engine" with agents selecting tools, not a single
open prompt (S03). Company claims 38% productivity gain and 3.67× reliability vs
leading LLMs, from studies it cites but does not publish in full on the page
(COMPANY CLAIM). Zero-retention agreements with LLM providers claimed.

**Commercial.** No public pricing; free trial; bar-association partnerships
historically used for distribution (`U` for current list).

**Strengths.** Genuine cross-jurisdiction workflows; hybrid retrieval; strong
integration of analytics and documents.
**Weaknesses for PH.** Philippines absent from the stated coverage; workflows
built around US/Commonwealth structures; no Philippine citator.

---

## D4. Bloomberg Law

**Identity.** Bloomberg Industry Group. US federal/state focus plus international
news. Law firms, in-house, government, law schools. Commercial, flat-fee model
("one platform, one price"). (S04)

**Core functionality.**

| Feature                                | Status | Evidence                                                                            |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Primary + secondary research           | V      | all-in-one platform (S04)                                                           |
| Dockets and court filings              | V      | Docket Search; RECAP-like coverage                                                  |
| AI classification of docket entries    | V      | 200+ motion/brief types classified (S04)                                            |
| AI summaries + conversational research | V      | AI Assistant, complaint/case/statute summaries (S04)                                |
| Cross-jurisdiction rule comparison     | V      | Chart Builder (S04)                                                                 |
| Contract benchmarking                  | V      | Draft Analyzer, ML against market standard (S04)                                    |
| Litigation analytics                   | V      | judges, courts, firms, attorneys (S04)                                              |
| Citator with treatment                 | U      | not documented on the pages inspected; older "Points of Law" branding not confirmed |
| Passage-level citations                | U      | "transparent about its sources" (S04); granularity not shown                        |

**Infrastructure.** Licensed primary law, own newsroom (40+ channels, 250+
reporters claimed), dockets, company data. Acquired Regology for regulatory
intelligence (S04). Editorial analysis is a differentiator.

**AI.** Pragmatic, task-specific AI (summarise, classify, compare, benchmark)
rather than a general legal chatbot. That is a useful pattern: narrow, verifiable
tasks beat open-ended "ask anything".

**Commercial.** No public price; "one platform, one price" positioning; request
pricing.

**Strengths.** Dockets + news + analytics in one product; task-specific AI.
**Weaknesses for PH.** US-centric; no Philippine corpus; citator capability not
publicly documented.

---

## D5. Harvey

**Identity.** Harvey AI. Enterprise law firms and in-house teams; 85+ countries
claimed; 3,500+ organisations and 200,000+ professionals claimed. Commercial,
enterprise-only. (S05)

**Core functionality.**

| Feature                               | Status | Evidence                                                                                         |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Legal research over partner databases | V      | Knowledge connects to LexisNexis, SCC Online, Wolters Kluwer, EUR-Lex, EDGAR, 500+ sources (S05) |
| Document vault / knowledge bases      | V      | Vault; Vault Knowledge Bases (S05)                                                               |
| Multi-step agents                     | V      | Agents, Legal Work Orchestration (S05)                                                           |
| Contract review                       | V      | Contract Intelligence (S05)                                                                      |
| Regulatory horizon scanning           | V      | Horizon Scanning (S05)                                                                           |
| Shared workspaces with ethical walls  | V      | Spaces (S05)                                                                                     |
| Usage analytics                       | V      | Command Center (S05)                                                                             |
| Own corpus                            | N      | relies on partner/licensed content and customer documents                                        |
| Citator / treatment                   | U      | not Harvey's own; may inherit partner data                                                       |

**Infrastructure.** No owned primary-law corpus; it is an orchestration and
retrieval layer over licensed databases plus customer documents. That is the
clearest "AI-first" architecture in the set, and it depends commercially on
content partnerships.

**AI.** Agents, memory, MCP connectors; model-agnostic orchestration. Security:
SOC 2 II, ISO 27001/27701/42001, FedRAMP Class D claimed (S05). Architecture
details are `U`.

**Commercial.** No public pricing; enterprise contracts. A company blog headline
claims a $15.5B valuation (S05; `COMPANY CLAIM`, volatile).

**Strengths.** Enterprise workflow breadth; partner-content strategy; security
posture.
**Weaknesses for PH.** No Philippine corpus of its own; value depends on a
partner with PH content (none identified); enterprise pricing excludes most
Philippine practitioners.

---

## D6. CoCounsel Legal (Thomson Reuters)

**Identity.** Thomson Reuters. AI layer over Westlaw + Practical Law Global
(100+ jurisdictions) + organisation documents. Law firms, in-house, government.
Commercial. (S06)

**Core functionality.**

| Feature                                | Status | Evidence                                                                         |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Agentic research + analysis + drafting | V      | single query → plan → work product (S06)                                         |
| Transparent step-by-step reasoning     | V      | "every step of the reasoning is visible" (S06)                                   |
| Linked citations for verification      | V      | "every citation is linked so attorneys can click through" (S06)                  |
| Brief building                         | V      | Westlaw Brief Builder (S06)                                                      |
| Bulk document review                   | V      | Tabular Analysis: 10,000 docs × 100 questions, traceable answers (S06)           |
| Litigation document analysis           | V      | Litigation Document Analyzer (S06)                                               |
| Workspaces / matter memory             | V      | Workspaces (S06)                                                                 |
| Integrations                           | V      | Word, Outlook, Teams, iManage, NetDocuments, SharePoint, HighQ, Claude MCP (S06) |
| Conflicting-authority detection        | P      | implied by Westlaw grounding; not explicitly documented on the page              |

**AI.** Visible reasoning + linked citations is the strongest documented
"verifiability UX" among the AI-first products. Still vendor-documented; the
Forrester ROI figures are vendor-commissioned (COMPANY CLAIM).

**Commercial.** Plans page exists; no public per-seat figures verified here.
Free trial offered.

**Strengths.** Research-to-draft continuity; citation-linked output; Westlaw and
Practical Law grounding.
**Weaknesses for PH.** Corpus is the constraint: Practical Law Global covers 100+
jurisdictions, but Philippine primary law is not a documented strength.

---

## D7. CourtListener (Free Law Project)

**Identity.** Non-profit Free Law Project. US federal and state. Free public
access; paid memberships and commercial data agreements. (S07)

**Core functionality.**

| Feature                          | Status | Evidence                                                                                |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Case law search                  | V      | 8.3M precedential opinions; 472 jurisdictions on site                                   |
| Citation lookup and verification | V      | API parses/verifies citations, explicitly to "fight hallucinations in AI tools" (S07)   |
| Citation graph                   | V      | citation graph APIs to traverse citing relationships (S07)                              |
| PACER/RECAP dockets              | V      | ~half a billion items claimed (S07)                                                     |
| Judge database                   | V      | biographical data (S07)                                                                 |
| Alerts                           | V      | email/webhook alerts (S07)                                                              |
| Oral argument archive            | V      | largest collection claimed (S07)                                                        |
| Bulk data                        | V      | data services (S07)                                                                     |
| Citator treatment classification | P      | citation graph exists; editorial positive/negative treatment is not the same as KeyCite |

**Infrastructure.** Open source (Django), public APIs, bulk data, stable URLs.
Rate limits for authenticated users: 5/min, 50/hour, 125/day; higher via
membership or commercial agreement (S07). This is the best-documented example of
citation verification as a _service_ rather than a UI feature.

**AI.** No first-party legal chatbot on the pages inspected. Its strategic role is
as a guardrail layer for other people's AI.

**Commercial.** Free; membership; commercial data agreements.

**Lessons for PH.** A citation-lookup API over official citations is buildable
without a giant corpus and is directly useful for hallucination control. The
project's Gate 3 citation engine is the same idea; CourtListener proves the
service shape.

---

## D8. legislation.gov.uk (The National Archives)

**Identity.** UK Government. Free. Official revised statute book. (S08)

**Core functionality (directly observed in the XML API).**

| Feature                                 | Status | Evidence                                                                 |
| --------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Point-in-time versions                  | V      | ~100 `hasVersion` URIs per Act, from `enacted` to dated snapshots (S08)  |
| Revised/consolidated status             | V      | `DocumentStatus Value="revised"`, `dct:valid 2026-10-30` (S08)           |
| Version replacement chain               | V      | `dct:replaces` / `isReplacedBy` (S08)                                    |
| Amendment effects with commencement     | V      | `UnappliedEffect`, `InForceDates`, commencement authority, savings (S08) |
| Prospective/unapplied effects disclosed | V      | effects marked "not applied to legislation.gov.uk" (S08)                 |
| Stable identifiers                      | V      | `IdURI`, per-section URIs (S08)                                          |
| Multiple machine formats                | V      | XML, AKN, RDF, CSV, PDF, HTML (S08)                                      |
| Explanation of whether text is in force | P      | effects carry dates/qualifications; user must interpret                  |
| Citator for case treatment              | N      | not a case citator; statutes only                                        |

**The critical lesson.** Even the official UK revised statute database carries
effects that are **not applied**, with notes such as "This amendment not applied
to legislation.gov.uk" and prospective commencements. A consolidated text is not
proof of current law; the _effects metadata_ is the real product. Any Philippine
platform that shows "current version" without effect metadata is overclaiming.

**Commercial.** Free, Open Government Licence v3.0 with stated exceptions.

---

## D9. Supreme Court E-Library (Philippines)

**Identity.** Supreme Court of the Philippines Library Services. Official. Free.
(S10)

**Core functionality (directly observed).**

| Feature                                         | Status | Evidence                                        |
| ----------------------------------------------- | ------ | ----------------------------------------------- |
| SC decisions and signed resolutions             | V      | monthly archive 1996–2026 (S10)                 |
| Philippine Reports e-books                      | V      | dedicated section (S10)                         |
| Statutes: Acts, BP, CA, PD, RA                  | V      | Bookshelf sections (S10)                        |
| Constitution, Rules of Court                    | V      | Bookshelf sections (S10)                        |
| Executive issuances (EO/AO/MC/MO/Proclamations) | V      | Bookshelf sections (S10)                        |
| National Administrative Register                | V      | Bookshelf section (S10)                         |
| Treaties (bilateral/regional)                   | V      | Bookshelf sections (S10)                        |
| Keyword search                                  | P      | search page exists; ranking/recall not assessed |
| Citation search                                 | U      | not documented                                  |
| Citator / treatment                             | N      | none observed                                   |
| Amendment/repeal tracking                       | U      | not exposed as structured data                  |
| API / bulk data                                 | N      | none observed                                   |
| Versioning of statutes                          | U      | no consolidated-version UI observed             |

**Observed availability gaps.** The monthly index has no links for 2026 May and Sep–Nov, 2024 Mar,
2023 May/Aug/Sep, 2017 May and 2012 May (as of 2026-11-14; December is not yet due).
This is direct evidence that "official" does not mean "complete or uniformly
updated".

**Commercial / reuse.** Free public access. No reuse licence is displayed on the
pages inspected; the project's authorization gate correctly treats this as
`UNKNOWN`, not permission.

---

## D10. Anycase.ai (Philippines)

**Identity.** Anycase.ai, Makati. Philippine-focused legal AI. Free tier +
subscriptions. (S13)

**Core functionality.**

| Feature                                            | Status        | Evidence                                                |
| -------------------------------------------------- | ------------- | ------------------------------------------------------- |
| Philippine legal research (cases, laws, issuances) | V (vendor)    | 160k+ docs homepage / 140k+ pricing page (inconsistent) |
| Daily-updated library                              | V (vendor)    | claim on both pages                                     |
| AI analysis with citations                         | V (vendor)    | "legal basis clearly cited"                             |
| Full-text reading + PDF download                   | V (vendor)    | pricing/feature page                                    |
| Document/image upload                              | V (vendor)    | PDF/.docx/.txt, up to 5 images                          |
| Drafting                                           | V (vendor)    | "draft and revise documents"                            |
| Bar-question testing claim                         | COMPANY CLAIM | no published evaluation                                 |
| 14,000+ users / 14 hours saved                     | COMPANY CLAIM | marketing                                               |
| Citator / treatment                                | N             | not claimed                                             |
| Versioned statutes / amendment tracking            | U             | not claimed                                             |
| Public API                                         | N             | none advertised                                         |

**Commercial (verified 2026-11-14).** Free: ₱0, 15 credits. Pro: from ₱999/month
(or ₱799/month billed yearly). Education: ₱599/month (₱499 yearly), .edu email
required. (S13)

**Strengths.** Only identified Philippine-native AI research product with public
pricing; local content; low price point; mobile/desktop.
**Weaknesses / opportunity.** No citator, no documented versioning, no API, no
independently published accuracy evaluation, and a 160k vs 140k corpus-count
inconsistency. The defensible counter-position is authority state and
verifiability, not "more AI".

---

## Brief profiles

### Practical Law (Thomson Reuters) — b

Practice-content publisher: 650+ attorney editors, how-to guides, templates,
checklists across major practice areas (S01). Sold alongside Westlaw/CoCounsel.
Lesson: editorial guidance is labour-intensive and is a moat, not a feature.

### Wolters Kluwer Legal & Regulatory — b

Global publisher of legal/regulatory content and workflow tools; also a content
partner inside Harvey's Knowledge product (S05). Public product-specific
capability detail was not accessible in this pass (`U`). Lesson: content
licensing to AI platforms is now a distribution channel.

### HeinOnline — b

Historical legal archive (US/UK/international journals, statutes, cases). Not
inspected in depth (`U`). Lesson: historical depth is a separate product from
current-law research; the project's temporal model is different work.

### Caselaw Access Project — b

Harvard Law School Library's historical US case-law digitisation project.
Public site returned no readable content to this environment (S16). Capabilities
`U`. Lesson: bulk historical digitisation is a multi-institution effort.

### EUR-Lex — b

EU Publications Office. Daily Official Journal (Series L/C), authenticity
verification page (S15). Consolidated-text and ELI pages were JS-blocked in this
pass (`U`). Lesson: multilingual, multi-instrument legal systems need stable
identifiers (ELI) and consolidation metadata; do not assume accessible UI.

### AustLII — b

Australian open legal information institute. Access blocked (403) (S16).
Capabilities `U`. Lesson: long-running open infrastructure is usually
institution-backed.

### CanLII — b

Canadian Legal Information Institute. Access blocked (403) (S16). Capabilities
`U`. Lesson: a national non-profit can own free case-law access.

### Indian Kanoon — b

Indian case-law search engine. Access blocked (403) (S16). Capabilities `U`.
Lesson: scale search over a very large, uneven corpus is possible, but quality
control is the hard part.

### Singapore Statutes Online — b

AGC Singapore. Free official legislation with explicit buckets: Current,
Repealed/Spent, Uncommenced; As Published supplements; Revised Editions; pair
search; last updated 13 Nov 2026 (S14). Lesson: **status buckets are a product
feature**, not a database field. This is the closest structural model for
Philippine statutes.

### HKLII — b

Hong Kong Legal Information Institute. Returned no content (S16). Capabilities
`U`. Lesson: common-law jurisdictions often rely on university-hosted open
infrastructure.

### Official Gazette — b

Office of the President (PCO). Official journal; RA/EO/Proclamations/AO/MC/MO;
master list; constitutions; mobile apps; content "in the public domain unless
otherwise stated" (S11). Lesson: official publication is not the same as
structured, queryable law.

### LawPhil — b

Arellano Law Foundation. Secondary compilation of Philippine jurisprudence and
statutes. Its Acceptable Use Policy states the material is informational only,
warns users to verify, and disclaims accuracy (S12). Lesson: free access ≠
reuse licence ≠ accuracy guarantee. The project's authorization matrix is right
to keep this source `UNKNOWN`.

---

## Cross-profile observations

1. **The citator is the moat.** Only Westlaw and LexisNexis document a mature
   editorial treatment layer. Everyone else either lacks it or inherits it.
2. **Versioning is rare and hard.** Only legislation.gov.uk documents a complete
   point-in-time model with effects — and it still discloses unapplied effects.
3. **Citation verification is emerging as an API.** CourtListener and Lexis
   (Shepard's Verify) both productise "does this citation exist / is it still
   good", from opposite directions.
4. **Philippine coverage is a gap, not a crowded market.** vLex does not list the
   Philippines; Westlaw/Lexis/Bloomberg are not PH-focused; the official E-Library
   has no citator or API; the only local AI product has no citator or published
   evaluation.
5. **"AI-first" is not a moat.** Harvey's own value depends on licensed partner
   content; Anycase's value depends on a locally assembled corpus. Content and
   authority state come first.
