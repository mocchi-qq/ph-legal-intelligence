# 03 — Independent Review

**Date:** 2026-11-17
**Review:** one read-only pass from the other lane, over the reader, the merge, the
lookup option, the projection refusal, the three test files and the Gate 16
correction.

## Findings and disposition

| #   | Severity | Finding                                                                                                                                       | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CRITICAL | An unfiltered read (`documentIds` omitted) bypasses the existence check and the `is_current` validation.                                      | **REJECTED as stated, accepted as a documentation gap.** `is_current` is validated in `toVersion` for every version read, and an unfiltered read reads them all, so nothing is skipped. The existence check has no meaning when nothing was requested. The real point — the whole-corpus read is unbounded — is now stated in the module header and in `02_RESULTS.md` §5.                                                                           |
| 2   | HIGH     | Assertion ordering substitutes `""` for a null `claimedEffectiveDate`, which is only accidentally equivalent to SQLite's NULL-first ordering. | **FIXED (comment).** The equivalence is correct and now says so: `""` sorts before any ISO date, matching SQLite's position for NULL. No behaviour changed.                                                                                                                                                                                                                                                                                          |
| 3   | HIGH     | `contextDocumentIds` is not validated: duplicates, unknown ids and a repeated requested document are accepted silently.                       | **ACCEPTED, with the refusal proved.** Duplicates and a repeated document are deduplicated by `loadStateForMany`. An unknown id contributes nothing, and that is not silent: if it was meant to supply an evidence document, the projection now answers `EVIDENCE_DOCUMENT_NOT_LOADED` instead of skipping the check. The option's comment says this. Throwing on an unknown id would add queries to reject a list whose failure is already visible. |
| 4   | HIGH     | The `EVIDENCE_DOCUMENT_NOT_LOADED` path may skip `reviewEvidenceIds` bookkeeping.                                                             | **CLEAN on the reviewer's own re-check.** The `continue` is intentional: a failed ref discards the review's whole evidence base, and ids are only contributed when every ref passed.                                                                                                                                                                                                                                                                 |
| 5   | MEDIUM   | The chain header's "no in-memory corpus" claim is overstated because `recordEffectClaim` takes the corpus.                                    | **CLARIFIED.** The header already says this is the single deliberate post-write use and that it never reaches the verifier; `02_RESULTS.md` §4 repeats it. No claim was weakened.                                                                                                                                                                                                                                                                    |
| 6   | MEDIUM   | Gate 16's chain still copies corpus rows with a test helper, unlike Gate 18.                                                                  | **ACCEPTED, pre-existing and documented in that file.** Gate 17 replaced the helper for its own chain; rewriting Gate 16's seeding is not this gate's work and would blur what Gate 16 proved.                                                                                                                                                                                                                                                       |
| 7   | LOW      | "Structurally identical" — the names differ (`Citation*` in ingestion, `Corpus*` in the engine).                                              | **ACCEPTED.** The shapes match and a compile-time assignment proves it; the differing names are the point of declaring them locally.                                                                                                                                                                                                                                                                                                                 |
| 8   | LOW      | `IN_BATCH = 90` is duplicated in the reader and the store.                                                                                    | **ACCEPTED.** Deliberate: the reader does not import the store's internals, and 90 is far below SQLite's parameter limit.                                                                                                                                                                                                                                                                                                                            |

## Clean areas named by the reviewer

- the projection refusal is sound given the foreign key, and its explanation is
  honest and reachable;
- reader scoping by `document_id` is consistent with the foreign keys on provisions
  and chunks;
- the local interfaces match `CitationCorpusView` field for field;
- `loadStateForMany` unions by id, sorts deterministically, and handles cross-document
  supersession the way the projection expects;
- the Gate 16 edit is a caller correction, not a test bent to pass;
- boundaries hold: no real document, no counsel record, no migration change, no
  authorization cell flipped, and read-time authorization is still absent rather than
  implied present.

## What the review did not change

Nothing in the behaviour of the reader, the merge, the lookup or the refusal. One
comment and one option comment were extended, and the unbounded whole-corpus read is
now named where a reader will see it. The reviewer's CRITICAL was a misreading of
where the `is_current` check lives, and the disposition records that rather than
quietly "fixing" a non-defect — a change made to satisfy a wrong finding would have
made the reader worse.
