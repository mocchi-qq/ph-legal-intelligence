# 06 — AI Legal Research Comparison

**Research date:** 2026-11-14

## 1. The independent evidence

The only preregistered, peer-reviewed-style evaluation found in this research is
Magesh, Surani, Dahl, Suzgun, Manning & Ho, _Hallucination-Free? Assessing the
Reliability of Leading AI Legal Research Tools_ (Stanford RegLab, arXiv, May 2024;
S09).

Findings relevant here:

- Lexis+ AI, Westlaw AI-Assisted Research and Ask Practical Law AI each
  hallucinated **between 17% and 33%** of the time on the tested queries.
- Hallucinations were reduced relative to GPT-4, but vendor claims of
  "hallucination-free" or "eliminating" hallucinations were **overstated**.
- The study distinguishes hallucination types, including misgrounded citations
  and incomplete answers.

This does not measure the 2026 product versions, and it does not compare Vincent,
Harvey, CoCounsel or Anycase. It does establish the burden of proof: **any claim
of reliable legal AI must be independently tested, and citation existence is not
citation support.**

## 2. Comparison on documented behaviour

| Dimension                       | Westlaw AAR / Advantage | Lexis+ Protégé                 | Vincent               | CoCounsel Legal                    | Harvey                 | Anycase            |
| ------------------------------- | ----------------------- | ------------------------------ | --------------------- | ---------------------------------- | ---------------------- | ------------------ |
| Grounding source                | Westlaw content         | LexisNexis + org docs          | Clio Library 1B+ docs | Westlaw + Practical Law + org docs | Partner DBs + org docs | PH corpus (vendor) |
| Linked citations                | V                       | V                              | V                     | V                                  | P                      | V (vendor)         |
| Citation verification of output | P (KeyCite available)   | **V** (Shepard's Verify)       | P                     | P                                  | U                      | U                  |
| Passage-level support           | P                       | P                              | P                     | P                                  | U                      | P                  |
| Distinguishes primary/secondary | V (content types)       | V                              | V                     | V                                  | P                      | U                  |
| Flags unsupported statements    | P (Quick Check)         | **V** (Shepard's Verify claim) | U                     | P                                  | U                      | U                  |
| Temporal/version awareness      | V (version compare)     | P                              | P                     | P                                  | U                      | U                  |
| Uncertainty communication       | U                       | U                              | U                     | P ("visible reasoning")            | U                      | U                  |
| Human review in workflow        | V                       | V                              | V                     | V                                  | V                      | P                  |
| Independent evaluation          | S09 (2022–23 versions)  | S09                            | none found            | none found                         | none found             | none found         |

`U` means the vendor does not document the behaviour; it is not proof of absence.

## 3. What is genuinely useful

1. **Retrieval-augmented answers over a licensed corpus** — reduces hallucination
   relative to a bare model (S09), but does not eliminate it.
2. **Citation verification applied to generated text** — Lexis's Shepard's Verify
   is the clearest productisation: check every citation in the answer and flag
   unsupported statements. This is directly analogous to the project's Gate 3
   citation verifier.
3. **Visible reasoning / step plans** — CoCounsel shows the plan and each step, so
   a lawyer can interrupt at the right point. Useful UX, not a correctness proof.
4. **Passage-linked citations** — lets the user jump to the supporting text;
   without passage alignment the link only proves the document exists.
5. **Narrow, task-specific AI** — Bloomberg's summarise/classify/compare tools
   fail more safely than open-ended "ask anything".
6. **Document-grounded work** — tabular review (CoCounsel 10,000 docs × 100
   questions) and Vault-style document sets are real workflow value.

## 4. What is mostly marketing

- "Hallucination-free" (contradicted by S09).
- "Senior associate-level reasoning" (no public benchmark).
- "Guaranteed accuracy" / "verified answers" (verification is of citation
  existence/treatment, not of legal correctness).
- Productivity percentages from vendor-commissioned studies (38%, 33%, 344% ROI).
- "Trained on legal data" without disclosing data, method or evaluation.
- "Most comprehensive" corpus claims without an auditable count.

## 5. The three distinctions the product must keep

1. **Citation exists ≠ citation is correct.** A citation can resolve to a real
   case that does not support the sentence.
2. **Retrieval relevance ≠ legal entailment.** A passage can be topically related
   and still not entail the proposition.
3. **Mentions ≠ supports.** A case can mention a doctrine while rejecting it.

The Gate 3 four-layer citation verifier (identity → location → support →
temporal) maps exactly onto these distinctions. That is the project's strongest
AI differentiator, and it is already built.

## 6. Design rules derived from the evidence

1. **No answer without verifiable citations.** Abstain when verification fails.
2. **Show the source passage and its version**, not just the document title.
3. **Separate "found", "relevant", "supports", "in force"** in the UI and API.
4. **Label treatment as editorial or unknown.** Never infer "overruled" from text
   similarity.
5. **Record the model, prompt version, retrieval set and verifier result** for
   every answer (auditability).
6. **Evaluate on Philippine questions with published denominators**; do not cite
   vendor benchmarks.
7. **Keep a human in the loop** for any answer used in a filing.

## 7. What not to build

- A general chatbot with a legal skin.
- A "confidence score" without a defined, tested meaning.
- An answer that hides its retrieval set.
- A summariser presented as legal analysis.
- Any feature that requires a corpus the project is not authorized to hold.

## 8. Uncertainty statement

No public evidence establishes that any product is reliable enough to replace
professional verification. The project should state this in its own product
documentation rather than claim otherwise.
