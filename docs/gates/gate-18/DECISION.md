# DECISION — Gate 18

**Date:** 2026-11-17
**Baseline:** `9588432` (Gate 17, ACCEPTED WITH LIMITATIONS)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

**Verification now reads from the database.** `loadCitationCorpusView` supplies the
corpus view for layers 1–3 from four canonical tables, `loadStateForMany` supplies the
ledger snapshot for layer 4, and the production lookup puts the citing instrument in
scope. The chain test opens with an ingest and ends with a verifier verdict, and no
view in it is built by hand.

**A silent authorization skip was found and closed.** The projection resolved the
document behind an evidence record only if that record's version happened to be in
the snapshot; when it was not, the check vanished and the review passed with no
evidence code. Since the foreign key guarantees the version exists, absence means the
snapshot was under-loaded. The projection now refuses with
`EVIDENCE_DOCUMENT_NOT_LOADED` and the lookup gained `contextDocumentIds` so a caller
can load what it means to project.

**A test that had been passing by accident was corrected.** Gate 16's chain projected
against an under-loaded snapshot and only passed because the skip was silent. It now
names its source document and reads both documents where it projects directly.

## 2. Evidence

| Check                    | Result                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Full suite               | **826 tests — 817 pass, 0 failures, 9 skipped**                                         |
| Gate 18 tests            | 25 (10 reader, 4 lookup context, 11 chain)                                              |
| Build                    | exit 0                                                                                  |
| Biome                    | exit 0, 0 errors                                                                        |
| Independent review       | 1 pass, 8 findings: 1 rejected as stated, 2 fixed or clarified, 5 accepted with reasons |
| Production files changed | 4 — reader (new), merge method, lookup option, one refusal in the projection            |
| Migrations               | none                                                                                    |

## 3. Why ACCEPTED WITH LIMITATIONS

1. **No remote D1 and no workerd.** Still the SQLite shim. Gate 7's limitation stands
   and now covers the reader as well as the writer.
2. **No read-time authorization.** The reader returns whatever the database holds. A
   corpus written without a decision record would be readable. That is backlog B-3.
   This gate neither adds nor implies it, and the chain says so in its header.
3. **The whole-corpus read is unbounded.** Omitting `documentIds` reads every row of
   four tables. Documented as bounded-corpus use; nothing enforces a cap.
4. **The `synthetic` ingestion exemption (B-2) is still open.** Both chain artifacts
   are ingested with the flag false so the activity checks run.
5. **Gate 16 still seeds D1 with a test helper** in its own chain. Gate 17 and Gate 18
   do not; rewriting Gate 16's fixture is not this gate's work.

## 4. On the review

The reviewer's CRITICAL was wrong — it read the `is_current` check as filtering-only
when it runs on every version the reader maps — and it was recorded as rejected rather
than "fixed". Changing working code to satisfy a misreading would have been the worse
outcome, and a review that cannot be disagreed with on the record is not a review.

The one comment extended (null-date ordering) and the one option note (an unknown
context id is not silent) are the whole remediation.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Next action

**Backlog B-2: close the `synthetic` ingestion exemption.** `pipeline.ts` skips all
four ingestion activity checks when an artifact is flagged synthetic and its URL uses
`synthetic://`, so a caller assertion can bypass the gate the platform exists to
enforce. That is now the largest engineering gap between here and a real ingest.

After B-2, every remaining blocker to corpus readiness is legal: one counsel
determination for one source covering `downloading`, `temporary_processing`,
`text_extraction` and `search_indexing`, and one bounded sample. B-3 (read-time
authorization) stays open and is not on that path.
