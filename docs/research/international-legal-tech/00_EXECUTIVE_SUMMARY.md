# 00 — Executive Summary

**Research date:** 2026-11-14
**Scope:** international legal research platforms, legal AI, open legal
infrastructure, and Philippine applicability.
**Verdict:** **ACCEPTED WITH LIMITATIONS** (see `DECISION.md`).
**Status:** research only. No code, schema, corpus, authorization state or
deployment was changed.

## 1. What this is

A 17-document dossier plus a machine-readable feature matrix and source register.
It answers one question:

> Given how established legal platforms actually work, what should a
> Philippine-focused legal intelligence product become — and what should it refuse
> to copy?

The short answer: **build the authority layer, not another chatbot.**

## 2. Ten findings that drive the recommendation

1. **The citator is the moat, not the search box.** Only Westlaw (KeyCite) and
   LexisNexis (Shepard's) document a mature editorial treatment layer. Everyone
   else lacks it or inherits it. (S01, S02)
2. **Versioning is rare and harder than it looks.** legislation.gov.uk exposes
   point-in-time versions plus an effects ledger — and still discloses amendments
   it has **not applied**. (S08)
3. **Status buckets are a product feature.** Singapore separates Current,
   Repealed/Spent and Uncommenced, and As-Published from Revised Editions. (S14)
4. **Citation verification is becoming an API.** CourtListener's citation lookup
   exists explicitly to "fight hallucinations in AI tools". (S07)
5. **"Hallucination-free" is false.** Independent preregistered testing found
   17%–33% hallucination in Lexis+ AI, Westlaw AI-Assisted Research and Ask
   Practical Law AI. (S09)
6. **Passage-level support is not documented anywhere.** Vendors say "linked
   citations"; none publishes span-level alignment. (S01–S06)
7. **The Philippines is not a crowded market.** vLex's coverage list excludes it;
   Westlaw/Lexis/Bloomberg are not PH-focused; the official E-Library has no
   citator or API; the only local AI product has no citator. (S03, S10, S13)
8. **Official does not mean complete.** The SC E-Library monthly index has missing
   months (e.g. 2026 May, Sep–Nov), and no consolidated statute book exists. (S10)
9. **Free does not mean reusable.** LawPhil disclaims accuracy and grants no reuse;
   the E-Library displays no reuse terms. (S12, S10)
10. **The project has specified and tested the core components competitors treat
    as moats** — identity, versioning, citation verification, authorization and
    audit (Gates 1–7). They are not production-hardened: D1 binding behaviour,
    auth, tenancy and deployment remain open (Gate 7 limitations).

## 3. The five most relevant benchmarks

| Rank | Platform                      | Why it is the benchmark                                                                                                                  |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Westlaw**                   | Editorial citator + statute version comparison + document-vs-authority checking: the closest model of "authority state as product" (S01) |
| 2    | **legislation.gov.uk**        | The best public model of point-in-time law with an effects ledger and honest unapplied effects (S08)                                     |
| 3    | **CourtListener**             | Citation lookup/graph as an API and a guardrail for AI (S07)                                                                             |
| 4    | **Lexis+ with Protégé**       | Shepard's Verify: citation verification applied to its own generated text (S02)                                                          |
| 5    | **Singapore Statutes Online** | Status buckets and revised editions as first-class structure (S14)                                                                       |

Secondary references: Bloomberg Law (task-specific AI), CoCounsel Legal (visible
reasoning + linked citations), Vincent (global workflow coverage), Harvey
(partner-content orchestration), Anycase (local price/corpus anchor).

## 4. The Philippine opportunity

The underserved job is not "answer my question". It is:

> "Show the authority, the version that applied, the passage that supports the
> proposition, and what you could not verify."

No Philippine product does this. The official portals publish documents; the
local AI product answers questions. Neither provides provision-level versions,
effects, or passage-level verification.

Verified gaps: no public citator, no stable provision IDs, no public API, no
consolidated statute book with effects, visible gaps in official digitisation,
and no reuse licence displayed on the official portals. (S10–S13)

## 5. Recommended positioning

**Primary: Philippine legal authority infrastructure, delivered through a research
engine.** AI is a gated layer on top, never the product.

Why (judgement): it uses what the project has already built, no incumbent
currently occupies it in PH, it survives model commoditisation, and it is honest —
the product can say "unknown" and still be valuable.

Rejected: corpus-size race; "Philippine Harvey"; cheapest AI answers; judge
analytics first; international expansion.

## 6. Top ten capabilities, prioritised

1. Canonical document + provision identity.
2. Authority class + provenance on every record.
3. Version model with effective dates.
4. Philippine citation parser/resolver.
5. Exact citation search with metadata filters.
6. Four-layer citation verification (exists → location → support → current).
7. Explicit uncertainty and abstention.
8. Query/answer audit trail.
9. Effects ledger (amendment/repeal/commencement, including unapplied).
10. As-of temporal queries.

Next: passage-level support, conflict/status detection, change alerts, restricted
editorial citator, verification API. Deferred: hybrid semantic search at scale,
graph UI, workspaces, drafting, analytics. Rejected: general chatbot, bulk
acquisition, predictive judge analytics.

## 7. Technical lessons

- Relational registry first; graph as derived edges; vector search as a recall
  booster behind exact-match bypass.
- Immutable versions + stable provision IDs + effects edges + explicit `unknown`
  states are the four non-negotiables.
- Passage-level retrieval (provision + version + span) is a better unit than whole
  documents.
- Verify citations before display; abstain on failure.
- Keep the Cloudflare/D1/Workers stack; add R2 for blobs and Queues for source
  events only when needed.

## 8. Legal and licensing dependencies

- Counsel determinations remain **0**; all **350** cells remain `UNKNOWN`; four
  pilot documents remain `BLOCKED_AUTHORIZATION`.
- No source may be ingested, stored, displayed or reused until counsel authorizes
  the specific activity.
- Effectivity/publication rules, implied repeal, judicial invalidation and
  consolidation status require Philippine legal validation.
- Editorial treatment labels require named reviewers and liability cover.
- Public availability, government publication and competitor access are **not**
  permission.

## 9. What remains uncertain

Pricing for most platforms; retrieval quality (no public benchmarks); paywalled UI
behaviour; passage-level granularity; AI architecture; PH market size and
willingness to pay; PH OCR quality; CanLII/AustLII/Indian Kanoon/HKLII/CAP
capabilities (access blocked); EUR-Lex consolidation detail (page blocked); and
all Philippine legal-status questions pending counsel.

## 10. Deliverables

All under `docs/research/international-legal-tech/`:

`00_EXECUTIVE_SUMMARY.md` · `01_RESEARCH_METHODOLOGY.md` ·
`02_INTERNATIONAL_PLATFORM_LANDSCAPE.md` · `03_PLATFORM_PROFILES.md` ·
`04_COMPETITIVE_FEATURE_MATRIX.md` · `05_LEGAL_SEARCH_AND_RETRIEVAL.md` ·
`06_AI_LEGAL_RESEARCH_COMPARISON.md` · `07_LEGAL_AUTHORITY_AND_TEMPORAL_VALIDITY.md` ·
`08_CONTENT_PROVENANCE_AND_OPERATIONS.md` · `09_JURISDICTION_COMPARISON.md` ·
`10_PHILIPPINE_MARKET_AND_GAP_ANALYSIS.md` · `11_PRODUCT_POSITIONING.md` ·
`12_FEATURE_PRIORITIZATION.md` · `13_ARCHITECTURE_LESSONS.md` ·
`14_COMMERCIAL_MODELS.md` · `15_SOURCE_REGISTER.md` ·
`16_RESEARCH_GAPS_AND_UNCERTAINTIES.md` · `17_RECOMMENDED_PRODUCT_ROADMAP.md` ·
`DECISION.md` · `feature-matrix.csv` · `feature-matrix.json` · `source-register.json`

## 11. Confirmation

No application code, database schema, migration, corpus, source authorization,
counsel record, Worker or deployment was changed. No document was acquired. No
repository was pushed. The research inspected public pages, public APIs and
public documentation only.
