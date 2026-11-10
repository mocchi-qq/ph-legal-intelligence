# Semantic Citation Evaluation (Technical)

**Date:** 2026-11-10
**Annotations:** `citation-annotations.json` (7 pairs, RA 12326)
**Results:** `citation-results.json`
**Reviewer:** technical evidence assessment by the engineer. **Not a legal opinion.**

## 1. Why this is not semantic entailment

Gate 2 returned `LEXICAL_ONLY` for a real citation. Gate 3 does not upgrade that to semantic support. No entailment model or LLM verifier is implemented or evaluated.

What was done:

1. Seven proposition–citation pairs were authored by reading the source.
2. Each was labelled `FULL_SUPPORT`, `PARTIAL_SUPPORT`, `NO_SUPPORT`, `CONTRADICTED`, or `INSUFFICIENT_CONTEXT`.
3. The existing lexical verifier was run **without** labels, and again **with** the labels.
4. The two paths were compared.

## 2. Results

| Measure                                     | Result |
| ------------------------------------------- | ------ |
| Pairs                                       | 7      |
| Reviewed-label agreement (annotation path)  | 7/7    |
| Lexical false positives against labels      | 0/7    |
| Contradictions detected by lexical proxy    | 0      |
| Direct quotations detected by lexical proxy | 0      |
| Documents with verified effectivity date    | 0      |

Lexical classes observed: one `LEXICAL_ONLY` (supported), five `NO_SUPPORT`, one `INSUFFICIENT_CONTEXT`.

## 3. What the numbers mean

- The **annotation path** reproduces the reviewed labels because the label is supplied. That proves the reporting mechanism, not automatic understanding.
- The **lexical proxy** avoided false positives on these seven pairs, but it cannot detect contradiction or partial support and produced no `DIRECT_QUOTE` class. Zero contradictions detected is a capability gap, not a success.
- Temporal validity is not evidence-based: all four pilot documents have unknown effectivity dates.

## 4. Grounding policy tightened

`composeGroundedAnswer` now excludes any citation whose `supportClass` is `LEXICAL_ONLY`, even when the aggregate status is `VERIFIED`. A test asserts that such evidence produces abstention. This prevents lexical overlap from being presented as verified support.

## 5. Not implemented / not claimed

- Semantic entailment or NLI.
- Contradiction detection without a human label.
- A qualified legal review of any pair.
- Multi-annotator adjudication (only one technical reviewer).
- A dataset large enough for precision/recall claims.

## 6. Consequence

Citation support remains a **lexical proxy plus optional reviewed labels**. The platform must continue to say so, and must abstain where support is only lexical.
