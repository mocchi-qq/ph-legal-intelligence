# 01 — Research Methodology

**Research date:** 2026-11-14
**Author:** project research pass (assistant), reviewed independently (see `DECISION.md`)
**Scope:** international legal research technology, product intelligence, Philippine applicability

## 1. Purpose and boundaries

This is a research gate. It does not implement, acquire, ingest, index, deploy or
authorize anything. It does not change source authorization, counsel records,
schemas, workers or the corpus. Public availability is never treated as permission.

The authorization matrix stays at 350 `UNKNOWN` cells and the four pilot documents
stay `BLOCKED_AUTHORIZATION` regardless of what this research finds.

## 2. Research questions

Derived from the gate brief, grouped:

1. **Landscape** — who operates legal research platforms, in which jurisdictions,
   under which commercial model, and what distinguishes databases from AI systems?
2. **Organization** — how is legal information modelled (documents, provisions,
   versions, citations, relationships)?
3. **Authority** — how do platforms establish that an authority is current, amended,
   overruled, distinguished or repealed?
4. **Retrieval** — which legal-specific search capabilities exist, and what is
   claimed versus demonstrated?
5. **AI** — how are grounded answers, citations, passage support, uncertainty and
   human review handled; what does independent testing show?
6. **Provenance** — how are sources, versions, editorial annotations and AI output
   distinguished and disclosed?
7. **Philippines** — what exists locally, what is missing, and what is realistically
   buildable under the project's authorization and architecture constraints?
8. **Strategy** — which positioning, features and architecture patterns are
   defensible for a Philippine-focused platform?

## 3. Platform selection criteria

A platform enters the deep-profile set only if at least three hold:

- it is a reference point for legal research workflows in a major jurisdiction;
- it has public documentation of search, citator, versioning or AI behaviour;
- it materially informs a Philippine design decision;
- it represents a distinct category (publisher database, AI assistant, open
  infrastructure, analytics, legislative tracking);
- it is currently operating (not discontinued), or its shutdown is itself a lesson.

Excluded: generic chatbots, practice-management tools with no legal research
surface, and companies whose only public artefact is a press release.

## 4. Jurisdictions

Required: United States, United Kingdom, Canada, Australia, European Union, India,
Singapore, Hong Kong, Philippines. Supporting: New Zealand (legislation drafting
and access), South Africa (mixed jurisdiction), Brazil (open legislative data),
Japan (comparative civil-law digitisation) where evidence is available.

Legal concepts are **not** assumed transferable. A US citator's "negative treatment"
signal does not map one-to-one onto Philippine jurisprudence; a UK point-in-time
statute service does not prove that Philippine consolidated texts exist.

## 5. Evidence hierarchy

Highest to lowest:

1. official product documentation and help centres;
2. official pricing and feature pages;
3. official technical documentation, APIs, schemas, release notes;
4. public demonstrations, recorded walkthroughs, official changelogs;
5. independent evaluations (peer-reviewed, Stanford/RegLab, academic);
6. academic research and government reports;
7. reputable legal-technology publications;
8. practitioner reviews and community discussion (supplementary only).

Search-result snippets are never sufficient for a material claim. The underlying
page is opened and read. Where a page is paywalled, blocked or JS-only, the claim
is recorded as `UNKNOWN` with the access failure noted.

## 6. Evidence classification

Every material claim in the dossier carries one of:

- `VERIFIED FACT` — directly observable in a primary/official source (e.g. a
  documented feature on the vendor's own help page, or a statute's own text).
- `COMPANY CLAIM` — asserted by the vendor, not independently demonstrated.
- `INDEPENDENT EVALUATION` — third-party testing or peer-reviewed study.
- `USER REPORTED` — practitioner/community report, not verified.
- `RESEARCH INFERENCE` — this project's judgement, explicitly labelled.
- `UNKNOWN` — no reliable public evidence, or inaccessible.

Vendor adjectives ("most comprehensive", "AI-powered") are never promoted to
`VERIFIED FACT`. A feature is `VERIFIED` only when a primary source describes the
mechanism or a demonstration shows it.

**Vendor-page caveat.** For a vendor product, the vendor's own page is the
primary source for _what the vendor documents_, not for whether the mechanism
works. Profiles therefore mark feature existence `V` but mark architecture or
quality claims `P`/`COMPANY CLAIM`. The feature matrix uses `V` = "documented in a
public source", `P` = "partially documented / mechanism not disclosed", `U` =
"unknown". It is a documentation-coverage scale, not a quality score.

## 7. Source register rules

`15_SOURCE_REGISTER.md` and `source-register.json` record, for every source used:

- id, title, publisher, URL, publication/update date where shown;
- access date (2026-11-14 unless noted);
- the exact claim it supports;
- classification;
- whether it is primary, vendor or independent.

Claims that cannot be tied to a register entry are removed or downgraded to
`RESEARCH INFERENCE`. Conflicting sources are recorded as conflicts, not averaged.

## 8. Known limitations of this method

- **Marketing asymmetry.** Vendors publish capabilities, not failure rates.
  Absence of evidence is recorded as `UNKNOWN`, never as absence of the feature.
- **Paywalls.** Deep UI behaviour of Westlaw, Lexis, Bloomberg and vLex cannot be
  inspected without accounts; those rows rely on official help pages and demos.
- **Change over time.** Product names and packaging change quickly (e.g. AI
  assistant rebrands). The research date is recorded and every claim is dated.
- **Independent evidence is scarce.** Only a small number of peer-reviewed studies
  test legal RAG systems; where none exists, no quality claim is made.
- **Philippine official sources** are unevenly documented online; availability is
  recorded as observed, not as guaranteed.
- **No user interviews.** Willingness-to-pay and workflow pain are hypotheses, not
  measured demand. They are labelled as such.

## 9. Work allocation

| Phase | Work                                                            | Output                         |
| ----- | --------------------------------------------------------------- | ------------------------------ |
| A     | repo/context review (read-only)                                 | `00` §context                  |
| B     | method and selection criteria                                   | this document                  |
| C     | discovery: 30+ candidates, 15+ shortlisted                      | `02`                           |
| D     | deep profiles for 9 platforms, secondary for 8                  | `03`                           |
| D     | retrieval, AI, authority, provenance deep dives                 | `05`–`08`                      |
| D     | jurisdiction comparison (9 jurisdictions)                       | `09`                           |
| E     | Philippine landscape and gap analysis                           | `10`                           |
| E     | positioning, prioritisation, architecture, commercial           | `11`–`14`                      |
| F     | two independent reviews                                         | `DECISION.md`, review appendix |
| G     | finalisation, roadmap, source register, machine-readable matrix | `00`, `15`–`17`, `DECISION.md` |

Parallelisation: discovery and jurisdiction collection run together; platform
profiles are written only after their sources are registered. Synthesis waits for
all profiles so the matrix is normalised once, not patched.

## 10. What would make this research fail

- A material claim without a source.
- Treating a vendor's marketing page as independent evidence.
- Reporting a price that is not on a public page.
- Presenting an inference about proprietary architecture as fact.
- Recommending a feature that conflicts with the authorization gate.
- Recommending a corpus-size race the project cannot fund or license.
- Collapsing "citation exists" into "citation supports the proposition".

The final verdict is chosen from `ACCEPTED`, `ACCEPTED WITH LIMITATIONS`,
`BLOCKED`, `REJECTED`, using the gate's definitions.
