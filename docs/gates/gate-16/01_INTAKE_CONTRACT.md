# 01 — The Intake Contract

**Module:** `packages/legal-ingestion/src/effect-intake.ts`
**Entry point:** `recordEffectClaim(corpus, input)`
**Tests:** `tests/authority/gate16-effect-intake.test.ts`

## 1. Shape

```ts
recordEffectClaim(corpus: CorpusState, input: EffectClaimInput):
  | { ok: true; records: EffectClaimRecords; warnings: string[] }
  | { ok: false; reason: string }
```

`EffectClaimRecords` = one `EffectAssertion`, one `EffectEvidence`, and — when the
claim names a target provision that exists — a `ProvisionIdentity` and its
`ProvisionVersionMapping`.

The function is pure: no storage, no clock, no mutation of the corpus, no review.

## 2. What the caller supplies

| Field                                      | Meaning                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `effectType`                               | one of the Gate 8 effect vocabulary (`AMENDMENT`, `REPEAL`, …)                        |
| `scope`                                    | what the claim covers, in the analyst's words                                         |
| `source`                                   | the document, version, optional provision and optional locator the claim is read from |
| `target`                                   | the document the claim is about, optional provision label                             |
| `claimedDate`, `claimedEffectiveDate`      | dates the source asserts, optional                                                    |
| `evidence.chunkId` + optional span         | where in the ingested text the claim is read                                          |
| `evidence.classification`                  | optional; defaults to `UNKNOWN`                                                       |
| `analyst.id`, `analyst.recordedAt`         | who recorded it and when                                                              |
| `supersedesAssertionId`, `conflictGroupId` | optional lineage                                                                      |

## 3. What it produces

- **Evidence** pinned to bytes: `passage` is `chunk.content.slice(start, end)`,
  `contentHash` is the source version's stored hash, `locator` is the caller's or
  `chunk:<chunkId>`, `documentVersionId` / `provisionVersionId` identify where it came
  from, `availability: "AVAILABLE"` because it is in the corpus.
- **Assertion** with `state: "UNREVIEWED"`, `assertionOrigin: "ANALYST_INTAKE"`,
  `recordedBy` and `recordedAt` from the analyst, and the target's current version id
  where one exists.
- **Identity and mapping** when a target provision label was given and matched.

## 4. Refusals

Ordered; the first failure wins and no record is produced.

| Reason                     | Condition                                                                        |
| -------------------------- | -------------------------------------------------------------------------------- |
| `unknown_source_document`  | input not an object; source document id missing/blank/unknown                    |
| `unknown_source_version`   | version missing or not in the corpus                                             |
| `version_not_of_document`  | version belongs to another document                                              |
| `unknown_target_document`  | target document missing/blank/unknown                                            |
| `unknown_chunk`            | evidence chunk missing/unknown                                                   |
| `chunk_not_of_source`      | chunk belongs to another document or version                                     |
| `chunk_span_invalid`       | span half-supplied, non-integer, negative, empty, inverted or past the chunk end |
| `invalid_effect_type`      | not in the Gate 8 vocabulary                                                     |
| `missing_scope`            | blank                                                                            |
| `missing_analyst`          | blank                                                                            |
| `invalid_recorded_at`      | not a parseable instant                                                          |
| `invalid_claim_date`       | not a real `YYYY-MM-DD`                                                          |
| `unknown_target_provision` | a label was named but no provision of the target matches it                      |

Runtime junk is refused, not thrown: a non-object input, `NaN` spans and blank ids
all take the matching reason above.

## 5. Warnings (non-fatal)

- `target_is_source` — the claim's source and target are the same document;
- `claimed_date_after_effective` — the stated date is later than the stated
  effective date;
- `evidence_chunk_covers_whole_document` — the cited chunk is the version's only
  chunk, so a "pinned" quotation is the whole text.

Warnings are returned sorted and never change the records.

## 6. Id derivation, and the cycle

`deriveEvidenceId` hashes `assertionId`; `deriveAssertionId` hashes `evidenceId`. Two
records that reference each other cannot both be addressed by content alone, so one
of the two directions must be broken. The module breaks it in favour of the claim:

1. the assertion id is derived with its `evidenceId` set to a documented placeholder;
2. the evidence id is derived from the finished assertion id plus the evidence facts;
3. both records are then bound to the real ids.

Consequences, stated rather than left to be discovered:

- evidence ids are unique per claim, so two claims read from the same passage can
  both be recorded — the case that matters, because one section can support an
  amendment claim and an effectivity claim;
- assertion ids are deterministic for the same input, which is what replay
  idempotence requires;
- assertion ids are **not** recomputable from the finished record by calling
  `deriveAssertionId` alone, because the record holds the real evidence id;
- two claims identical in every assertion field but differing in evidence collapse to
  one assertion id, and the second write is rejected as
  `duplicate_authority_record`. That is the correct reading: the claim is one claim,
  and evidence is a property of it.

## 7. What it deliberately does not do

- **No review.** A claim is `UNREVIEWED`. Recording a determination is a counsel act
  under Gate 5; the intake cannot manufacture one, and no test pretends otherwise.
- **No inference.** No summarising, no model call, no "the section probably means".
- **No guessing at spans.** A half-supplied span is refused rather than widened.
- **No storage.** Persisting is the caller's decision, via `D1AuthorityStore` or the
  in-memory ledger.

## 8. Known rough edges

- Label matching wraps the package's own `normalizeLabel` (`citation-resolver.ts`)
  after stripping a section-type prefix; the earlier claim that it was a copy of the
  citation engine's function was wrong and is corrected here. One implementation of
  character folding exists in the package, not two.
- The content hash is validated (64 hex characters) rather than deferred to the D1
  store, so a corrupt corpus fails at intake with `invalid_content_hash`.
- A target provision is matched only in the target's **current** version; if the
  document has versions but none marked current, the search falls back to all of
  them, and a label that matches more than one provision is refused as ambiguous
  rather than resolved by ordering.
