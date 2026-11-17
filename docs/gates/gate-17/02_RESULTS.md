# 02 — Results

**Date:** 2026-11-17
**Baseline:** `95c4709` (Gate 16) — 777 tests, 768 pass, 9 skipped.
**Final:** **801 tests — 792 pass, 0 fail, 9 skipped.**

| Check      | Baseline       | Final                      |
| ---------- | -------------- | -------------------------- |
| Tests      | 777 (768 pass) | **794 (785 pass, 9 skip)** |
| Test files | 72 (70 passed) | 74 (72 passed, 2 skipped)  |
| Build      | exit 0         | exit 0                     |
| Biome      | exit 0         | exit 0, 0 errors           |
| New tests  | —              | 17 (8 writer, 9 chain)     |

## 1. The writer

`writeCorpusToD1` inserts an ingested `CorpusState` into the five canonical tables in
foreign-key order. It is insert-only: no UPDATE, no DELETE, and a row that already
exists with different content is a conflict that aborts the whole write rather than
an overwrite. Because D1 has no transaction primitive on this path, "verify then
write" is the only honest way to avoid a half-written corpus — and the report says
it is best-effort, not atomic.

Tested (15):

- every column round-trips for `legal_documents`, `document_versions`,
  `legal_provisions`, `document_chunks`, `source_manifestations`;
- a replay inserts nothing and reports every id unchanged;
- a changed title, and separately a changed version hash, produce a conflict naming
  the column, insert nothing, and leave the stored values untouched;
- a title and a chunk containing `'); DROP TABLE legal_documents; --` are stored
  verbatim and the table survives;
- provisions and chunks insert without an FK error, and a dangling reference is
  rejected — which also shows the shim enforces foreign keys and that a rejected
  write leaves no rows;
- an empty corpus reports zeros and issues no statements;
- a handle without `batch` throws before any read, and a failing batch reports zero;
- a replay with a different clock is unchanged rather than conflicting;
- a duplicate id inside one corpus, a missing `retrieved_at`, an out-of-vocabulary
  `legal_status`, and a null column with a schema default each behave correctly.

`batch` became mandatory during review: the sequential fallback could leave a corpus
half-written while the report claimed success, and the fix was to remove the path
rather than document the risk.

## 2. The chain

`tests/integration/gate17-d1-chain.test.ts` (9 steps) replaces the hand-copied rows
Gate 16 needed:

| Step      | Observed                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ingest    | two synthetic documents, `synthetic: false`, so the four activity checks run                                                                                          |
| write     | report `2/2/4/4/2`, `unchanged` and `conflicts` empty, one batch; `SELECT COUNT(*) FROM legal_documents` is exactly 2                                                 |
| read back | `D1AuthorityStore.loadStateFor` returns both documents, their versions and provisions, with hashes confirmed by direct `SELECT`                                       |
| claim     | `recordEffectClaim` over a real source chunk; identity, mapping, assertion and evidence persisted and read back; the evidence passage equals the D1 chunk's byte span |
| snapshot  | the merged two-document snapshot is built from D1 alone and contains both documents, 2 versions, 4 provisions                                                         |
| no review | `PARTIALLY_DETERMINED`, `NO_REVIEWED_CONCLUSION`, layer 4 false                                                                                                       |
| review    | `DETERMINED_WITH_REVIEWED_EVIDENCE`, state `AMENDED`, verifier `VERIFIED`                                                                                             |
| refusal   | a registry without `citation_display` → target `NOT_CHECKED`, layer 4 false, review still on file                                                                     |

No row in that test is written by a helper. That is the point.

## 3. What the chain still does not prove

- **There is no production D1 → `CitationCorpusView` reader.** Layers 1–3 (identity,
  location, support) therefore read the ingested corpus; only layer 4 reads D1. A
  production reader is backlog card B-5.
- **The merged-snapshot lookup is a test-local adapter.** `createAuthorityStatusLookup`
  is typed to one document; a caller with two documents merges snapshots by hand. If
  that becomes a real need, it belongs in production with its own tests.
- **The registry has no removal API** — being append-only is a feature — so "a
  decision was withdrawn" is modelled by building a registry that never recorded it.
- Writer scope excludes `extraction_jobs`, `verification_records`,
  `document_relationships` and `citation_aliases`, as stated in its header.
- D1 is still the SQLite shim: no remote D1, no workerd run, so `batch()` atomicity
  is proven on SQLite only — the D1 binding's own behaviour remains unverified.
- Nothing legal: every id, passage and review is synthetic; 0 counsel determinations
  and 350 `UNKNOWN` cells.
