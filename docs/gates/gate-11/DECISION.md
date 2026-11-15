# DECISION — Gate 11

**Date:** 2026-11-15
**Verdict:** **ACCEPTED**

## 1. What was accepted

**G11-A — the documentation tree is complete and honest.** `docs/product`,
`docs/data-governance`, `docs/retrieval` and `docs/api` now exist with content
traced to the code and the gate records. The test that has failed since Gate 6 —
`tests/unit/docs-structure.test.ts` — passes because the documentation was
written, not because the test was weakened. The README no longer claims the
repository is at Gate 0 with no implementation.

**G11-B — authority records are content-addressed.** `authority-ids.ts` derives a
record's id from its identity fields alone: provenance (`recordedAt`,
`recordedBy`, `createdAt`, `checkedAt`) and lifecycle state (assertion `state`,
mapping `reviewStatus`, review `status`, evidence `availability`, review-time
`conflictGroupId`) are excluded. A replay of an unchanged claim therefore derives
the id already on file and the append-only store rejects it as
`duplicate_authority_record`, instead of forking history. Retirement stays
separable because `supersedesReviewId` and `supersedesAssertionId` are identity.

**G11-C — two source comments and one warning.** `retrieve.ts` no longer claims
that `exactPassage` is returned to callers or that `exactMatch` requires the
number in the passage text; both claims contradicted the code. An unused
destructuring was removed, clearing a Biome warning.

## 2. Evidence

| Check                | Result                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| Full suite           | **619 tests — 610 pass, 0 failures, 9 skipped** (63 files: 61 passed, 2 skipped) |
| Baseline failure     | gone — `docs-structure.test.ts` now passes                                       |
| New tests            | 21 in `tests/authority/authority-ids.test.ts`                                    |
| Build (`pnpm build`) | exit 0                                                                           |
| Biome                | exit 0, 0 errors, 84 warnings (one fewer than baseline)                          |
| Independent review   | 1 pass, 8 findings, all fixed                                                    |
| Migrations           | `0001`–`0009` unmodified                                                         |

## 3. Why ACCEPTED rather than ACCEPTED WITH LIMITATIONS

Every limitation this gate touched is either closed or recorded as an explicit,
tested property of the system rather than an unknown:

- the documentation gap is closed and the suite is fully green;
- idempotence is proven for the replay case that matters (same claim, different
  provenance or lifecycle state) and the untested case — concurrent writers — is
  named in §4 rather than implied to work;
- no capability is claimed that the code does not have. The two inaccuracies
  found were in comments and documentation, and both were corrected against the
  code.

This is a verdict on engineering maintenance only. It moves no legal position:
the platform still holds no real document and no counsel determination.

## 4. Limitations carried forward

1. **D1 is still shim-validated.** No remote D1 or workerd run; the Gate 7 binding
   limitation is unchanged and the adapter remains `IMPLEMENTED_UNVERIFIED`
   against real D1.
2. **Idempotence is id-based, not concurrency-safe.** Two racing writers both pass
   the duplicate pre-check; the loser lands on the append-only trigger. Correct
   rejection, not graceful idempotence.
3. **No lifecycle-transition record type.** `state`, `reviewStatus`, `status` and
   `availability` cannot legitimately change in place on an append-only table, so
   such a write is rejected. Recording a transition needs an additive record type;
   deferred, not implemented.
4. **Mapping review was not redesigned.** The `reviewStatus` field has no
   transition workflow; it is set at insert and immutable.
5. **Support verification is still the lexical proxy**, not entailment.
6. **No real corpus, no counsel determination**, 350 authorisation cells
   `UNKNOWN`, four pilot documents `BLOCKED_AUTHORIZATION`.

## 5. Boundary

No real Philippine legal document was acquired, read, extracted, indexed or
reprocessed. Counsel determinations remain **0**. All **350** authorisation cells
remain `UNKNOWN`. The four pilot documents remain `BLOCKED_AUTHORIZATION`. No
migration was altered. Nothing was deployed or pushed.

## 6. Next action

The engineering tree is now internally consistent and fully green, so the next
justified gate is the one Gate 10 named: **corpus readiness**, which requires a
genuine counsel determination authorising one source and one activity pair before
any real document is touched. Until that determination exists, further work should
be limited to evaluation harnesses, the deferred lifecycle-transition record type,
and the D1 runtime verification that this host cannot perform.
