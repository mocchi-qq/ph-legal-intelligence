# 15 — Next-Gate Recommendation

**Recommendation:** the next gate should be **corpus readiness**, and it is
blocked on a genuine counsel determination rather than on engineering.

## 1. Why nothing else is urgent

Gate 13 closes the last authorization hole that could be closed without a legal
input: every projection now asks about one activity, for one document, and refuses
when it cannot get an answer. The remaining engineering items are bounded and
neither blocks a first real ingest nor risks a wrong answer today:

| Candidate                                                      | Value                             | Why it can wait                                  |
| -------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| Wire `buildSearchIndex`'s `authorize` callback to the registry | closes a pre-existing weaker gate | the index is not served; `retrieve` has no route |
| Persist `authorizationChecks`                                  | audit completeness                | needs a storage decision, not a patch            |
| Lifecycle-transition record type                               | unblocks mapping review           | no mapping workflow exists to unblock            |
| D1 runtime verification on a workerd host                      | proves the binding                | host limitation, not a design gap                |
| Mapping-review workflow                                        | real feature                      | needs the transition type first                  |

## 2. What corpus readiness needs

1. A **genuine counsel determination** for one source and one activity — at
   minimum `downloading`, `temporary_processing`, `text_extraction` and
   `search_indexing`, because ingestion enforces all four.
2. That determination recorded in the shape `counsel-determinations.ts` validates,
   with the reviewer, decision date, scope and evidence the registry requires.
3. The corresponding matrix cell moved from `UNKNOWN` to `AUTHORIZED` (or
   `AUTHORIZED_WITH_CONDITIONS` with conditions this gate can satisfy).
4. A bounded sample — one document, one version — ingested, extracted and indexed,
   with the four activity checks observed to pass and the second document still
   refused.

Only after that does a citation-verification result on real text mean anything.

## 3. What this gate recommends _not_ doing

- Do not promote a cell to unblock a demo. The 350-cell state is the honest state.
- Do not replace the caller-asserted path with a permissive default to make a test
  pass; the failure mode this gate removed was exactly that.
- Do not treat the SQLite shim as D1 verification.

## 4. If engineering must continue before counsel responds

The next most defensible card is the lifecycle-transition record type, because it
is the one remaining item that three separate gate decisions have named as a
limitation and that can be built and tested entirely synthetically. It should be
scoped as narrowly as this gate was: one table, one projection rule, one test
matrix, and no claim that mapping review therefore works.
