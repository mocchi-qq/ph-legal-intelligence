# Product Requirements

Status: Gate 11 documentation
Owners: Documentation working group
Last updated: 2026-11-15

This document records the product position accepted at the international research
gate — `docs/research/international-legal-tech/00_EXECUTIVE_SUMMARY.md` §5 and
`docs/research/international-legal-tech/DECISION.md` — and the requirements that
follow from the code that exists at this commit. It states what the platform is
for, what it guarantees, and what it cannot yet do. Every claim is traceable to a
file in this repository; where something is absent, it says "not implemented".

## 1. Positioning

**Philippine legal authority infrastructure, delivered through a research
engine.** AI is a gated layer on top, never the product.

The infrastructure is four things about a legal instrument: its document
versions, its legal effects, its citations, and the provenance behind each of
them. The research engine is how a user reaches them. AI output is admitted only
after citation verification passes; an answer that cannot be verified is refused
or qualified rather than presented as law.

The rejected alternatives are recorded in the research gate and are not
requirements: a corpus-size race, a general chatbot, cheapest-AI answers, judge
analytics first, and international expansion before the Philippine corpus exists.

## 2. Target users

The role vocabulary is defined in `docs/security/SECURITY_ARCHITECTURE.md` §4.1.
It is a specification of intended entitlements, not an implemented authorisation
system — no authentication or permission surface exists (see §7).

| User         | Role vocabulary    | What they need from the product                                                                     |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| Practitioner | `lawyer`           | The text in force on a given date, its amendment history, and a citation that survives verification |
| Researcher   | `researcher`       | Passage-level retrieval with provenance back to the source bytes, and explicit uncertainty          |
| Student      | `student`          | Doctrine and provisions with readable citations and clear statements of what is unverified          |
| Institution  | `org_admin` tenant | Auditable answers: every passage traceable to source, document, version, provision and chunk        |

## 3. Core jobs

1. **Find an authority by its identifier.** A G.R. number, Republic Act number,
   executive order or exact title must resolve to that document, or to nothing.
   Implemented in `packages/legal-search/src/retrieve.ts`.
2. **Establish which version was in force on a date.** A query carries an
   `asOfDate`, and only versions whose `[effectiveFrom, effectiveTo)` interval
   covers that date are eligible (`isLiveAt`).
3. **Read a passage with its provenance.** Every result carries `versionId`,
   `provisionId`, `span` offsets and a `provenance` object naming source,
   document, version, provision and chunk.
4. **Verify a citation in four layers.** Identity, location, support and temporal
   validity are each evaluated and reported separately
   (`packages/citation-engine/src/verifier.ts`).
5. **Receive an abstention instead of a guess.** A citation that fails any layer
   is reported as `FAILED` or `PARTIALLY_VERIFIED`, never as verified.

## 4. The four-layer verification guarantee

| Layer             | Question                                   | Implemented behaviour                                                                                                 | Limitation                                                     |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Identity          | Does the cited authority exist?            | Exact normalised match against citation, docket, identity key or title; zero matches and ambiguous matches both fail  | Depends entirely on what the corpus view contains              |
| Location          | Does the cited provision or passage exist? | Passage-id lookup with document-ownership check; label lookup scoped to the version in force at `relevantDate`        | Falls back to a labelled provision when no passage is supplied |
| Support           | Does the passage support the proposition?  | Deterministic lexical proxy: operative-term coverage ≥ `SUPPORT_THRESHOLD` (0.8), with instruction-like text stripped | **Not semantic entailment**; no model is called                |
| Temporal validity | Was it in force on the relevant date?      | Injected authority projection when supplied, otherwise the legacy effectivity/repeal fields, labelled `legacy_fields` | Projection decides only what reviewed evidence establishes     |

The guarantee is therefore: **nothing is presented as verified unless all four
layers pass**, and the support layer is a conservative lexical test rather than a
claim of legal or semantic correctness. This is stated in the verifier's own
source comments and in `docs/gates/gate-9/DECISION.md` and
`docs/gates/gate-10/DECISION.md`.

## 5. Refuse-to-answer behaviour

`docs/architecture/CITATION_VERIFICATION.md` §4 defines the refusal conditions:
no supporting authority found, source unavailable, law version cannot be
established, authorities conflict, cited passage does not support the statement,
and question depends on facts not provided. Each has a refusal template that names
the gap.

The enforcement rule is that any citation which is not `VERIFIED` forces the
answer either to drop the unsupported claim or to carry the refusal notice, and
an answer with zero verified citations must not present a legal conclusion as
definitive. A `PARTIALLY_VERIFIED` citation must name its failed layer.

What exists in code is the verification result that carries those states and
per-layer evidence, plus an evidence-only answer composer
(`packages/ai-orchestrator/src/grounding.ts`) that assembles an answer from fully
verified citations only and abstains when none passes. It does not call a model;
whether a generative model can be held to the same standard is unverified.

## 6. Current status

- **Synthetic-only engineering to date.** Tests and fixtures are synthetic; no
  evaluation corpus of real Philippine law exists.
- **Zero counsel determinations.** No source/activity pair has been authorised.
- **350 authorization cells `UNKNOWN`** — 25 registered sources × 14 activities,
  all undetermined (`docs/gates/gate-4/02_ACTIVITY_AUTHORIZATION_MATRIX.md`).
- **Four pilot documents `BLOCKED_AUTHORIZATION`** (`docs/gates/gate-5/DECISION.md`).
- **No real Philippine legal document has been acquired or processed.**
- **No semantic retrieval, no embedding index, no reranker, no model call in the
  verification path** — not implemented.
- **No product UI beyond placeholder shells, no HTTP API, no deployed service, no
  authentication surface** — not implemented.

These are boundaries, not roadmap items with dates. Nothing here promises a
compliance certification, a service level, or a vendor arrangement.
