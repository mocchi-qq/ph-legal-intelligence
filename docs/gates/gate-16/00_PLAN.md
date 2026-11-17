# 00 — Gate 16 Plan: Effect Claim Intake

**Date:** 2026-11-16
**Baseline:** `53f6db5` (Gate 15), clean, 723 tests.
**Scope:** synthetic only. No real document, no counsel record, no migration.

## 1. The seam Gate 15 found

Ingestion produces documents, versions, provisions and chunks. The authority ledger
holds assertions, evidence and reviews. Nothing connects them: every test so far
that verifies a citation seeds the ledger by hand, which is why the Gate 15 rehearsal
could only verify against a ledger it wrote itself.

The missing step is not an integration call, because deriving a legal-effect claim
from text is an analytical act, not an ingestion step. It is a **contract for
recording an analyst's claim** with evidence pinned to the artifact it came from.

## 2. Deliverable

`packages/legal-ingestion/src/effect-intake.ts` — a pure function that turns an
ingested corpus plus a claim into ledger records, plus tests. No storage, no clock,
no inference.

```ts
recordEffectClaim(corpus, input) → { ok: true, records, warnings } | { ok: false, reason }
```

`records` = `EffectAssertion` + `EffectEvidence` (+ `ProvisionIdentity` and
`ProvisionVersionMapping` when the claim points at a provision that exists).

## 3. What it must refuse

The function's value is what it will not record:

| Condition                                               | Reason                                                    |
| ------------------------------------------------------- | --------------------------------------------------------- |
| source document not in the corpus                       | `unknown_source_document`                                 |
| source version unknown, or not the source document's    | `unknown_source_version` / `version_not_of_document`      |
| target document not in the corpus                       | `unknown_target_document`                                 |
| evidence chunk unknown                                  | `unknown_chunk`                                           |
| evidence chunk is not from the source document/version  | `chunk_not_of_source`                                     |
| span outside the chunk, inverted, or non-integer        | `chunk_span_invalid`                                      |
| effect type outside the vocabulary                      | `invalid_effect_type`                                     |
| missing scope, missing analyst id, invalid `recordedAt` | `missing_scope`, `missing_analyst`, `invalid_recorded_at` |
| claim date not a real ISO date                          | `invalid_claim_date`                                      |
| provision label named but not present on the target     | `unknown_target_provision`                                |

A claim that cannot be pointed at bytes is not evidence, so no record is produced.

## 4. What it must not do

- **No review.** A claim is `UNREVIEWED`; recording a determination is counsel's
  act, governed by Gate 5 and not automatable. The intake never writes a review.
- **No inference.** The passage is the corpus text at the claimed span; the content
  hash is the version's stored hash. Nothing is paraphrased, summarised or generated.
- **No clock.** `recordedAt` comes from the caller; ids are derived deterministically
  (Gate 11), so replaying the same claim yields the same ids.
- **No storage.** Records are returned; the caller decides whether to persist them.

## 5. Acceptance

- A claim built from a real ingested chunk produces an assertion whose evidence
  passage is that chunk's text at that span, with the version's content hash, and
  deterministic ids.
- Every refusal in §3 is asserted, and no record is returned for any of them.
- A replay of the same claim yields identical assertion and evidence ids.
- The chain then closes without hand-seeding: ingest → claim → persist → review →
  project → verify, with the assertion and evidence coming from the intake.
- Full suite green, build exit 0, Biome 0 errors, no migration, all 350 cells
  unchanged.

## 6. Non-goals

Read-time authorization, the `synthetic` ingestion exemption, real corpus, migration,
deployment.
