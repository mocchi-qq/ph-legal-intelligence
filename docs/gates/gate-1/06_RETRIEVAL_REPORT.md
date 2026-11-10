# Retrieval Report

**Date:** 2026-11-10
**Implementation:** `packages/legal-search/src/retrieve.ts`
**Tests:** `tests/retrieval/retrieval.test.ts` (12 passing)

## 1. Implemented signals

1. **Exact identifier matching** — normalized comparison against docket number, citation text and identity key.
2. **Lexical retrieval** — TF-IDF cosine over chunk tokens.
3. **Metadata filtering** — document type, court/agency, jurisdiction, verification status, date range.
4. **Point-in-time filtering** — version effective range against `asOfDate`.
5. **Reciprocal rank fusion** — exact and lexical lists fused with k=60.

## 2. Not implemented

- **Semantic / vector retrieval: NOT IMPLEMENTED.**
- **Cross-encoder reranking: NOT IMPLEMENTED.**

These are reported as absent. The benchmark does not award them credit, and a paraphrase test confirms the system does not behave as if embeddings existed: a query sharing no content terms returns no results.

## 3. Measured results (synthetic corpus)

| Metric                              | Result     |
| ----------------------------------- | ---------- |
| Exact identifier accuracy           | 4/4 (100%) |
| Recall@5                            | 8/8 (100%) |
| Recall@10                           | 8/8 (100%) |
| Passage retrieval accuracy          | 3/3 (100%) |
| Negative cases (no expected result) | 3/3 (100%) |

Denominators are small by design. These numbers do **not** generalize to a real corpus.

## 4. Identifier safety

An identifier-shaped query (`G.R. No. …`, `Act No. …`, `Executive Order …`) is exact-only. If nothing matches, the system returns no result rather than a fuzzy neighbour. This was verified for a nonexistent G.R. number and a nonexistent statute. Returning a plausible neighbour would manufacture an authority.

## 5. Relevance separation

Document relevance and passage relevance are distinct. The retrieval result is always a chunk with a provision label; a document being relevant does not imply any particular passage supports the question. A test asserts the top penalty-related passage is not the general-obligation passage of the same document.

## 6. Authority handling

Retrieval does not rank by a universal "Supreme Court wins" rule. It returns metadata (court, authority level, legal status, verification status) and leaves authority assessment to the caller. No subsequent-treatment data exists, so no case is labelled controlling.

## 7. Limitations

- Lexical retrieval misses paraphrase and synonymy.
- No reranker, so ordering within the lexical list is TF-IDF only.
- Chunk size is capped at ~900 characters; very long provisions are split.
- The index is rebuilt in memory per run; there is no persistent vector or inverted index.
