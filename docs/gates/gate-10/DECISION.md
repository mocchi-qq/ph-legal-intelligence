# DECISION — Gate 10

**Date:** 2026-11-15
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

- **Authority-aware layer 4.** The citation verifier accepts an injected
  authority lookup and passes only for a reviewed, operative state. It rejects
  `UNKNOWN`, `PARTIALLY_DETERMINED`, `CONFLICTED`, `INSUFFICIENT_EVIDENCE`,
  `UNAUTHORIZED`, non-operative states, abstentions and
  `VERSION_NOT_IN_EFFECT`.
- **No package cycle.** `citation-engine` does not import `legal-ingestion`; the
  bridge (`createAuthorityStatusLookup`) lives in `legal-ingestion` and maps a
  provision-version id to a provision identity.
- **Backward compatibility.** Without a callback the existing field-based
  temporal check runs and is labelled `legacy_fields`.
- **D1 writer/reader.** `D1AuthorityStore` persists identities, mappings,
  assertions, evidence and reviews, reconstructs a scoped snapshot, rejects
  duplicate ids consistently, maps FK/CHECK errors, loads cross-document
  supersession, and chunks IN lists.
- **Evidence.** 23 new tests; full suite **598 tests — 588 pass, 1 pre-existing
  failure, 9 skipped**; build exit 0; Biome 0 errors. One independent review; all
  findings fixed.

## 2. Why ACCEPTED WITH LIMITATIONS

1. **D1 is validated on the SQLite shim only.** No remote D1 or workerd run; the
   Gate 7 binding-level limitation stands. The adapter is `IMPLEMENTED_UNVERIFIED`
   against real D1.
2. **Single-target snapshots.** `loadStateFor` scopes one document; multi-target
   conflict detection at verification time is the caller's responsibility.
3. **Passage support remains a lexical proxy**, not entailment.
4. No real corpus or counsel determination exists.

These are bounded and recorded; no blocker or fail-open remains in the tested
paths.

## 3. Boundary

No real legal document was acquired or processed. Counsel determinations remain
**0**; all **350** authorization cells remain `UNKNOWN`; the four pilot documents
remain `BLOCKED_AUTHORIZATION`. No deployment or push.

## 4. Next action

The engineering layer is now coherent enough for a **corpus-readiness gate** once
counsel produces determinations: authorize one source, ingest a bounded real
sample, and run the bridge against it. Before that, only maintenance and
evaluation work is justified. The legal blocker is the gating dependency.
