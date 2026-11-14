# 12 — Feature Prioritization

**Research date:** 2026-11-14
**Principle:** competitor availability is not priority. A feature enters a tier only
if it solves a verified or explicitly-labelled-hypothesis user problem and fits
the authorization and architecture constraints.

Each entry: user problem · competitor evidence · benefit · required data ·
technical dependency · legal dependency · complexity (S/M/L) · risk · acceptance
criteria · suggested gate.

**Two-stage acceptance rule.** Every Tier 1/2 feature is accepted twice: (a) on
synthetic fixtures, buildable now; (b) on authorized real data, **blocked until
counsel determinations exist**. No feature is "done" on synthetic evidence alone.
The project currently has 0 counsel determinations, 350 `UNKNOWN` cells and four
`BLOCKED_AUTHORIZATION` documents.

---

## Tier 1 — Foundational (without these, nothing is trustworthy)

### F1. Canonical document and provision identity

- **Problem:** the same law/case appears under different titles, numbers and URLs.
- **Evidence:** legislation.gov.uk stable `IdURI` per section (S08); E-Library and
  Gazette have no shared identifiers (S10, S11).
- **Benefit:** deduplication, citation resolution, diffs, stable links.
- **Data:** official title, number, date, source URL, hash.
- **Tech:** registry + minted IDs; already partly in Gate 1.
- **Legal:** none beyond source authorization.
- **Complexity:** M. **Risk:** ID churn if scheme changes.
- **Acceptance (synthetic):** every stored document has a stable internal ID and
  at least one official external key; no two IDs for the same instrument in a
  fixture set. **Real-data validation: BLOCKED_ON_COUNSEL.**
- **Gate:** Gate 8 (data foundation extension).

### F2. Authority class and provenance per record

- **Problem:** users cannot tell primary law from a reproduction, annotation or AI
  summary.
- **Evidence:** all publishers distinguish content types; LawPhil disclaims
  accuracy (S12); legislation.gov.uk exposes `DocumentStatus` (S08).
- **Benefit:** prevents category errors; supports defensible citation.
- **Data:** source institution, URL, retrieval time, hash, authority class,
  extraction method.
- **Tech:** schema + ingestion metadata; no AI.
- **Legal:** source terms; `UNKNOWN` allowed.
- **Complexity:** S. **Risk:** provenance fields left empty.
- **Acceptance:** 100% of records carry authority class + source + hash; a record
  without them is not retrievable.
- **Gate:** Gate 8.

### F3. Version model with effective dates

- **Problem:** users cite outdated text.
- **Evidence:** legislation.gov.uk point-in-time (S08); Westlaw version compare
  (S01).
- **Benefit:** as-of research; correct historical citation.
- **Data:** version text, effective/expiry dates, amending instrument.
- **Tech:** versioned content model (Gate 1 has a chain).
- **Legal:** effectivity rules need counsel validation.
- **Complexity:** M. **Risk:** false precision where dates are unknown.
- **Acceptance (synthetic):** for a fixture statute, the system returns the
  correct text for three dates and labels unknown dates as unknown. **Real-data
  validation: BLOCKED_ON_COUNSEL.**
- **Gate:** Gate 8.

### F4. Philippine citation parser and resolver

- **Problem:** citations are inconsistent (G.R. No., RA No., section formats).
- **Evidence:** CourtListener citation lookup (S07); Gate 3 exact identifiers.
- **Benefit:** exact lookup, dedup, graph construction.
- **Data:** citation corpus + official numbering.
- **Tech:** parser + resolver; deterministic first.
- **Legal:** none.
- **Complexity:** M. **Risk:** false positives on ambiguous numbers.
- **Acceptance:** ≥95% precision on a labelled citation set; unresolved citations
  return `NOT_FOUND`, never a guess.
- **Gate:** Gate 8.

### F5. Exact citation search + metadata filters

- **Problem:** ranking buries the exact case the user cited.
- **Evidence:** CourtListener citation lookup (S07); Gate 3 routing.
- **Benefit:** trust; speed.
- **Data:** resolved citations + metadata.
- **Tech:** exact-match path before ranking.
- **Legal:** none.
- **Complexity:** S. **Risk:** none material.
- **Acceptance:** exact citation always returns the correct document or explicit
  not-found, at rank 1 when present.
- **Gate:** Gate 8.

### F6. Four-layer citation verification

- **Problem:** citations may not exist, point to the wrong place, or not support
  the proposition.
- **Evidence:** Lexis Shepard's Verify (S02); CourtListener lookup (S07); Stanford
  hallucination study (S09); Gate 3 verifier.
- **Benefit:** the core differentiator; enables safe AI.
- **Data:** corpus + passage alignment + treatment (partial).
- **Tech:** verifier + retrieval; exists in Gate 3.
- **Legal:** none for existence; support judgement may need review.
- **Complexity:** M. **Risk:** overstating support confidence.
- **Acceptance (synthetic):** identity/location 100% on fixtures; support returns
  `SUPPORTED` / `NOT_SUPPORTED` / `UNKNOWN`, never a bare score. **Real-data
  validation: BLOCKED_ON_COUNSEL.**
- **Gate:** Gate 9 (verification hardening).

### F7. Explicit uncertainty and abstention

- **Problem:** tools answer when evidence is insufficient.
- **Evidence:** S09; vendor claims of certainty.
- **Benefit:** trust; reduces malpractice risk.
- **Data:** none extra.
- **Tech:** decision policy + UI/API states.
- **Legal:** none.
- **Complexity:** S. **Risk:** perceived as less capable.
- **Acceptance:** insufficient-evidence queries return an abstention with reasons;
  no fabricated citation in any test.
- **Gate:** Gate 9.

### F8. Query/answer audit trail

- **Problem:** cannot reconstruct why an answer was given.
- **Evidence:** project Gates 4–7; legislation.gov.uk version history.
- **Benefit:** accountability; debugging; institutional sales.
- **Data:** query, retrieval set, verifier results, model/prompt version.
- **Tech:** append-only log (exists).
- **Legal:** privacy review.
- **Complexity:** S. **Risk:** logging sensitive queries.
- **Acceptance:** every answer reproducible from its audit record.
- **Gate:** Gate 9.

---

## Tier 2 — Differentiating (the reason to choose this product)

**Capacity gate.** F9, F12 and F14 require counsel validation and/or named,
insured editorial reviewers. None of that capacity exists today. Until it does,
these features are `BLOCKED_ON_EDITORIAL_CAPACITY` — design may proceed, launch
may not.

### F9. Effects ledger (amendment/repeal/commencement)

- **Problem:** no machine-readable amendment/repeal relationships in PH sources.
- **Evidence:** legislation.gov.uk effects + unapplied effects (S08).
- **Benefit:** correct "what changed and when"; basis for alerts.
- **Data:** amending instruments, affected provisions, commencement, savings.
- **Tech:** relationship model (Gate 1) + effects records.
- **Legal:** counsel validation of effectivity and implied repeal.
- **Complexity:** L. **Risk:** incomplete effects presented as complete.
- **Acceptance:** every effect has source + status (`applied`/`unapplied`/
  `prospective`/`unknown`); no bare "amended" label.
- **Gate:** Gate 10.

### F10. As-of temporal queries

- **Problem:** "what was the law on date D?"
- **Evidence:** legislation.gov.uk versions (S08); SSO status buckets (S14).
- **Benefit:** historical research; litigation.
- **Data:** versions + effects + dates.
- **Tech:** temporal query layer.
- **Legal:** effectivity validation.
- **Complexity:** M. **Risk:** unknown dates.
- **Acceptance:** returns text + status + provenance for the date, or
  `INSUFFICIENT_TEMPORAL_DATA`.
- **Gate:** Gate 10.

### F11. Passage-level support alignment

- **Problem:** citation links prove a document exists, not that it supports the
  sentence.
- **Evidence:** vendor claims are partial (S01–S03, S06); no PH tool claims it.
- **Benefit:** the clearest visible difference from competitors.
- **Data:** passage spans + alignment.
- **Tech:** retrieval + alignment + verifier.
- **Legal:** none.
- **Complexity:** L. **Risk:** false alignment.
- **Acceptance:** each supported statement links to a span with offsets; unaligned
  statements are marked unsupported.
- **Gate:** Gate 11.

### F12. Conflict and status detection

- **Problem:** conflicting versions/authorities are invisible.
- **Evidence:** Westlaw KeyCite; project Gate 6 conflict denial.
- **Benefit:** prevents citing overruled/conflicting authority.
- **Data:** treatment + versions + effects.
- **Tech:** conflict rules + explicit state.
- **Legal:** editorial judgement for treatment.
- **Complexity:** M. **Risk:** false "overruled" labels.
- **Acceptance:** conflicts produce `CONFLICT` state with both sources; treatment
  is only asserted when reviewed.
- **Gate:** Gate 11.

### F13. Change alerts

- **Problem:** users miss amendments/new decisions.
- **Evidence:** CourtListener alerts (S07); SSO new-legislation feed (S14).
- **Benefit:** retention; compliance use case.
- **Data:** source change feed + subscriptions.
- **Tech:** event pipeline.
- **Legal:** source terms.
- **Complexity:** M. **Risk:** noisy alerts.
- **Acceptance:** alert fires only on verified source change, with diff and link.
- **Gate:** Gate 10.

### F14. Restricted, editorial citator

- **Problem:** no PH citator exists.
- **Evidence:** KeyCite/Shepard's are editorial (S01, S02); CourtListener graph is
  not treatment (S07).
- **Benefit (judgement):** potentially the strongest moat if done credibly and
  insured.
- **Data:** citing references + reviewer decisions.
- **Tech:** graph + review workflow.
- **Legal:** reviewer liability/insurance; counsel sign-off.
- **Complexity:** L. **Risk:** one wrong "overruled" is reputational damage.
- **Acceptance:** every treatment label has reviewer, date, source, rationale;
  coverage is explicitly partial.
- **Gate:** Gate 12 (editorial operations).

### F15. Institutional verification report / API

- **Problem:** firms/institutions need machine-checkable citations.
- **Evidence:** CourtListener API; publisher enterprise APIs.
- **Benefit:** B2B revenue; distribution.
- **Data:** verifier + corpus.
- **Tech:** API + quotas.
- **Legal:** terms, rate limits, no bulk redistribution.
- **Complexity:** M. **Risk:** misuse as an authority oracle.
- **Acceptance:** API returns layered results with provenance and explicit
  unknown; documented limits.
- **Gate:** Gate 12.

---

## Tier 3 — Advanced (only after data maturity)

### F16. Hybrid semantic retrieval at scale

- **Problem:** lexical misses paraphrase.
- **Evidence:** Vincent vector search (S03); CoCounsel/Harvey retrieval (S05, S06).
- **Benefit:** recall on natural-language queries.
- **Data:** embeddings + evaluation set.
- **Tech:** Vectorize/embedding pipeline; reranker.
- **Legal:** model/provider terms; no training on unlicensed content.
- **Complexity:** L. **Risk:** cost, drift, evaluation debt.
- **Acceptance:** measurable gain over lexical on a PH benchmark, with no loss on
  exact citations.
- **Gate:** Gate 11.

### F17. Cross-reference graph / related authority

- **Problem:** users cannot see relationships.
- **Evidence:** CourtListener graph (S07); legislation.gov.uk effects (S08).
- **Benefit:** discovery; research speed.
- **Data:** parsed references + resolved IDs.
- **Tech:** graph store or edge tables.
- **Legal:** none.
- **Complexity:** M. **Risk:** wrong edges from bad parsing.
- **Acceptance:** edge precision ≥95% on a labelled sample; unresolved edges
  marked.
- **Gate:** Gate 11.

### F18. Research workspaces and collaboration

- **Problem:** research is scattered across documents.
- **Evidence:** all publishers (S01–S06).
- **Benefit:** retention; team use.
- **Data:** user content.
- **Tech:** app + permissions.
- **Legal:** privacy/security.
- **Complexity:** M. **Risk:** scope creep.
- **Acceptance:** saved queries/citations with shareable, permissioned views.
- **Gate:** Gate 13.

### F19. Drafting with citation gating

- **Problem:** drafts cite unverified authority.
- **Evidence:** CoCounsel Brief Builder; Lexis drafting (S02, S06).
- **Benefit:** high workflow value.
- **Data:** templates + verifier.
- **Tech:** editor integration.
- **Legal:** UPL/advice boundaries; counsel review.
- **Complexity:** L. **Risk:** generating legal advice.
- **Acceptance:** every inserted citation is verified or explicitly flagged.
- **Gate:** Gate 13.

### F20. Analytics (privacy-reviewed)

- **Problem:** strategy insights.
- **Evidence:** Bloomberg/vLex analytics (S03, S04).
- **Benefit:** premium tier.
- **Data:** dockets/decisions; entity resolution.
- **Tech:** analytics pipeline.
- **Legal:** privacy, judicial ethics, defamation risk.
- **Complexity:** L. **Risk:** high.
- **Acceptance:** only aggregate, sourced, non-predictive metrics; legal review.
- **Gate:** Gate 14.

---

## Tier 4 — Defer / reject

| Feature                                | Why defer                              |
| -------------------------------------- | -------------------------------------- |
| General-purpose legal chatbot          | Commodity; hallucination risk; no moat |
| Bulk acquisition / mirroring           | Unauthorized; violates the gate        |
| Judge/party predictive analytics       | Ethical/privacy risk; data quality     |
| National-scale citator at launch       | Editorial cost; do restricted first    |
| Multilingual UI                        | Not the first constraint               |
| International expansion                | Destroys the PH-specific advantage     |
| Mobile-first app                       | Web first; mobile later                |
| Per-query AI pricing for core research | Punishes the behaviour you want        |

## Priority summary

**Build first:** F1–F8. **Then:** F9–F13. **Then:** F14–F15. **Only with
evidence:** F16–F20. **Do not build:** Tier 4.

Every Tier 1/2 feature is compatible with the existing Cloudflare/D1 architecture
and the authorization gate. None requires acquiring new documents before counsel
clears a source.
