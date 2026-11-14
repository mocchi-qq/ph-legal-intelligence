# 04 — Version and Temporal Model

**Date:** 2026-11-14
**Status:** design + synthetic implementation.

## 1. Dates are separate facts

| Date                    | Meaning                | Never substitute |
| ----------------------- | ---------------------- | ---------------- |
| Enactment / approval    | instrument made        | publication      |
| Publication             | text made public       | retrieval        |
| Legal effectivity       | force begins           | database update  |
| Amendment               | text changed           | retrieval        |
| Repeal                  | force ends             | deletion         |
| Judgment / promulgation | decision issued        | publication      |
| Source publication      | source's own date      | ingested date    |
| Retrieval               | platform fetched bytes | any legal date   |
| Ingestion               | pipeline processed     | any legal date   |
| Database update         | record changed         | any legal date   |

Unknown stays `null` or `UNKNOWN`. No date is derived from a generic formula; a
derived date would require a reviewed rule with an identified legal basis.

## 2. Version immutability

- A `DocumentVersion` is created once and never updated in place.
- A correction creates a new version or an explicit correction event that points
  at the corrected version.
- `isCurrent` is a projection convenience, not proof of law.
- Provision text belongs to a version; editing historical text is prohibited.

## 3. Interval semantics (documented and tested)

- Effective intervals are **inclusive at the start, exclusive at the end**:
  `[effectiveFrom, effectiveTo)`.
- An event dated exactly on `effectiveFrom` applies.
- An event dated exactly on `effectiveTo` does not apply to that interval.
- A null `effectiveFrom` means "unknown start", not "beginning of time".
- A null `effectiveTo` means "no recorded end", not "still in force".
- Overlapping intervals are allowed in the data and reported as conflicts; they are
  not silently merged.
- Future-dated events are `prospective`; they do not affect an earlier as-of query.

## 4. As-of query contract

Input: document ID, optional provision identity, date, optional authorization check.

Output: `AuthorityProjection` with:

- `outcome` (`DETERMINED_WITH_REVIEWED_EVIDENCE`, `PARTIALLY_DETERMINED`,
  `UNKNOWN`, `CONFLICTED`, `INSUFFICIENT_EVIDENCE`, `UNAUTHORIZED`);
- `state` (or `UNKNOWN`);
- `asOf`;
- supporting assertion/review/evidence IDs;
- `conflicts`, `missing`;
- `explanation`;
- `abstained`.

Rules:

1. No reviewed assertion → not `DETERMINED_WITH_REVIEWED_EVIDENCE`.
2. Confirmed review without an effective date → `INSUFFICIENT_EVIDENCE` for a
   date query.
3. Confirmed review whose evidence is unavailable → `INSUFFICIENT_EVIDENCE`.
4. Two active reviews with different outcomes → `CONFLICTED`.
5. Superseded/revoked reviews are ignored as active conclusions but remain in
   history.
   5a. Only the confirmed `claimedEffectiveDate` gates an as-of result. Enactment or
   publication dates do not substitute for it, and the model does not infer an
   effectivity rule from them.
6. Authorization denial → `UNAUTHORIZED`, even when the legal data is complete.
7. The newest retrieved version is never selected as "the law in force".

## 5. Worked interval cases (synthetic)

Let assertion A claim `REPEAL` effective `2026-06-01`, confirmed, evidence
available:

| Query date   | Expected                                                            |
| ------------ | ------------------------------------------------------------------- |
| `2026-05-31` | state before repeal (or `IN_FORCE` if a confirmed enactment exists) |
| `2026-06-01` | repeal applies (inclusive start)                                    |
| `2026-06-02` | repeal applies                                                      |

Let assertion B claim `AMENDMENT` with no effective date, confirmed:

| Query    | Expected                                             |
| -------- | ---------------------------------------------------- |
| any date | `INSUFFICIENT_EVIDENCE` with missing `effectiveDate` |

Let A (repeal, 2026-06) and C (reinstatement, 2026-09) both confirmed:

| Query        | Expected                |
| ------------ | ----------------------- |
| `2026-07-01` | `REPEALED`              |
| `2026-09-01` | `IN_FORCE` (reinstated) |

Two confirmed but contradictory effectivity dates for the same amendment:

| Query    | Expected                          |
| -------- | --------------------------------- |
| any date | `CONFLICTED` with both review IDs |

## 6. Gaps and uncertainty

The model must be able to say:

- `MISSING_VERSION` — no version covers the date;
- `UNKNOWN_EFFECTIVE_DATE`;
- `EVIDENCE_UNAVAILABLE`;
- `MAPPING_UNCERTAIN` — provision continuity unresolved;
- `CONFLICTING_INTERVALS`;
- `NOT_AUTHORIZED`.

These are explanation codes in `missing`/`explanation`, not exceptions.

## 7. Acceptance

- Boundary tests pass at start, start−1, end−1, end.
- A null date never yields a definitive result.
- Overlaps produce `CONFLICTED`, not a merged interval.
- Future/unapplied changes are visible as such and do not affect earlier dates.
- A historical query after supersession still resolves the historical review state
  only if the model explicitly preserves it; otherwise it abstains.
