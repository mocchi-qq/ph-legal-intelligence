# 10 — Synthetic Fixture Catalog

**Date:** 2026-11-14
**Rule:** every fixture is unmistakably fictional, carries a non-authoritative
notice, and exists only in test code. No real Philippine law number, case name or
text is used.

## 1. Namespace

| Prefix                 | Use                                   |
| ---------------------- | ------------------------------------- |
| `SYNTH-ACT-0001`       | synthetic statute A                   |
| `SYNTH-ACT-0002`       | synthetic amending statute B          |
| `SYNTH-CASE-0001`      | synthetic decision                    |
| `SYNTH-SEC-0001`       | synthetic provision (s.2 in v1)       |
| `SYNTH-SEC-0002`       | synthetic provision (s.2 in v2)       |
| `SYNTH-SEC-0003`       | synthetic provision (s.3 of ACT-0002) |
| `SYNTH-ACT-0002-v1`    | version                               |
| `synth-assert-*`       | effect assertion                      |
| `synth-evidence-*`     | evidence                              |
| `synth-review-*`       | substantive review                    |
| `synth-reviewer-*`     | reviewer identity                     |
| `synth-fixture-loader` | recordedBy                            |

Every fixture object carries:

```json
{
  "synthetic": true,
  "nonAuthoritative": true,
  "note": "Synthetic fixture. Not Philippine law. No legal effect."
}
```

## 2. Identity fixtures

| ID      | Case                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| F-ID-01 | One instrument, two artifacts (same identity key, different hashes) → one document |
| F-ID-02 | Same title, different numbers → two documents, no merge                            |
| F-ID-03 | Duplicate canonical key → `MULTIPLE_CANDIDATES`                                    |
| F-ID-04 | Alias `SYNTH Act One` → canonical `SYNTH-ACT-0001`                                 |
| F-ID-05 | Unsupported citation type → `UNSUPPORTED_TYPE`                                     |

## 3. Provision fixtures

| ID      | Case                                                    |
| ------- | ------------------------------------------------------- |
| F-PR-01 | s.2 identical across v1/v2 → mapping `SAME`             |
| F-PR-02 | s.2 → s.3 with continuity → `RENUMBERED`                |
| F-PR-03 | s.4 → s.4(a)+s.4(b) → `SPLIT`                           |
| F-PR-04 | s.5+s.6 → s.5 → `MERGED`                                |
| F-PR-05 | s.7 removed → `DELETED`                                 |
| F-PR-06 | s.7A inserted → `NEW`                                   |
| F-PR-07 | renumbering with changed text, unreviewed → `UNCERTAIN` |
| F-PR-08 | unrelated sections → `NONE`                             |
| F-PR-09 | same number, different document → no mapping            |

## 4. Version/temporal fixtures

| ID      | Case                                                                      |
| ------- | ------------------------------------------------------------------------- |
| F-VT-01 | v1 effective 2026-01-01, v2 effective 2026-07-01                          |
| F-VT-02 | prospective v3 effective 2027-01-01                                       |
| F-VT-03 | version with null effectiveFrom                                           |
| F-VT-04 | overlapping intervals v1 `[2026-01-01, 2026-08-01)`, v2 `[2026-06-01, …)` |
| F-VT-05 | missing publication date, known effectivity                               |
| F-VT-06 | conflicting claimed effectivity dates                                     |

## 5. Effects fixtures

| ID      | Case                                             | Expected projection                        |
| ------- | ------------------------------------------------ | ------------------------------------------ |
| F-EF-01 | simple amendment, unreviewed                     | `PARTIALLY_DETERMINED`                     |
| F-EF-02 | partial amendment, confirmed, evidence available | `AMENDED`/`PARTIALLY_AMENDED` after date   |
| F-EF-03 | repeal, confirmed                                | `REPEALED` on/after date                   |
| F-EF-04 | prospective effect                               | not applied before date                    |
| F-EF-05 | unapplied effect (state `PENDING_REVIEW`)        | not confirmed                              |
| F-EF-06 | rejected review                                  | `UNKNOWN`, no confirmed effect             |
| F-EF-07 | two confirmed conflicting reviews                | `CONFLICTED`                               |
| F-EF-08 | superseded review                                | prior review inactive                      |
| F-EF-09 | revoked review                                   | inactive                                   |
| F-EF-10 | missing evidence                                 | `INSUFFICIENT_EVIDENCE`                    |
| F-EF-11 | evidence `UNAVAILABLE`                           | `INSUFFICIENT_EVIDENCE`                    |
| F-EF-12 | unresolved scope                                 | no confirmed state for out-of-scope target |
| F-EF-13 | confirmed with conditions, conditions unmet      | `INSUFFICIENT_EVIDENCE`/conditional        |
| F-EF-14 | suspension + reinstatement                       | `SUSPENDED` then `IN_FORCE`                |
| F-EF-15 | judicial invalidation, confirmed                 | `INVALIDATED`                              |
| F-EF-16 | duplicate assertion id                           | rejected                                   |

## 6. Citation fixtures

| ID      | Case                             | Expected                        |
| ------- | -------------------------------- | ------------------------------- |
| F-CI-01 | `SYNTH-ACT-0001`                 | `EXACT`                         |
| F-CI-02 | `SYNTH Act One` alias            | `ALIAS`                         |
| F-CI-03 | `SYNTH-GR-0001` / synthetic G.R. | `EXACT`                         |
| F-CI-04 | `SYNTH-ACT-0001, s. 2`           | `EXACT` + provision             |
| F-CI-05 | two documents with same alias    | `MULTIPLE_CANDIDATES`           |
| F-CI-06 | `SYNTH-ACT-00` partial           | `PARTIAL`/`MULTIPLE_CANDIDATES` |
| F-CI-07 | malformed                        | `INVALID_FORMAT`                |
| F-CI-08 | unsupported type                 | `UNSUPPORTED_TYPE`              |
| F-CI-09 | bare `Section 2` no context      | `PARTIAL`                       |
| F-CI-10 | ambiguous provision label        | `MULTIPLE_CANDIDATES`           |

## 7. Authorization fixtures

| ID      | Case                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| F-AU-01 | authorization denies → projection `UNAUTHORIZED` even with confirmed review       |
| F-AU-02 | authorization allows → projection proceeds                                        |
| F-AU-03 | no authorization check supplied → `NOT_CHECKED` recorded, not silently authorized |

## 8. Isolation rules

- Fixtures live under `tests/authority/` and are imported only by tests.
- No fixture is written to `legal-data/` or any production path.
- No fixture id resembles a real RA/EO/G.R. number.
- Loading a fixture never writes a counsel record or an authorization cell.
