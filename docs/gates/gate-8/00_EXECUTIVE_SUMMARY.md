# 00 — Executive Summary

**Gate:** 8 — Philippine Legal Authority Core, Identity, Versioning, Effects Ledger
**Date:** 2026-11-14
**Verdict:** **ACCEPTED WITH LIMITATIONS** (see `DECISION.md` for the final
disposition and review findings).
**Evidence level:** synthetic unit/integration + SQLite-compatible schema.
No real corpus, no counsel determinations, no deployment.

## 1. What this gate built

A reusable, synthetic-only authority core:

| Component                                                                                                 | File                                               | State                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| Authority vocabulary and records                                                                          | `packages/legal-schema/src/authority.ts`           | implemented, typechecked          |
| Append-only ledger (documents, versions, provisions, identities, mappings, assertions, evidence, reviews) | `packages/legal-ingestion/src/authority-ledger.ts` | implemented, 22 tests             |
| Deterministic projection with abstention                                                                  | `authority-projection.ts`                          | implemented, tested               |
| As-of temporal queries                                                                                    | `temporal-query.ts`                                | implemented, 7 tests              |
| PH citation parser + alias resolver                                                                       | `citation-resolver.ts`                             | implemented, tested               |
| Durable schema                                                                                            | `migrations/d1/0009_authority_core.sql`            | applies on `node:sqlite`, 9 tests |

## 2. The central separation

Three planes are kept apart in the types, storage and projection:

- **Plane A — authorization:** may we process this source/activity? (existing
  registry; unchanged; 350 cells still `UNKNOWN`).
- **Plane B — identity/provenance:** what instrument, artifact, version and
  provision is this?
- **Plane C — effects:** what effect is asserted, on what evidence, and has a
  qualified reviewer confirmed it within a stated scope?

An assertion is not a conclusion. A review is not a reuse permission. A projection
is not a legal determination. The model can represent an authentic but
unauthorized document, an authorized document with unknown effect, and a reviewed
effect whose content may not be reproduced.

## 3. What the projection can say

Given a ledger snapshot, a target and a date, it returns one of:
`DETERMINED_WITH_REVIEWED_EVIDENCE`, `PARTIALLY_DETERMINED`, `UNKNOWN`,
`CONFLICTED`, `INSUFFICIENT_EVIDENCE`, `UNAUTHORIZED`, with the state, supporting
assertion/review/evidence IDs, conflicts, missing information and an explanation.

Hard behaviours verified:

- an unreviewed assertion never becomes a confirmed effect;
- a rejected review yields no confirmed effect;
- conflicting reviews yield `CONFLICTED`, not the latest one;
- unavailable evidence yields `INSUFFICIENT_EVIDENCE`;
- a missing effective date blocks a definitive as-of result;
- authorization denial yields `UNAUTHORIZED` even when the effect is reviewed;
- identical inputs produce identical output.

## 4. Test evidence

- Gate 8: **59 tests** across 4 files (ledger, projection, temporal, migration).
- Full suite: **515 tests, 505 pass, 1 pre-existing failure, 9 skipped**.
- Build passes; Biome has no errors after formatting.
- Performance baseline: 500 assertions, ~0.88 ms per projection (synthetic,
  in-memory; not a scale claim).

## 5. What is not done

1. **Citation-verifier layer 4 is designed but not wired** to the projection; the
   existing verifier still reads mutable status fields. This is the largest
   functional gap.
2. **D1 ledger adapter is deferred**; the new schema is validated on the SQLite
   shim only. Remote D1/binding behaviour is not claimed.
3. **No real corpus and no counsel determinations**; the vocabulary has not been
   validated by Philippine counsel.
4. **No review workflow/UI**; reviews are recorded records, not an operational
   editorial process.
5. **No provision-mapping review tooling**; mappings are data, and `UNCERTAIN` is
   the safe default.

## 6. Why the separation matters

The most important requirement in this gate was to keep _permission to process a
source_ separate from _a legal conclusion about that source_. The data model, API
results, tests and audit records all preserve that separation. A synthetic
reviewer can confirm a synthetic effect; that never authorises ingestion, display
or reuse of any real document.

## 7. Next gate

**Gate 9 — Passage-Level Retrieval and Search Hardening (synthetic).**
Justification and scope are in `15_NEXT_GATE_RECOMMENDATION.md`. The counsel
blocker remains independent and unresolved.
