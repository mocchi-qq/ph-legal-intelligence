# 13 — Independent Review

**Date:** 2026-11-14
**Reviewers:** three read-only passes — legal domain model (A), data architecture
and integrity (B), citation/retrieval architecture (C). All inspected the actual
files; none edited the repository.

## 1. Summary by severity

| Review                 | Blockers | Majors | Minors/nits | Disposition                                                          |
| ---------------------- | -------- | ------ | ----------- | -------------------------------------------------------------------- |
| A — legal domain       | 0        | 0      | 5           | Fixed or documented; no legal-conclusion defect                      |
| B — data integrity     | 2        | 10     | 10          | Both blockers fixed; 8 majors fixed; 2 documented                    |
| C — citation/retrieval | 4        | 10     | 7           | All 4 blockers fixed or docs corrected; 8 majors fixed; 2 documented |

No reviewer found a path that turns an _unreviewed_ assertion into a confirmed
effect, or a path that uses source authorization as a legal-effect review.

## 2. Review A — legal domain model

| ID  | Severity | Finding                                                          | Disposition                                                                              |
| --- | -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A1  | MINOR    | Multiple applied effects: only the last state is projected       | **DOCUMENTED** — `06 §5.1`: state is the last applied effect; history is in `assertions` |
| A2  | MINOR    | `versionId` collapses to null with multiple versions             | **DOCUMENTED** — callers use assertion/evidence IDs                                      |
| A3  | MINOR    | Synthetic review notes omitted the "not real counsel" disclaimer | **FIXED** — all authority fixtures updated                                               |
| A4  | NIT      | `claimedDate` is not used to gate application                    | **DOCUMENTED** — only `claimedEffectiveDate` gates; reviewer owns the ordering           |
| A5  | NIT      | Null-date sort order is implicit                                 | **DOCUMENTED** in `06`                                                                   |

Clean: assertion/review separation, authorization separation, UNKNOWN/CONFLICTED
preservation, no text/similarity inference, explicit provision mappings, distinct
dates, no synthetic-as-counsel claim.

## 3. Review B — data architecture and integrity

| ID  | Severity | Finding                                                                                           | Disposition                                                                                         |
| --- | -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| B1  | BLOCKER  | `INSERT OR REPLACE` bypasses append-only triggers (SQLite deletes without firing delete triggers) | **FIXED** — `no_replace` trigger on all 7 tables; tested                                            |
| B2  | BLOCKER  | A `REVOKED` superseding review leaves the prior review active                                     | **FIXED** — supersession deactivates unless the superseding row is `SUPERSEDED`; tested             |
| B3  | MAJOR    | Evidence not bound to its assertion; review `evidenceRefs` ignored                                | **FIXED** — ownership + availability checked per ref; tests                                         |
| B4  | MAJOR    | Conflicting-date check grouped by effect type only, so two different provisions conflict          | **FIXED** — key includes provision identity/scope; test extended                                    |
| B5  | MAJOR    | Assertion supersession stored but not consumed                                                    | **FIXED** — superseded assertions excluded; correction test                                         |
| B6  | MAJOR    | Date validation accepted 2026-02-30 and timestamps in date fields                                 | **FIXED** — SQL GLOB + `date(x) IS x`; JS round-trip check; hardening tests                         |
| B7  | MAJOR    | Review dedupe key omitted outcome, blocking corrections                                           | **FIXED** — outcome included; correction test                                                       |
| B8  | MAJOR    | Mapping review frozen by UNIQUE + append-only                                                     | **DOCUMENTED** — mapping review model deferred; projection does not consume mappings                |
| B9  | MAJOR    | Cross-entity document/version references unchecked                                                | **FIXED** — assertion/mapping/evidence ownership checks; tests                                      |
| B10 | MAJOR    | No writer adapter and no deterministic ledger IDs                                                 | **DOCUMENTED** — D1 adapter deferred; ids caller-supplied                                           |
| B11 | MAJOR    | Projection could return a version already ended                                                   | **FIXED** — version interval checked; `VERSION_NOT_IN_EFFECT`                                       |
| B12 | MAJOR    | Tests asserted trigger existence, not behaviour                                                   | **PARTIALLY FIXED** — no-replace/date/FK/CHECK tests added; some tables still only existence-tested |

Minor SQL/doc inconsistencies (index, naming, trigger counts, duplicated test
suites) were corrected or recorded in `09`/`14`.

## 4. Review C — citation and retrieval

| ID      | Severity  | Finding                                                                   | Disposition                                                                                                        |
| ------- | --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| C1      | BLOCKER   | Doc 08 claimed layer 4 was wired; it is not                               | **FIXED** — doc 08 rewritten as NOT IMPLEMENTED; 11/14 align                                                       |
| C2      | BLOCKER   | Parser fabricated "RA 5" from "para 5"                                    | **FIXED** — word boundaries on all instrument patterns; tested                                                     |
| C3      | BLOCKER   | Verifier layer 1 picked the first ambiguous document                      | **FIXED** — all matches collected; ambiguity fails identity                                                        |
| C4      | BLOCKER   | Status contract claimed every state reachable/tested                      | **FIXED** — doc narrowed; parser/NO_MATCH tests added; `UNCERTAIN` marked reserved                                 |
| C5      | MAJOR     | Composite pinpoints dropped or attached to wrong instrument               | **FIXED** — global provision scan; `multiple_instruments`; subdivision; tests                                      |
| C6      | MAJOR     | `normalizeLabel` conflated `2(a)` and `2A`                                | **FIXED** — separators preserved                                                                                   |
| C7      | MAJOR     | Label regex truncated `2.1`/`2-A`                                         | **FIXED** — extended grammar                                                                                       |
| C8      | MAJOR     | Canonical keys used `G.R.:` instead of `GR:`; date suffix unresolved      | **FIXED** — canonical kind map; date stripped into `year`; tests                                                   |
| C9      | MAJOR     | Bare-number identity key was instrument-blind                             | **FIXED** — removed; `RA 12` no longer matches `PD:12`                                                             |
| C10     | MAJOR     | SYNTH-* shortcut in production parser                                     | **REDUCED** — confidence lowered to partial; composites handled; still in parser (test-only convention documented) |
| C11     | MAJOR     | Layer 2 accepted a passage from another document                          | **FIXED** — ownership check                                                                                        |
| C12     | MAJOR     | Version selection fell back to any/last version                           | **FIXED** — dated path requires exactly one covering version                                                       |
| C13     | MAJOR     | Layer 4 ignored `legalStatus`                                             | **FIXED** — repealed/expired/not-yet-effective fail closed                                                         |
| C14     | MAJOR     | Resolver/verifier label matching disagreed                                | **FIXED** — shared normalization behaviour; tests                                                                  |
| C15–C21 | MINOR/NIT | Doc/code drift, citationId hash, negation, provenance, retrieval contract | Partially fixed; lexicon/negation and shared-module extraction recorded as limitations                             |

## 5. Remediation verification

- Authority + citation suites: **123 tests passed** (9 files).
- Blockers were re-tested after fixes:
  - `INSERT OR REPLACE` rejected on all seven tables;
  - revoked supersession deactivates the prior review;
  - "para 5" is unsupported, not a Republic Act;
  - ambiguous identity fails;
  - doc 08 no longer claims wiring.
- Full suite and build results are in `11`.

## 6. Remaining reviewer-identified risk (not suppressed)

1. Mapping review cannot be corrected without a design change (B8).
2. No D1 writer adapter or deterministic ledger IDs (B10).
3. Layer 4 integration remains a contract, not code (C1).
4. The support proxy is negation-blind and is not entailment (C17).
5. Test coverage is strong on the new core but not exhaustive across every SQL
   constraint (B12).
6. The SYNTH-* convention still lives in the parser (C10).

These are recorded in `14` and are the basis for the verdict's limitation.
