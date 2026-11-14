# 15 — Next Gate Recommendation

**Date:** 2026-11-14
**Decision:** recommend **Gate 9 — Passage-Level Retrieval and Search Hardening
(synthetic)**, with authorized-corpus readiness as a parallel, counsel-gated track.

## 1. Why not the alternatives first

| Candidate                      | Why not next                                                           |
| ------------------------------ | ---------------------------------------------------------------------- |
| Effects-ledger review workflow | Depends on real assertions and reviewers; no counsel capacity yet      |
| Authorized corpus readiness    | Blocked on counsel determinations; cannot be the next engineering gate |
| Institutional verification API | Premature without a stable retrieval/passage contract                  |
| User research                  | Valuable, but not an engineering gate; can run in parallel             |
| Production security hardening  | No production surface exists yet                                       |

## 2. Why passage-level retrieval

The research found that passage-level support is the least-documented capability
across competitors and the clearest differentiator for the Philippine platform. The
authority core now provides version/provision/effect identity. `packages/legal-search`
already retrieves passages with `asOfDate` filtering, but its `SearchResult` exposes
`documentId`/`chunkId`/`passage` without `versionId`, `provisionId`, effective
interval or character offsets, so a result cannot be handed to a version-aware
verifier without a second lookup. The missing piece is a retrieval result contract,
not retrieval from scratch.

## 3. Proposed Gate 9 scope (bounded, synthetic)

1. Extend `SearchResult` with `versionId`, `provisionId`, `effectiveFrom/To`, `span`
   and provenance; do not rebuild the existing retrieval.
2. Retrieval result contract with temporal context and authority projection.
3. Exact citation bypass + provision-level lexical retrieval on synthetic fixtures.
4. Passage→proposition support tests using reviewed synthetic annotations (not just
   the lexical proxy), clearly separated.
5. Verifier integration: layer 2 returns a span; layer 4 consumes projection.
6. Search API contract only; no vector index, no reranker, no model.
7. Performance baseline on a synthetic dataset (documented size/environment).

## 4. Entry conditions

- Gate 8 accepted with limitations.
- Authority core tests green.
- No real corpus required.

## 5. Parallel legal track (not a gate)

- Counsel review of `sc_elibrary` and the first activity set.
- Effectivity/publication rules memo.
- Reuse/display permissions.

Gate 9 must not claim that synthetic passage retrieval is legal validation.

## 6. What Gate 9 must refuse

- Calling lexical overlap "entailment".
- Returning a whole document as passage support.
- Folding authority state into a relevance score.
- Adding a vector index before a measured need.
