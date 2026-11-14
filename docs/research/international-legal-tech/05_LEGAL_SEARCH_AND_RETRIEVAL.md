# 05 — Legal Search and Retrieval

**Research date:** 2026-11-14

## 1. Search methods actually documented

| Method                                     | Westlaw | Lexis | Vincent | Bloomberg | CoCounsel | CourtListener       | PH E-Library |
| ------------------------------------------ | ------- | ----- | ------- | --------- | --------- | ------------------- | ------------ |
| Exact title                                | V       | V     | P       | V         | P         | V                   | P            |
| Citation search                            | V       | V     | P       | P         | P         | V (lookup API)      | U            |
| Keyword                                    | V       | V     | V       | V         | P         | V                   | P            |
| Boolean / field operators                  | V       | V     | V       | V         | P         | V (advanced search) | U            |
| Natural-language question                  | V       | V     | V       | V         | V         | N                   | N            |
| Semantic / vector                          | P       | P     | V       | P         | V         | N                   | N            |
| Hybrid                                     | P       | P     | V       | U         | V         | N                   | N            |
| Metadata filters (court/date/jurisdiction) | V       | V     | V       | V         | V         | V                   | P            |
| Search within an authority                 | V       | V     | P       | P         | P         | V                   | U            |
| Related-authority discovery                | V       | V     | V       | P         | P         | V (graph)           | N            |

`P` where the capability exists but the exact retrieval mechanism is not publicly
documented. No platform publishes recall/precision figures, so no cross-platform
retrieval benchmark is possible from public evidence.

## 2. Retrieval quality: what can and cannot be claimed

- **No vendor publishes retrieval precision/recall.** Claims like "most
  comprehensive" or "precise results" are `COMPANY CLAIM`.
- **The only independent quality evidence is about hallucination, not IR.** The
  Stanford study (S09) measured answer/citation reliability, not Recall@k.
- **Duplicate and amended documents** are handled by editorial normalisation at
  Westlaw/Lexis and by version records at legislation.gov.uk; the mechanisms are
  not disclosed in enough detail to copy.
- **Negative/conflicting authority retrieval** is a citator function
  (KeyCite/Shepard's), not a search-ranking function. Open systems expose the
  citing graph but not the editorial judgement.

Therefore the project should **not** benchmark itself against competitor
retrieval numbers — there are none. It should publish its own retrieval
benchmark, as Gate 1 already does (Recall@k, passage accuracy, abstention).

## 3. Citation navigation: editorial vs automated

| Layer                              | What it needs                                            | Who demonstrates it                 | Can be automated?                     |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| Citation detection / normalisation | Parser + canonical forms                                 | CourtListener (S07), project Gate 3 | Yes, deterministically                |
| Existence check                    | Corpus lookup                                            | CourtListener (S07)                 | Yes                                   |
| Citing/cited graph                 | Parsed references + resolution                           | CourtListener (S07)                 | Yes, with error handling              |
| Positive/negative treatment        | Human editorial judgement or trained classifier + review | Westlaw, Lexis (S01, S02)           | Partly; not safely without review     |
| "Still good law"                   | Treatment + subsequent history                           | Westlaw KeyCite, Lexis Shepard's    | No — needs editorial/legal review     |
| Statute→case / case→statute        | Provision-level citation extraction                      | Publisher platforms                 | Partly; provision granularity is hard |
| Cross-reference between provisions | Structured statute model                                 | legislation.gov.uk (S08), SSO (S14) | Yes, if the statute is structured     |

**Design consequence.** The project can automate layers 1–3 and part of 6, and
must keep layer 4–5 explicitly `UNKNOWN`/editorial. Presenting an automated
"negative treatment" signal as authoritative would be the same overclaim the
Stanford study criticises.

## 4. Passage retrieval

The unit of retrieval matters more than the model:

- CourtListener returns opinions/dockets, not passages.
- Publisher AI products claim linked citations but do not document passage
  alignment.
- The project's Gate 1 benchmark already retrieves **chunks with provision
  labels**, which is a stronger unit for legal citation than a whole document.

Recommended retrieval unit for the Philippine product: **provision + version +
passage span**, with the enclosing document as metadata. That makes citation
location verifiable ("Art. 2, para. 1, version in force 2026-01-01, chars
120–480") rather than "somewhere in this case".

## 5. Ranking and evaluation lessons

1. **Hybrid beats single-mode in vendor claims, but is unproven publicly.** Use
   lexical + citation + metadata first; add vectors only when a benchmark shows
   gain on Philippine queries.
2. **Exact identifiers must bypass ranking.** The Gate 3 exact-identifier routing
   (RA/EO/PD/BP/CA/G.R. canonical aliases, set equality) is the right pattern;
   ranking should never be allowed to bury an exact citation match.
3. **Abstention is a feature.** If no provision supports the question, return
   "insufficient authority", not the nearest document.
4. **Evaluate on Philippine material, not translated US benchmarks.** Bar
   questions are a useful smoke test but not a retrieval benchmark.
5. **Publish denominators.** Competitors do not; this is a cheap credibility win.

## 6. What not to copy

- Do not copy "ask anything" as the primary interface. It hides retrieval failure.
- Do not copy a single relevance score. Legal users need _why_ a result matched
  (citation, provision, treatment).
- Do not copy editorial treatment labels without the editorial process behind
  them.
