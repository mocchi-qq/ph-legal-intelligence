# DECISION — Gate 17

**Date:** 2026-11-17
**Baseline:** `95c4709` (Gate 16, ACCEPTED WITH LIMITATIONS)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

**A real ingest now lands where the projection reads.** `writeCorpusToD1` inserts an
ingested `CorpusState` into the five canonical tables — documents, versions,
provisions, chunks, manifestations — in foreign-key order, and the chain test proves
it: ingest two synthetic documents, write them, read them back through
`D1AuthorityStore.loadStateFor`, record a claim from a real chunk, record a review,
and verify. **No row in that test is built by a helper.**

**The writer cannot rewrite history.** Insert-only: no UPDATE, no DELETE, and a row
that already exists with different content is a conflict that aborts the whole write
instead of being reconciled.

**It refuses before it writes.** Duplicate ids inside one corpus, missing required
columns, out-of-vocabulary statuses, unresolved foreign keys, and any content
difference are all reported as conflicts with nothing written. Report counts are
taken only after `db.batch()` resolves, so a report never claims a row that is not
durable.

**Atomicity was made a requirement, not an assumption.** Review found that the
sequential fallback could leave a corpus half-written while reporting success; the
path was deleted and a handle without `batch` now throws `batch_required` before
reading anything.

## 2. Evidence

| Check                                 | Result                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Full suite                            | **801 tests — 792 pass, 0 failures, 9 skipped** (two consecutive green runs) |
| Gate 17 tests                         | 24 (15 writer, 9 chain)                                                      |
| Build                                 | exit 0                                                                       |
| Biome                                 | exit 0, 0 errors                                                             |
| Independent review                    | 1 pass, 8 findings: 7 fixed, 1 accepted with a comment                       |
| Production files changed after review | 1 module, hardened; nothing relaxed                                          |

## 3. Why ACCEPTED WITH LIMITATIONS

1. **There is still no production D1 → `CitationCorpusView` reader.** Layers 1–3 of
   the verifier (identity, location, support) read the ingested corpus; only layer 4
   reads D1. A caller with two documents also merges snapshots by hand. Both are test
   or caller code today; making them production surfaces is backlog B-5.
2. **`batch()` atomicity is proven on SQLite only.** No remote D1, no workerd run;
   the D1 binding's own batch behaviour remains unverified since Gate 7.
3. **The writer covers five tables.** `extraction_jobs`, `verification_records`,
   `document_relationships` and `citation_aliases` are deliberately out of scope, and
   the module header says so rather than leaving a reader to assume a complete
   database.
4. **The registry has no removal API**, by design; a withdrawn decision is modelled as
   an absent one, not a deletion.

## 4. On the review

Seven of eight findings were real defects, including a CRITICAL that would have made
the reported counts lie under a batch failure. The eighth — identifiers interpolated
into SQL templates — was accepted: they are module literals, never corpus data, and
parameterising identifiers is not a thing SQLite permits.

The pattern is worth recording: the first version of a persistence adapter was
optimistic about atomicity and about how much the database would validate. The
reviewer's "what happens when table three fails" question is the one that produced
the real fix.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Next action

**Backlog B-5: a production D1 reader** for the citation corpus view and a
multi-document snapshot loader, so verification can run entirely from the database
rather than from the in-memory corpus plus a merged snapshot.

After that, the only remaining blockers to corpus readiness are legal: one counsel
determination for one source and its four ingestion activities, and one bounded
sample. B-2 (the `synthetic` ingestion exemption) and B-3 (read-time authorization)
remain open and are not on that path.
