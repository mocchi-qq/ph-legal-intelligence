# 03 — Independent Review

**Date:** 2026-11-17
**Review:** one read-only pass from the other lane, over the authorization phase, the
run records, the new tests, the fixture updates and the rewritten Gate 4 test.

## Findings and disposition

| #   | Severity | Finding                                                                                                                                                                 | Disposition                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CRITICAL | `IDENTITY_AMBIGUOUS` and `DUPLICATE` return before the four activity checks, so a fixture reaching either is never authorized.                                          | **REJECTED — the ordering is the other way round.** The authorization phase is `// 1.` at `pipeline.ts:172`; `// 2. Identity resolution` is at `:288`. Both early outcomes are downstream of the checks and carry the decision refs. The reviewer read line numbers from a stale listing.                                                                                                                          |
| 2   | HIGH     | A run refused before authorization should record `authorizationDecisionRefs: []` rather than `null`, to show the check was attempted.                                   | **REJECTED.** An empty list is how the old code said "checked, nothing found" when nothing had been checked — the exact smell this gate removes. `null` means "no decision was consulted", the plan's table says so, and the test asserts it. On success the four references are recorded.                                                                                                                         |
| 3   | HIGH     | A caller cannot narrow the accepted bases for a fixture, so the "one code path" claim is overstated.                                                                    | **REJECTED as proposed.** The suggested filter is a no-op on a one-element set; a fixture has exactly one admissible basis. Conditional constraints were never removed: `satisfiedAuthorizationConditions` still reaches the registry check and is honoured per activity.                                                                                                                                          |
| 4   | MEDIUM   | `pipeline.test.ts` keeps `allowLegacySourceGate: true`, implying the legacy gate works for fixtures.                                                                    | **ACCEPTED as no change.** The shared `OPTS` in that file is also used by its non-synthetic refusal tests, which need the opt-in. The synthetic path never reaches the legacy branch; the option is inert for fixtures by construction.                                                                                                                                                                            |
| 5   | MEDIUM   | The Gate 15 rehearsal ingests a non-synthetic artifact with `acceptedAuthorizationBases: ["SYNTHETIC_FIXTURE"]`, so a real artifact is authorized by the fixture basis. | **FIXED, and the fix went further than the finding.** The pipeline now refuses a non-synthetic artifact that names the fixture basis (`synthetic_fixture_basis_not_allowed`), and all four end-to-end chains were switched to honest fixtures — `synthetic: true` with `synthetic://` locators — keeping the fixture decisions they already register. The reviewer was right that the plan and the code disagreed. |
| 6   | LOW      | `allowSyntheticIndex` authorizes any activity, including `citation_display`, if reused.                                                                                 | **REJECTED.** It is a benchmark helper documented as such, used only by index-building tests; the real adapter's denials and activity mismatches are tested in `tests/retrieval/gate14-index-authorization.test.ts`. Replacing a documented test double with a narrower one would add surface without changing what is verified.                                                                                   |
| 7   | LOW      | The plan claims a synthetic run's audit "names the four decisions", which is not true of runs refused before authorization.                                             | **FIXED.** The plan now separates a successful run (four references), a run refused before authorization (`null`, not an empty list) and the early outcomes.                                                                                                                                                                                                                                                       |
| 8   | LOW      | A non-synthetic artifact with a `synthetic://` URL is accepted, so the locator and the flag can contradict each other silently.                                         | **FIXED.** `synthetic_locator_without_synthetic_flag` refuses it. The locator is a provenance claim; the two fields have to agree.                                                                                                                                                                                                                                                                                 |

## What the review changed

Two production refusals (`synthetic_locator_without_synthetic_flag`,
`synthetic_fixture_basis_not_allowed`), the four chains reflagged as fixtures, four new
refusal tests, and one plan paragraph corrected. No check was weakened and no fixture
was given an authorization it should not have.

## What it did not change

The finding graded CRITICAL was wrong, and fixing it would have moved the activity
checks ahead of the MIME and identity validation — reordering a gate that already runs
first. It is recorded as rejected, with the line numbers, rather than quietly
"addressed".

## Clean areas named by the reviewer

- basis locking between fixtures and real artifacts, in both directions;
- the rewritten Gate 4 test still proves the original point while asserting the new
  rule;
- Gate 1 security still refuses `source_not_authorized` and
  `synthetic_flag_without_synthetic_locator` for the right artifacts;
- a fixture decision cannot leak into counsel projection or authority projection, and
  the search index defaults to no decision for a real source;
- no real document, no counsel determination, no migration, no push.
