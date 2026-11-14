# 14 — Limitations and Open Questions

**Date:** 2026-11-14

## 1. Technical limitations

1. **Mapping review is frozen.** `provision_version_mappings` has no append-only
   correction path (`UNIQUE(identity, provision_version)` + immutable rows), so a
   mapping cannot move from `UNREVIEWED` to `REVIEWED`. Projection does not consume
   mappings, so this does not affect current answers; it must be redesigned before
   provision-continuity claims are used.
2. **No D1 ledger adapter and no deterministic IDs.** The seven new tables have a
   schema and tests but no production writer; ids are caller-supplied. Gate 9 must
   either add an adapter or state persistence is out of scope.
3. **Citation-verifier layer 4 is not wired** to the authority projection (see
   `08`); the existing verifier still reads mutable date/status fields.
4. **Synthetic only.** No real Philippine legal text is stored, parsed or resolved.
   The effects ledger has never seen a real instrument.
5. **No counsel determinations.** 0 received; all 350 authorization cells remain
   `UNKNOWN`; four pilot documents remain `BLOCKED_AUTHORIZATION`.
6. **No AI.** No model, embedding or reranker is used. The lexical support proxy
   remains a proxy, not entailment.
7. **D1 evidence level.** The migration and stores are validated on `node:sqlite`
   and, where run, remote D1 via HTTP. Workerd binding-level transactional
   `batch()` remains unverified (Gate 7 limitation).
8. **No production routes.** Nothing is exposed through a Worker or app.
9. **No real citator.** Treatment/review is a workflow model, not a populated
   national citator.
10. **Provision continuity is a claim.** `SAME`/`RENUMBERED`/`SPLIT`/`MERGED` are
    only as good as the reviewer decision behind them.
11. **Effect vocabulary is technical.** The labels do not import Philippine legal
    doctrine; counsel must define what counts as each effect.
12. **No date rule engine.** Effectivity is recorded, never derived from a statutory
    formula.
13. **No aggregation at scale.** Performance was measured only on synthetic
    fixtures; no claim is made for national corpora.

## 2. Legal dependencies

Counsel must determine, at minimum:

- effectivity and publication rules per instrument type;
- treatment of implied repeal and inconsistent later statutes;
- scope and effect of judicial invalidation;
- status of consolidated texts;
- whether provision continuity can be asserted for renumbering;
- what constitutes a reviewed legal conclusion for each effect type.

Until then, the model can record assertions and reviews but cannot claim that any
effect is legally correct for real Philippine law.

## 3. Open design questions

1. Should a review be scoped to a single proposition or a set? (Current: one
   proposition + scope string.)
2. How are partial reviews represented (confirmed for one provision, not another)?
   (Current: separate assertions/reviews, or scope strings; not a first-class
   partial-approval type.)
3. Should `REVOKED` be a review status or a new review outcome? (Current: status on
   the review record.)
4. How should a supersession chain be queried as-of a historical date? (Current:
   superseded reviews are inactive; historical review state is limited.)
5. Should provision identity be document-scoped or instrument-family-scoped?
   (Current: document-scoped.)
6. How are conflicting evidence hashes handled? (Current: evidence availability
   only; hash mismatch is a Gate 6 concern.)
7. Should citation aliases be globally unique or per-document? (Current:
   per-document unique; cross-document ambiguity is a resolver outcome.)

## 4. Threats to the gate's own claims

- Synthetic fixtures can make the model look more complete than the real corpus
  would allow.
- A passing test does not prove the legal vocabulary is correct.
- A reviewer approving the code does not approve the law.
- The absence of a real corpus means scale, OCR and metadata quality are untested.

## 5. What would change the design

- Counsel says effectivity cannot be modelled as an interval for some instruments.
- A real source exposes structured amendment data, reducing manual assertions.
- Provision continuity proves unreliable, forcing `UNCERTAIN` by default.
- Real corpus tests show the relational model cannot answer as-of queries at
  acceptable latency.
