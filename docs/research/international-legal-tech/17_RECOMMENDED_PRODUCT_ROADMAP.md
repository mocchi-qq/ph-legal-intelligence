# 17 — Recommended Product Roadmap

**Research date:** 2026-11-14
**Nature:** product direction, not an implementation gate. Each phase has exit
criteria; dates are deliberately omitted. Legal authorization is a hard
prerequisite for any phase that touches real documents.

## R0 — Validate before building (2–4 weeks of work, no code)

- 15–20 structured interviews across litigators, in-house, government, students.
- Test the core proposition: "verified authority state" vs "AI answers".
- Counsel scoping: which sources, which activities, what effectivity rules.
- Confirm the Tier 1 list with users; drop anything they do not recognise as a
  problem.

**Exit criteria:** documented demand signal for at least one segment; counsel
agrees on a first source and activity scope; no real document acquired yet.

## R1 — Authority core

- Canonical document + provision IDs (F1).
- Authority class + provenance on every record (F2).
- Version rows with effective dates (F3).
- Citation parser/resolver (F4).
- Exact citation search (F5).
- Four-layer verifier, existence + location first (F6).
- Abstention states (F7).
- Query/answer audit (F8).

**Exit criteria:** on a synthetic corpus, every citation resolves or returns
`NOT_FOUND`; every record has provenance; as-of query returns the right version;
verifier reports identity/location with 100% on fixtures.

**Dependency:** counsel authorization for at least one real source before any
real text enters the pipeline.

## R1.5 — First authorized ingestion (hard gate)

No phase after this point may use real text until this gate passes.

- At least one source × activity set carries a genuine counsel determination.
- 1–5 real documents ingested with provenance, hash and version metadata.
- Citation resolver and verifier run on real text; failures are recorded, not
  hidden.
- Each additional source repeats the same authorization step; corpus breadth
  scales with counsel throughput, not engineering.

**Exit criteria:** counsel determination on file for the specific source and
activities; a real document retrievable with full provenance; no `UNKNOWN` cell
promoted without a decision. Until then, R2–R5 work continues on synthetic
fixtures only.

## R2 — Temporal authority

- Effects ledger with `applied`/`unapplied`/`prospective`/`unknown` (F9).
- As-of queries over effects (F10).
- Change alerts (F13).
- Documented conflict states (F12, partial).

**Exit criteria:** a fixture statute with three amendments returns correct text
and effect status for four dates; an unapplied effect is visible as unapplied;
no "current" label without a version and date.

## R3 — Verified research workspace

- Passage-level support alignment (F11).
- Exact + lexical + metadata search; hybrid only if benchmarked (F16 gated).
- Citation verification in the UI (F6 complete).
- Saved research + export with provenance.

**Exit criteria:** every displayed statement has a citation or an explicit
unsupported marker; export includes source, version, hash and verification
result; published benchmark with denominators.

## R4 — Gated AI assistance

- Answers only from verified retrieval sets.
- Per-answer verification report; abstain on failure.
- Visible retrieval trace and model/prompt version.
- No general chatbot; no uncited prose.

**Exit criteria:** independent (internal or external) evaluation with a published
hallucination/support rate; zero fabricated citations in the test set; users can
reproduce every answer from its audit record.

## R5 — Institutional layer

- Verification API/report (F15).
- Permissions, quotas, terms.
- Restricted editorial citator (F14) only if reviewers and cover exist.

**Exit criteria:** at least one institutional pilot; API returns layered results
with provenance; treatment labels carry reviewer + rationale + coverage
disclaimer.

## Sequencing rationale

1. **Identity and provenance before search.** Without them, search results are
   unverifiable.
2. **Versions and effects before AI.** Otherwise the AI will confidently cite the
   wrong version.
3. **Verification before generation.** The verifier is the product; the generator
   is replaceable.
4. **Institutional before analytics.** Analytics multiplies legal/privacy risk and
   should wait.

## Explicit non-goals for the first 12 months

- Bulk acquisition or mirroring.
- National-scale citator.
- Judge/party predictive analytics.
- General chatbot.
- International expansion.
- Mobile-first app.
- Per-query AI pricing for core research.

## Dependencies and stop conditions

| Dependency                                 | Stop condition                                 |
| ------------------------------------------ | ---------------------------------------------- |
| Counsel determination for the first source | No real ingestion until received               |
| Reuse/display permission                   | No serving of text without it                  |
| Effectivity rules                          | No "in force" claim without counsel validation |
| Reviewer capacity                          | No treatment labels without named reviewers    |
| Evaluation set                             | No AI answer without a measured support rate   |

## What could constitute a meaningful advantage after one year (judgement)

- A verifiable, published citation-verification benchmark on PH material.
- Provision-level version/effect coverage for a defined statutory set.
- A working institutional verification API with at least one pilot.
- A product that never claims more than it can prove — the opposite of the
  market's current behaviour.

These are judgements about what would constitute an advantage, not forecasts.
The 350-cell authorization matrix still governs what may be used.
