# Citation Verification Report

**Date:** 2026-11-10
**Implementation:** `packages/citation-engine/src/verifier.ts`
**Grounding:** `packages/ai-orchestrator/src/grounding.ts`
**Tests:** `tests/citations/citation-verification.test.ts` (10), `tests/citations/grounding.test.ts` (6)

## 1. Four independent layers

| Layer    | Check                                                    | Failure example that was tested                                 |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| Identity | Document exists and identifier matches                   | `G.R. No. 000000` → `FAILED / INVALID`                          |
| Location | Cited provision/paragraph exists on the version in force | `Section 99` → location false                                   |
| Support  | Passage contains the operative terms of the proposition  | Section 1 cited for a penalty proposition → support false       |
| Temporal | Authority in force on the relevant date                  | Section 4 cited as of 2022 after a 2021 repeal → temporal false |

`VERIFIED` is never a blanket status. Results carry explicit states (`VERIFIED_IDENTITY`, `VERIFIED_LOCATION`, `VERIFIED_SUPPORT`, `VERIFIED_TEMPORAL_STATUS`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `INVALID`) and per-layer evidence.

## 2. Support verification is a proxy, and is labelled as one

Support is decided by deterministic coverage of the proposition's operative terms in the cited passage (threshold 0.80), after instruction-like sentences are stripped. It is **not** semantic entailment. Its limitations:

- A paraphrase with different vocabulary will fail even if it is legally equivalent.
- A passage that copies the words but changes the meaning by context would pass.
- The engine reports `support_method` and a per-layer note so this is never presented as a semantic check.

## 3. Version-aware location

Location lookup selects the document version in force on the relevant date. Before this was implemented, a citation to "Section 2" as of 2021 resolved to the 2019 text. The current implementation resolves to the 2021 version, and the old proposition correctly fails support against amended text.

## 4. Grounding

`composeGroundedAnswer` assembles an answer only from citations with status `VERIFIED`.

- No verified citation → abstains with "Insufficient verified authority".
- Partially verified citations are excluded and the failed layer is named.
- Instruction-like text in a document is stripped from the answer and reported as data.
- Fact-specific questions ("my client…") are answered with the legal framework only, with missing facts declared.
- No model call is made. Whether a generative model can be constrained to the same standard is **unverified**.

## 5. Measured results (synthetic corpus, 10 citation cases)

| Layer    | Agreement with expected |
| -------- | ----------------------- |
| Identity | 10/10                   |
| Location | 10/10                   |
| Support  | 10/10                   |
| Temporal | 10/10                   |

These are agreement rates against hand-authored expectations on fictional documents. They are not a legal-accuracy measurement.

## 6. Mandatory fail-closed behaviour

Tested: nonexistent docket, nonexistent section, topic-only passage, outdated proposition against amended text, repealed provision, missing relevant date, and instruction-like proposition. In each the engine refuses or degrades to `PARTIALLY_VERIFIED`; none is presented as fully verified.
