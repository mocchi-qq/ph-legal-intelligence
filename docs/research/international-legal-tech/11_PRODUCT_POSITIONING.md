# 11 — Product Positioning

**Research date:** 2026-11-14

## 1. Three candidate positions

### Strategy A — Philippine legal research engine

Accurate discovery and retrieval over structured primary sources, with citation
navigation and legal relationships. AI is optional.

- **Target users:** lawyers, students, researchers, government legal offices.
- **Problem solved:** finding the right authority and verifying it exists.
- **Differentiation:** PH-specific citation handling, provision-level retrieval,
  explicit version/status, published retrieval benchmarks.
- **Technical complexity:** medium. Needs parser, index, metadata, versioning.
- **Data dependency:** high — authorized corpus is the product.
- **Legal/licensing dependency:** high (the authorization gate).
- **Operating cost:** medium (ingestion, storage, QA); no inference cost.
- **Competitive pressure:** high from free official portals and Anycase.
- **Revenue potential:** subscription/education; moderate.
- **Adoption barriers:** "why pay when the E-Library is free?"
- **Risks:** corpus gaps; perceived as a search box.
- **Time to value:** fastest of the three.

### Strategy B — Philippine legal intelligence assistant

Source-grounded AI for answers, explanations, comparison and research workflows.

- **Target users:** same, plus in-house teams wanting speed.
- **Problem solved:** time-to-answer, plain-language explanation.
- **Differentiation:** citation-gated answers, abstention, passage links.
- **Technical complexity:** high (retrieval + verification + evaluation).
- **Data dependency:** high.
- **Legal dependency:** high, plus AI governance.
- **Operating cost:** high (inference, evaluation, support).
- **Competitive pressure:** very high (Anycase, global AI).
- **Revenue potential:** high if trust is established.
- **Adoption barriers:** trust; hallucination history (S09).
- **Risks:** one bad citation destroys credibility; commoditised model layer.
- **Time to value:** slow — requires A's infrastructure first.

### Strategy C — Philippine legal knowledge infrastructure

Document identity, authority relationships, legal timelines, provenance and
reusable data, exposed through UI and API.

- **Target users:** firms, publishers, universities, government, other legal-tech
  builders, compliance teams.
- **Problem solved:** "what is the authority state of this provision/case, and
  can I prove it?"
- **Differentiation:** stable IDs, version/effects ledger, citation graph,
  provenance, verification API. Nobody in PH offers this.
- **Technical complexity:** high but incremental; largely data engineering.
- **Data dependency:** high; but value compounds per document.
- **Legal dependency:** high; must be authorized and counsel-reviewed.
- **Operating cost:** medium; editorial review is the main cost.
- **Competitive pressure:** low today; a government or publisher could enter.
- **Revenue potential:** API/institutional licensing + powered products.
- **Adoption barriers:** developers must exist; buyers may not know they need it.
- **Risks:** slow commercial ramp; "infrastructure" is hard to sell to lawyers.
- **Time to value:** medium; each verified corpus slice is usable.

## 2. Assessment against the evidence

| Criterion                                         | A        | B        | C           |
| ------------------------------------------------- | -------- | -------- | ----------- |
| Uses the project's existing moat (Gates 1–7)      | High     | Medium   | **Highest** |
| Depends on a corpus the project does not yet have | High     | High     | High        |
| Defensible if a competitor copies the UI          | Low      | Low      | **High**    |
| Feasible with a small team                        | **High** | Low      | Medium      |
| Revenue speed                                     | Medium   | Medium   | Slow        |
| Risk of overclaiming                              | Low      | **High** | Low         |
| Legal exposure                                    | Medium   | High     | Medium      |

The decisive fact: the project has already built identity, versioning, citation
verification, authorization and audit infrastructure (Gates 1–7). Strategy A/C
leverage it; Strategy B monetises it but depends on it. Strategy B alone would be
a thin wrapper over an unauthorized corpus.

## 3. Recommendation

**Primary positioning: C, delivered through A.**

In one sentence:

> A Philippine legal authority layer that makes every citation verifiable —
> showing the provision, the version in force, the supporting passage, and what
> could not be verified — with a research workspace on top and AI answers only
> where citations pass verification.

Why:

1. **Judgement: no incumbent currently occupies this position in PH.** vLex does
   not cover PH (S03); publishers are not PH-focused; Anycase has no citator
   (S13). This is observed absence, not proof that an incumbent cannot enter.
2. **It matches the project's sunk engineering.** Gates 1–7 are exactly the
   infrastructure for C.
3. **It survives the AI commodity trap.** Models are replaceable; verified
   authority state is not.
4. **It is honest.** The product can say "unknown" and still be valuable — which
   is what the Stanford evidence says legal AI must do (S09).
5. **It creates optionality.** A and B become interfaces over the same authority
   layer; institutional/API revenue becomes possible.

**Secondary positioning (12–24 months):** B, but only as a gated layer whose
answers must pass the citation verifier. Do not launch a general chatbot.

**Judgement, not fact:** the moat argument below rests on the verifier and the
authorization/audit layer being hard to replicate. That is an assessment, not a
measured competitive outcome.

## 4. What we explicitly reject

- **Corpus-size race.** Cannot out-license Westlaw/Lexis; not credible.
- **"Philippine Harvey".** Enterprise AI workflow without a corpus partner is a
  reseller business with no moat.
- **Cheapest AI answers.** Anycase already occupies that price point.
- **Judge analytics first.** Privacy/ethics and data quality risk; defer.
- **International expansion first.** The differentiation is Philippine-specific.

## 5. Positioning statement (draft)

For Philippine lawyers, researchers and institutions who cannot afford to cite
the wrong or outdated authority, **[product]** is a legal authority layer that
shows the exact provision, version and supporting passage behind every statement,
and states plainly what it could not verify — unlike search portals that return
documents, or AI tools that return confident prose.

## 6. Success test after 12 months

- A published, reproducible citation-verification benchmark on Philippine
  material.
- Provision-level version coverage for a defined statutory set, with an effects
  ledger.
- At least one institutional user relying on the verification API/report.
- Judgement target: zero unsupported "overruled"/"in force" claims in the product.
- Counsel-approved source authorization for the covered corpus.

If those hold, the position is defensible even if a competitor copies the UI.
