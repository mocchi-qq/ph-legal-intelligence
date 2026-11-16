# DECISION — Gate 15

**Date:** 2026-11-16
**Baseline:** `3cc2dc9` (Gate 14, ACCEPTED)
**Verdict:** **ACCEPTED WITH LIMITATIONS**

## 1. What was accepted

A single rehearsal now runs the whole synthetic path — authorize → acquire → ingest
→ extract → index → retrieve → verify — with the real classes, and asserts a
concrete value at every step: one document, one current version, two chunks with
spans, an index containing exactly those chunks with the other document reported as
excluded, retrieval returning the ingested document with a span and provenance, and
a citation verified through the registry-backed lookup with
`authorizationSource: "document_activity"`.

It also proves the refusals, which is the part that matters more: acquisition
without `downloading`, ingestion without `text_extraction`, indexing without
`search_indexing`, projection without an authorization input, a target that nobody
has decided, and an assertion source authorized only for a different activity. Each
fails with its specific code, and no artifact is produced.

## 2. Evidence

| Check                   | Result                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Rehearsal               | 12 tests, all passing                                                                                                           |
| Full suite              | **723 tests — 714 pass, 0 fail, 9 skipped**                                                                                     |
| Build                   | exit 0                                                                                                                          |
| Biome                   | exit 0, 0 errors                                                                                                                |
| Production code changed | none                                                                                                                            |
| Independent review      | 1 pass (cross-lane), 6 findings: 1 framing fixed, 1 rejected with evidence, 2 confirmed and recorded, 2 accepted as limitations |

## 3. Why the verdict is qualified

The rehearsal did its job: it found gaps that isolated tests could not. Three of
them are real and none is fixable by a patch inside this gate.

1. **Ingestion does not populate the authority ledger.** The verified citation rests
   on a separately seeded ledger. That separation is correct in principle — deriving
   legal-effect assertions from an artifact automatically would be a legal judgement,
   not an ingestion step — but the analysis step has no recorded contract or test
   yet.
2. **`synthetic: true` skips the four ingestion activity checks.** It requires the
   caller to also supply a `synthetic://` locator, and the audit records zero
   decision refs, so it is visible rather than silent — but the flag is a caller
   assertion and the label does not distinguish "checked" from "exempt". Backlog
   card opened.
3. **`retrieve` has no read-time authorization.** Enforcing `viewing` or
   `citation_display` per query requires an identity model that does not exist here.

## 4. A note on the review

The reviewer graded the seeded ledger CRITICAL, on the basis that the test reads as
proof of end-to-end wiring. That was a fair reading of the original header, which
has been rewritten. The finding is kept in full in `02_REVIEW.md` rather than
downgraded — the gap is real; what changed is that the test no longer implies
otherwise.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorization cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was pushed or deployed.

## 6. Next action

Two candidate cards, in order:

1. **Analysis-step contract** — how a recorded assertion, its evidence and a review
   get from an ingested artifact into the ledger, with a test that runs the whole
   chain without hand-seeding. This is the gap the rehearsal actually exposed, and it
   is the last piece of wiring between ingestion and verification.
2. **Close the `synthetic` bypass** — require registry decisions for synthetic
   artifacts too (the registry already accepts `SYNTHETIC_FIXTURE`), or give the
   exemption a distinct audit marker.

Corpus readiness still waits on a genuine counsel determination, and nothing here
substitutes for one.
