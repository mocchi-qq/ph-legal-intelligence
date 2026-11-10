# Citation and Support Classification

**Date:** 2026-11-10
**Implementation:** `packages/citation-engine/src/verifier.ts`
**Tests:** `tests/citations/citation-verification.test.ts`, `support-class.test.ts`

## 1. What changed since Gate 1

Gate 1 reported a single lexical support score. Gate 2 keeps the four layers and adds an explicit **support class**, so a direct quotation is no longer indistinguishable from a topical word match.

| Class                  | Meaning                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `DIRECT_QUOTE`         | The proposition (normalized, ≥25 chars) appears verbatim in the cited passage |
| `LEXICAL_ONLY`         | Operative-term coverage ≥0.80 but not a quotation                             |
| `NO_SUPPORT`           | Coverage below threshold                                                      |
| `INSUFFICIENT_CONTEXT` | No passage was resolved                                                       |
| `FULL_SUPPORT`         | Reviewed annotation: full support                                             |
| `PARTIAL_SUPPORT`      | Reviewed annotation: partial support                                          |
| `CONTRADICTED`         | Reviewed annotation: passage contradicts the proposition                      |

Every result also reports `supportMethod`: `lexical_proxy` or `technical_annotation`.

## 2. Honest boundary

- Without an annotation, support is still a **lexical proxy**, not semantic entailment. This is stated in the layer notes.
- `FULL_SUPPORT`/`PARTIAL_SUPPORT`/`CONTRADICTED` are only set when a label is supplied by an evaluation set. The verifier does not generate those labels.
- Only `FULL_SUPPORT` sets `propositionSupported = true`. `PARTIAL_SUPPORT` and `CONTRADICTED` do not.
- Annotations are **technical annotation, not legal validation**. No qualified Philippine legal review has occurred.

## 3. Layers retained

Identity, location (version-aware), support, temporal. Temporal fails closed when a provision is `REPEALED` and the repeal date is unknown.

## 4. Tested behaviour

- Direct quotation → `DIRECT_QUOTE`, supported, method `lexical_proxy`.
- High overlap / rewording → `LEXICAL_ONLY` or `NO_SUPPORT` (not treated as quotation).
- Unrelated proposition → `NO_SUPPORT`.
- No passage → `INSUFFICIENT_CONTEXT`.
- Supplied `FULL_SUPPORT` → supported, method `technical_annotation`, notes say "not legal validation".
- Supplied `CONTRADICTED` → not supported, class `CONTRADICTED`.
- Supplied `PARTIAL_SUPPORT` → not supported.

## 5. Not implemented

- Semantic entailment (NLI / model-based).
- Contradiction detection without an external label.
- Human-reviewed legal benchmark with qualified counsel.
- Real-corpus citation evaluation (no corpus).

## 6. Result

The reporting limitation is fixed: support is now classified rather than reduced to one score, and reviewed labels are clearly separated from the lexical proxy. Semantic entailment is still absent and is not claimed.

## 7. Real-passage result (owner-authorized pilot)

A citation to RA 12326 at a section containing "term of office" was verified:

| Layer         | Result                                        |
| ------------- | --------------------------------------------- |
| Identity      | true                                          |
| Location      | true (section-level after `SEC.` parsing fix) |
| Support       | true                                          |
| Temporal      | true                                          |
| Aggregate     | `VERIFIED`                                    |
| Support class | `LEXICAL_ONLY`                                |
| Method        | `lexical_proxy`                               |

The class is `LEXICAL_ONLY`, not `DIRECT_QUOTE`, because the proposition was a
truncated first sentence. It is **not** presented as semantic entailment. This is
one citation on one document, not a citation benchmark.
