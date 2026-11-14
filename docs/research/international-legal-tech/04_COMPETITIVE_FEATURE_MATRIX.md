# 04 — Competitive Feature Matrix

**Research date:** 2026-11-14
**Status key:** `V` documented in a public source · `P` partially documented / mechanism not disclosed · `N` NOT FOUND · `NA` NOT APPLICABLE · `U` UNKNOWN.
**Column key:** WL = Westlaw (S01) · LN = Lexis+ with Protégé (S02) · VX = Vincent (S03) · BL = Bloomberg Law (S04) · HV = Harvey (S05) · CC = CoCounsel Legal (S06) · CL = CourtListener (S07) · LG = legislation.gov.uk (S08) · AC = Anycase (S13).

Machine-readable: `feature-matrix.csv` and `feature-matrix.json`.

**Scale note:** `V` means "documented in a public source", not "the mechanism works". Vendor AI mechanisms are often undisclosed; see `01_RESEARCH_METHODOLOGY.md` §6 and §8. This is documentation coverage, not a quality ranking.

## 1. Matrix

| Capability                        | WL  | LN  | VX  | BL  | HV  | CC  | CL  | LG  | AC  | Philippine opportunity                                                                                 |
| --------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ------------------------------------------------------------------------------------------------------ |
| Exact citation search             | V   | V   | P   | P   | U   | P   | V   | V   | U   | Build: canonical PH citation parser; verify Anycase corpus counts (140k-160k) before using as baseline |
| Boolean search                    | V   | V   | V   | V   | U   | P   | V   | P   | U   | Build (baseline)                                                                                       |
| Semantic search                   | P   | P   | P   | P   | P   | P   | N   | N   | P   | Build after metadata exists                                                                            |
| Hybrid retrieval                  | P   | P   | P   | U   | P   | P   | N   | N   | P   | Build: lexical + vector + rerank, benchmarked                                                          |
| Case relationships (citing/cited) | V   | V   | V   | P   | U   | P   | V   | NA  | U   | Build: citation graph                                                                                  |
| Citation treatment (editorial)    | V   | V   | U   | U   | U   | P   | P   | NA  | N   | Hard: editorial or ML + named review                                                                   |
| Statute versioning                | V   | V   | P   | P   | U   | P   | NA  | V   | U   | Build: point-in-time versions                                                                          |
| Amendment tracking                | V   | V   | P   | P   | U   | P   | NA  | V   | U   | Build: effects metadata                                                                                |
| Historical legal status           | V   | V   | P   | P   | U   | P   | NA  | V   | U   | Build: as-of queries                                                                                   |
| AI legal Q&A                      | P   | P   | P   | P   | P   | P   | N   | N   | P   | Build, gated by citations                                                                              |
| Passage-level citations           | U   | U   | U   | U   | U   | U   | NA  | NA  | U   | Differentiator if done properly                                                                        |
| AI-output citation verification   | P   | V   | P   | U   | U   | P   | N   | NA  | U   | Build: exists + supports + current                                                                     |
| Conflicting authority detection   | V   | P   | U   | U   | U   | P   | N   | NA  | N   | Build with explicit conflict state                                                                     |
| Document summarisation            | P   | P   | P   | P   | P   | P   | N   | N   | P   | Later                                                                                                  |
| Research workspaces               | V   | V   | V   | V   | V   | V   | P   | N   | P   | Later                                                                                                  |
| Alerts / updates                  | V   | V   | U   | V   | U   | U   | V   | V   | U   | Build: source-change alerts                                                                            |
| Source provenance                 | U   | U   | U   | U   | U   | U   | V   | V   | U   | Differentiator: per-field lineage                                                                      |
| Cross-jurisdiction search         | V   | V   | V   | P   | V   | V   | N   | NA  | N   | Defer                                                                                                  |

`NA` for CourtListener/legislation.gov.uk means the capability is outside that product's remit, not that it is absent by accident.

## 2. What the matrix shows

1. **No column is complete.** Even Westlaw and Lexis have `P`/`U` on passage-level granularity; open systems lack citators; regional AI lacks versioning.
2. **The Philippine opportunity is not a missing feature; it is a missing guarantee.** Every competitor has some form of "search + answer". None guarantees, per statement, that the cited authority exists, supports the proposition, and was in force on the relevant date.
3. **The hardest row is treatment.** Positive/negative treatment is editorial at Westlaw and Lexis, graph-only at CourtListener, and absent locally. Any claim of treatment in the Philippine product must be either (a) explicitly editorial with named reviewers, or (b) labelled `UNKNOWN`.
4. **Mechanism disclosure is rare.** AI Q&A, passage alignment, provenance and summarisation are marked `P` or `U` for most vendors because the mechanism is not public — not because the feature is absent.

## 3. Feature-status distribution

| Platform           | V   | P   | N   | NA  | U   |
| ------------------ | --- | --- | --- | --- | --- |
| Westlaw            | 11  | 5   | 0   | 0   | 2   |
| Lexis              | 11  | 5   | 0   | 0   | 2   |
| Vincent            | 4   | 9   | 0   | 0   | 5   |
| Bloomberg          | 3   | 9   | 0   | 0   | 6   |
| Harvey             | 2   | 4   | 0   | 0   | 12  |
| CoCounsel          | 2   | 13  | 0   | 0   | 3   |
| CourtListener      | 5   | 2   | 7   | 4   | 0   |
| legislation.gov.uk | 6   | 1   | 5   | 6   | 0   |
| Anycase            | 0   | 5   | 3   | 0   | 10  |

These counts are **coverage of public documentation**, not product quality. A high `U` count means the vendor does not document the mechanism publicly, not that the feature is missing.

## 4. Sources per row

- Citation search: S01, S02, S07, S08.
- Citators/treatment: S01 (KeyCite), S02 (Shepard's), S07 (graph APIs).
- Versioning/effects: S01 (version comparison), S08 (point-in-time + effects).
- AI Q&A + citations: S01–S06, S13.
- AI-output citation verification: S02 (Shepard's Verify), S07 (citation lookup API). S09 is about hallucination rates and is not a test of either verifier.
- Passage-level: S01, S02, S03, S06 (vendor claims of linked citations only).
- Provenance: S08 (stable IDs + effects), S07 (source-linked opinions).
