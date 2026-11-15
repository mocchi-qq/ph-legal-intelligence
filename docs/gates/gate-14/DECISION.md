# DECISION — Gate 14

**Date:** 2026-11-15
**Baseline:** `f289e07` (Gate 13, ACCEPTED WITH LIMITATIONS)
**Verdict:** **ACCEPTED**

## 1. What was accepted

**The last authorization bypass in the retrieval path is closed.** `buildSearchIndex`
no longer accepts an arbitrary `authorize` callback returning a boolean. It requires
a `DocumentActivityAuthorization`, fixes the activity to `search_indexing` and the
role to `TARGET` itself, resolves each document once, and indexes only documents
whose decision is `AUTHORIZED`.

**Exclusions are reported, not swallowed.** `SearchIndex.excludedDocuments` carries
one decision per document that had chunks and was not authorized, with the reason
and the registry reference where one exists.

**Malformed answers fail closed.** An answer that is not an object, carries a
non-canonical decision, names a different activity, or names a different document is
excluded with `invalid_decision`, `activity_mismatch`, `unknown_activity` or
`document_mismatch` — it is never read as permission.

**The same rule now holds one layer up.** The authority projection's
`normalizeResolution` refuses a resolver answer that does not name the document and
activity it was asked about, which is what Gate 13's own specification required and
what the code had been inferring instead of checking.

## 2. Evidence

| Check                    | Result                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Full suite               | **711 tests — 702 pass, 0 failures, 9 skipped** (69 files: 67 passed, 2 skipped)                                   |
| Gate 14 tests            | 11 (registry-backed index authorization)                                                                           |
| Related tightening tests | 5 (projection resolver identity)                                                                                   |
| Build                    | exit 0                                                                                                             |
| Biome                    | exit 0, 0 errors                                                                                                   |
| Package typechecks       | `legal-search` 0, `legal-ingestion` 0                                                                              |
| Migrations               | `0001`–`0009` unmodified; none added                                                                               |
| Independent review       | 1 pass, 8 findings: 4 fixed, 1 partly fixed (reason recorded), 2 rejected with evidence, 1 accepted with a comment |

## 3. Why ACCEPTED rather than qualified

The previous two gates qualified their verdicts because bounded gaps remained in the
authorization model. This gate closes the last one that can be closed without a legal
input or a new subsystem:

- no supported interface can now index a document under the wrong activity;
- no supported interface can index on a bare boolean or a bare decision;
- exclusions are visible, so a partially authorized corpus cannot masquerade as a
  complete one;
- nothing about ranking, scoring, the passage contract or the benchmark outputs
  changed.

What remains is not an authorization gap in the library: reads are ungated because
there is no user to gate them for, and no cell is authorized because no counsel
determination exists. Both are stated in §4 and in `04_LIMITATIONS.md`.

## 4. Limitations

1. **Read time is ungated.** `retrieve` performs no authorization; holding an index
   is sufficient to search it. Enforcing `viewing` or `citation_display` per query
   needs an identity model this library does not have.
2. **A resolver is trusted to answer truthfully.** The library verifies that the
   answer names the pair it was asked about; it cannot verify that the registry
   behind it is correct.
3. **No cell is authorized.** All 350 remain `UNKNOWN`, so this gate proves refusal.
4. **Eight of fourteen activities still have no runtime enforcement point.**
5. **D1 remains SQLite-shim validated**; this gate touched no storage.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Next action

Corpus readiness, blocked on a genuine counsel determination for one source and the
four activities ingestion enforces. Every engineering prerequisite in the retrieval
and authorization path is now in place and tested.
