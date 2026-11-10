# Grounded Answering and Adversarial Validation

**Date:** 2026-11-10
**Tests:** `tests/citations/grounding.test.ts`, `tests/security/gate1-security.test.ts`, `tests/legal-data/transport.test.ts`

## 1. Tightened verification rule

An answer now uses only evidence that is both:

1. aggregate `VERIFIED`, and
2. not `LEXICAL_ONLY`.

Lexical-only evidence is excluded and the limitation is named. A new test creates a `VERIFIED` + `LEXICAL_ONLY` result and asserts the answer abstains. This directly addresses the Gate 2 limitation.

## 2. Behaviours tested

| Behaviour                                                       | Test            |
| --------------------------------------------------------------- | --------------- |
| Only verified citations used                                    | grounding tests |
| No verified citation → abstain                                  | grounding tests |
| Partially verified citation excluded, failed layer named        | grounding tests |
| Lexical-only excluded even if `VERIFIED`                        | Gate 3 test     |
| Instruction-like document text treated as data and stripped     | grounding tests |
| Fact-specific question → framework only, missing facts declared | grounding tests |
| Conflicting authorities not declared controlling                | grounding tests |
| Unverified citations never presented as verified                | grounding tests |

## 3. Adversarial cases retained

- Prompt injection inside a document paragraph.
- Nonexistent docket / statute (exact-only retrieval).
- Topic-only passage that does not support the proposition.
- Old proposition against amended text.
- Repealed provision with a known date (Gate 1 synthetic).
- Missing relevant date.
- Out-of-corpus and Filipino queries (retrieval abstention).
- Private/local URL and DNS-private redirect (transport).
- Corrupt and oversized PDF.

## 4. Not tested

- A generative model constrained to the same evidence rules (no model call exists).
- Multi-turn conversations and fact elicitation.
- Conflicting judicial decisions from a real corpus (only synthetic).
- Legal sufficiency of any answer.

## 5. Result

The answering layer is fail-closed for the implemented evidence rules. It is not a legal advice system and does not claim legal correctness.
