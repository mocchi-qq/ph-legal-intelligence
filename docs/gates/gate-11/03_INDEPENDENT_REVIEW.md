# 03 — Independent Review

**Date:** 2026-11-15
**Review:** one read-only pass, reviewer on the other lane from the author.
**Scope:** deterministic ids module and its tests, the four new documents, the
README status rewrite, the two corrected retrieval comments, and the plan.

## Findings and disposition

| ID  | Severity | Finding                                                                                                                                                                                                          | Disposition                                                                                                                               |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MINOR    | `canonicalJson` serialised `-0` and `0` identically, so two records differing only in the sign of zero collided.                                                                                                 | **FIXED** — negative zero is rejected as `unsupported_canonical_value`; tested.                                                           |
| R2  | MINOR    | A sparse array and a dense array with an explicit `undefined` encoded identically, though the encoder elsewhere claims to refuse silent collisions.                                                              | **FIXED** — sparse arrays are rejected; the dense form still encodes to `[1,null,3]`; both tested.                                        |
| R3  | MINOR    | `deriveEvidenceId` hashed `classification` and `availability` while its comment named neither — and `availability` is lifecycle (`NOT_RECEIVED` → `AVAILABLE`), so a change would have forked the same evidence. | **FIXED** — `availability` excluded as lifecycle; `classification` kept as identity; all hashed fields now listed in the comment; tested. |
| R4  | NIT      | The README table sent readers to a gate-0 directory that does not exist.                                                                                                                                         | **FIXED** — Gate 0 points at `GATE0_REPORT.md` at the repository root; Gates 1–4 at `docs/gates/gate-N/`.                                 |
| R5  | NIT      | A test named "rejects the D1 replay" only exercised the SQLite shim.                                                                                                                                             | **FIXED** — renamed to say SQLite shim.                                                                                                   |
| R6  | NIT      | The unsupported-value error did not say which type was rejected.                                                                                                                                                 | **FIXED** — the message names the constructor, keeping the `unsupported_canonical_value` prefix stable.                                   |
| R7  | NIT      | `deriveAssertionId` hashed `conflictGroupId` without saying why; conflict grouping is assigned during review, so hashing it forks the claim when it is later grouped.                                            | **FIXED** — excluded as review-time metadata; `supersedesAssertionId` remains identity; tested.                                           |
| R8  | NIT      | The retrieval document said the key is "present in the chunk", implying a stored normalised form; normalisation happens at check time.                                                                           | **FIXED** — wording now says the key appears in the normalised chunk text.                                                                |

## Clean areas (reviewer's own assessment)

- **Field selection.** Every true identity field is hashed and every volatile or
  lifecycle field is excluded; a collision is caught by the duplicate check and
  the triggers rather than silently dropped.
- **`canonicalJson` core.** Key sorting, array order, `undefined` handling,
  non-finite rejection and non-plain-object rejection all behave as documented.
- **Test honesty.** The tests prove determinism, sensitivity to every identity
  field, insensitivity to every provenance and lifecycle field, array-order
  sensitivity, a round-trip through the ledger and the SQLite shim with duplicate
  rejection, and unsupported-value rejection. No tautologies found.
- **Documentation truthfulness.** No overclaim about D1 runtime validation,
  semantic search, authorisation status or product capability.
- **Boundaries.** No document acquired, ingested or fabricated; no migration
  altered.

## Residual limitations

1. D1 remains validated on `node:sqlite` only; no remote D1 or workerd run.
2. Idempotence is id-based, not concurrency-safe: two racing writers both pass the
   duplicate pre-check and the loser lands on the append-only trigger.
3. No lifecycle-transition record type exists, so `state`/`reviewStatus`/`status`
   cannot legitimately change in place; such a write is rejected, not recorded.
4. The verification path still uses the lexical support proxy.
5. No real corpus and no counsel determination.
