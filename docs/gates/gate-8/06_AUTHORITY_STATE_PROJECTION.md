# 06 — Authority-State Projection

**Date:** 2026-11-14
**Status:** design + synthetic implementation.

## 1. What projection is

A deterministic function:

```
project(ledgerSnapshot, target, asOf, authorization?) -> AuthorityProjection
```

It consumes assertions, evidence, reviews and provision mappings. It never writes,
never calls a model, never reads the clock for legal conclusions, and never
"fills in" missing facts.

## 2. Decision order (first match wins)

1. **Authorization** — if the supplied check denies, return `UNAUTHORIZED`
   immediately. Legal data does not override a processing denial.
2. **Target existence** — no document → `UNKNOWN` with `MISSING_DOCUMENT`.
3. **Assertions** — none for the target → `UNKNOWN` with `NO_ASSERTION`.
4. **Active reviews** — for each assertion, take reviews with `status = ACTIVE`
   that are not superseded by another active review.
5. **No active reviews** → `PARTIALLY_DETERMINED` with the assertions listed and
   `NO_REVIEWED_CONCLUSION`.
6. **Conflicting outcomes** among active reviews (e.g. `CONFIRMED` and
   `REJECTED`, or two different effective dates) → `CONFLICTED`.
7. **Only rejected/inconclusive** → `UNKNOWN`/`INSUFFICIENT_EVIDENCE`.
8. **Evidence** — every evidence ref used by the deciding review must be
   `AVAILABLE`; otherwise `INSUFFICIENT_EVIDENCE`.
9. **Date** — for an as-of query, a confirmed effect with no effective date →
   `INSUFFICIENT_EVIDENCE` (`UNKNOWN_EFFECTIVE_DATE`).
10. **Apply** the confirmed effect(s) in date order to derive the state.
11. **Result** — `DETERMINED_WITH_REVIEWED_EVIDENCE` only if every contributing
    element is reviewed and evidenced.

## 3. State application

| Confirmed effect                  | State from effective date              |
| --------------------------------- | -------------------------------------- |
| `ENACTMENT` / `EFFECTIVITY`       | `IN_FORCE`                             |
| `AMENDMENT` / `PARTIAL_AMENDMENT` | `AMENDED` / `PARTIALLY_AMENDED`        |
| `REPEAL` / `PARTIAL_REPEAL`       | `REPEALED` / `PARTIALLY_REPEALED`      |
| `SUSPENSION`                      | `SUSPENDED`                            |
| `JUDICIAL_INVALIDATION`           | `INVALIDATED`                          |
| `REINSTATEMENT`                   | `IN_FORCE`                             |
| `CONSOLIDATION`                   | `CONSOLIDATED`                         |
| `RENUMBERING`                     | `RENUMBERED` (provision-level)         |
| `OTHER`                           | `UNKNOWN` (explicitly not interpreted) |

Effects before `asOf` apply; effects after do not. Same-date ordering is by
`claimedEffectiveDate`, then assertion ID (deterministic tie-break, documented).

## 4. Explanation contract

Every projection explains itself:

- `explanation`: one sentence, human-readable, no legal conclusion beyond the
  recorded review;
- `missing`: machine codes. Current implementation emits: `INVALID_DATE`,
  `NOT_AUTHORIZED`, `MISSING_DOCUMENT`, `NO_ASSERTION`,
  `NO_REVIEWED_CONCLUSION`, `CONFLICTING_REVIEWS`, `INCONCLUSIVE_REVIEW`,
  `NO_CONFIRMED_EFFECT`, `MISSING_ASSERTION`, `EVIDENCE_UNAVAILABLE`,
  `CONDITIONS_UNMET`, `UNKNOWN_EFFECTIVE_DATE`, `CONFLICTING_EFFECTIVE_DATES`,
  `EFFECT_NOT_INTERPRETED`, `VERSION_NOT_IN_EFFECT`. `MAPPING_UNCERTAIN` is
  reserved; projection does not yet consume provision mappings.
- `assertions`/`reviews`/`evidence`: IDs used;
- `conflicts`: IDs of conflicting reviews;
- `abstained`: true whenever the outcome is not
  `DETERMINED_WITH_REVIEWED_EVIDENCE` or `UNAUTHORIZED`.

## 5. Hard rules

- No reviewed determination → no confirmed effect.
- A source authorization decision cannot be used as a review.
- A review cannot grant reuse.
- Missing evidence → deny/unknown.
- Conflicting reviews → conflict, not "latest wins".
- Superseded/revoked reviews are inactive.
- Newest retrieval time is never an input.

## 5.1 Multiple applied effects (documented semantics)

When more than one reviewed effect applies on or before the as-of date, the
projected `state` reflects the **last applied effect in effective-date order**
(then assertion ID). Earlier effects remain visible through the `assertions`
array and their IDs; the projection is a summary state, not a substitute for the
history. This is deliberate: inventing composite labels such as
`AMENDED_THEN_REPEALED` would encode legal doctrine the reviewer did not state.

`versionId` is returned only when all confirmed effects reference exactly one
distinct version. If they reference several, it is `null` and the caller must use
the assertions/evidence IDs; the projection does not guess a version.

Only `claimedEffectiveDate` gates application. A `claimedDate` (enactment) later
than the query date does not by itself block an effect whose reviewer confirmed
an earlier effectivity date; the reviewer is responsible for that ordering, and
the model does not infer a legal rule.

## 6. Determinism

Given the same ledger snapshot, target, date and authorization result, the output
is byte-identical. No randomness, no wall clock, no network. Tests assert this.

## 7. Integration

- Citation verification layer 4 calls projection for the cited authority and the
  relevant date; it does not read `legalStatus` directly.
- Search may return `AuthorityProjection` as a separate field; it must not fold it
  into a relevance score.
- A UI must display outcome, state, date and explanation together, or display
  `UNKNOWN`.
