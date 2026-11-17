# 02 — Results

**Date:** 2026-11-16
**Baseline:** `53f6db5` (Gate 15) — 723 tests, 714 pass, 9 skipped.
**Final:** **777 tests — 768 pass, 0 fail, 9 skipped.**

| Check      | Baseline       | Final                      |
| ---------- | -------------- | -------------------------- |
| Tests      | 723 (714 pass) | **770 (761 pass, 9 skip)** |
| Test files | 70 (68 passed) | 72 (70 passed, 2 skipped)  |
| Build      | exit 0         | exit 0                     |
| Biome      | exit 0         | exit 0, 0 errors           |
| New tests  | —              | 47 (39 intake, 8 chain)    |

## 1. The intake, and what it refuses

`recordEffectClaim` takes an ingested corpus and an analyst's claim and returns the
ledger records — assertion, evidence, and a provision identity plus mapping when the
claim names a provision that exists. It is pure: no storage, no clock, no review.

The evidence it produces is the corpus bytes at the claimed span, hashed with the
version's stored content hash. A claim that cannot be pinned to bytes is refused with
a specific reason — 17 of them, each tested (four added after review): unknown source
document, unknown or foreign version, unknown target, unknown or foreign chunk, a
cited provision the chunk does not carry, bad span (half-supplied, inverted,
non-integer, past the end), invalid effect type, missing scope or analyst, invalid
recorded-at or claim date, a malformed content hash, a provision label that matches
nothing, and a label that matches more than one provision.

## 2. The chain, without hand-seeding

`tests/integration/gate16-effect-chain.test.ts` (8 tests) runs:

| Step                       | Observed                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authorize + ingest         | two synthetic documents, one current version each, two chunks each, with the four ingestion activities authorized                                                                       |
| claim                      | `recordEffectClaim` over a real source chunk → `AMENDMENT` against the target's Section 2, warnings `[]`, evidence passage exactly the chunk slice, content hash the ingested version's |
| persist                    | identity → mapping → assertion → evidence through `D1AuthorityStore`; the stored assertion deep-equals what the intake returned; zero reviews in the snapshot                           |
| before review              | projection `PARTIALLY_DETERMINED`, `NO_REVIEWED_CONCLUSION`, abstained; verifier `PARTIALLY_VERIFIED`, layer 4 false                                                                    |
| review recorded separately | `CONFIRMED`/`ACTIVE` with the intake's evidence id → `DETERMINED_WITH_REVIEWED_EVIDENCE`, state `AMENDED`, verifier `VERIFIED`                                                          |
| superseding rejection      | `REJECTED`/`REVOKED` superseding the first → back to `PARTIALLY_DETERMINED`, layer 4 false                                                                                              |
| wrong-document chunk       | `{ ok: false, reason: "chunk_not_of_source" }`, nothing persisted                                                                                                                       |

The "before review" step is the one that matters: it shows the intake cannot
manufacture a determination, and that the verified result in the next step depends on
a review recorded afterwards by a separate, auditable act.

## 3. Id derivation

`deriveEvidenceId` hashes `assertionId`, and `deriveAssertionId` hashes `evidenceId` —
a cycle no content-addressed scheme can satisfy from finished records. The intake
breaks it in favour of the claim: the assertion id is derived with a documented
placeholder evidence id, then the evidence id is derived from the finished assertion
id. Consequences, all tested and documented in the code:

- evidence ids are unique per claim, so two claims read from one passage can both be
  recorded (an amendment claim and an effectivity claim from the same section);
- assertion ids are deterministic for identical input, so replays are idempotent;
- assertion ids are **not** recomputable from the finished record by
  `deriveAssertionId` alone, because the row holds the real evidence id;
- identical assertion fields with different evidence collapse to one assertion id,
  whose second write is rejected as `duplicate_authority_record` — correct, because
  the claim is one claim.

The first version of this module got the order the other way round and would have
blocked the legitimate two-claims-one-passage case; that was caught in review of my
own change and corrected before the chain test was written.

## 4. One remaining unwired edge

Ingestion writes documents, versions, provisions and chunks to the corpus store. The
canonical D1 tables (`legal_documents`, `document_versions`, `legal_provisions`) are
still populated by a test-local copy step, not by a production writer. The authority
tables in the chain test receive only intake output and the explicit review call.

So the seam this gate set out to close is closed: the verified assertion comes from
the intake. The remaining edge — corpus → canonical D1 rows — is recorded as backlog
card B-4 rather than fixed here.

## 5. What this does not prove

- Nothing legal: every identifier, passage and review is synthetic.
- Nothing about D1 runtime: the shim is SQLite.
- No review is created by any production path; the one in the test is recorded
  explicitly and labelled synthetic.
- All 350 authorization cells remain `UNKNOWN`; no counsel determination exists.
