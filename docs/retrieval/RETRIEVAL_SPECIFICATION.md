# Retrieval Specification

Status: Gate 11 documentation
Owners: Documentation working group
Last updated: 2026-11-15

This document describes the retrieval contract as implemented in
`packages/legal-search/src/retrieve.ts` and `packages/legal-search/src/types.ts`.
It is narrower than `docs/architecture/SEARCH_SPECIFICATION.md`: that document
specifies hybrid lexical-plus-semantic retrieval with a cross-encoder reranker,
and **none of the semantic or reranking machinery is wired**. Retrieval here is a
deterministic, in-memory, lexical index with exact-identifier routing.

## 1. Entry points

| Function                                              | Behaviour                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `buildSearchIndex(corpus, { authorize })`             | Builds the index; throws `index_authorization_required` without a callback |
| `retrieve(index, query, defaultLimit = 10)`           | Returns `SearchResult[]`; deterministic for a given index and query        |
| `isIdentifierQuery(text)`                             | Distinguishes a bare citation from a question that cites one               |
| `toCitationInput(result, proposition, relevantDate?)` | Adapts a result to the citation engine's passage input                     |

The index is built from `CorpusState` (documents, versions, provisions, chunks).
`buildSearchIndex` calls `authorize({ documentId, sourceId })` before indexing each
document's chunks and skips it when the decision is not `allowed`; there is no
default authorizer and no permissive fallback.

## 2. `SearchResult` fields

Defined in `packages/legal-search/src/types.ts`; the values are assembled at the
end of `retrieve()`.

| Field           | Type                                                        | Meaning                                                             |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `documentId`    | `string`                                                    | Canonical document the passage belongs to                           |
| `citationText`  | `string \| null`                                            | Citation, docket, identity key or title, in that priority           |
| `chunkId`       | `string`                                                    | The retrievable chunk                                               |
| `score`         | `number`                                                    | Fused reciprocal-rank score                                         |
| `passage`       | `string`                                                    | Passage text for grounding                                          |
| `metadata`      | `ChunkMetadata`                                             | Filtering and display metadata                                      |
| `versionId`     | `string`                                                    | Version the passage came from; may be `""` for an unversioned chunk |
| `provisionId`   | `string \| null`                                            | Provision, where known                                              |
| `effectiveFrom` | `string \| null`                                            | Version validity start (ISO date)                                   |
| `effectiveTo`   | `string \| null`                                            | Version validity end (ISO date)                                     |
| `span`          | `{ charStart: number; charEnd: number } \| null`            | Passage offsets in the source text; `null` when either is unknown   |
| `provenance`    | `{ sourceId, documentId, versionId, provisionId, chunkId }` | Traceable origin of the passage                                     |
| `exactMatch`    | `boolean`                                                   | The passage's **document** matched an exact identifier query        |
| `scores`        | `RetrievalScoreBreakdown`                                   | Per-signal breakdown                                                |

`scores` reports `lexical` and sets `semantic`, `rerank` and `authority` to `0`
unconditionally: those signals are not implemented. `score` is an RRF sum, not a
normalised relevance in `[0, 1]`, despite the type comment.

`exactMatch` is document-level by design: it says the document was cited, not
that the passage restates the identifier. Passage-level truthfulness exists
internally as `exactPassage` — the normalised key (length ≥ 6) appears in the
normalised chunk text — but it is used **solely to order exact matches**
(`sort` compares `Number(b.exactPassage) - Number(a.exactPassage)`) and is never
exposed on the result: the `satisfies SearchResult` mapping emits only
`exactMatch`. A caller therefore cannot distinguish a passage that restates the
identifier from one that does not. This is a known gap, not a documented
guarantee.

## 3. Exact-identifier routing

`isIdentifierQuery` returns `false` when the query opens with an interrogative or
imperative word (`which`, `what`, `who`, `when`, `where`, `why`, `how`, `does`,
`do`, `is`, `are`, `was`, `were`, `explain`, `find`, `summarise`/`summarize`,
`tell`, `list`, `show`). Otherwise it returns true when the query contains a
typed identifier: `G.R.`, `R.A.`, `E.O.`, `P.D.`, `A.O.`, `M.C.`, `A.M.`, `B.P.`,
`C.A.` followed by a number, or a spelled-out instrument name such as
`REPUBLIC ACT`.

Consequences:

- Identifier query with no exact match returns `[]`. Fuzzy neighbours are never
  substituted for an authority that does not exist.
- Identifier query with a match suppresses lexical noise from unrelated
  documents: the lexical leg is restricted to the matched document ids.
- A question that merely cites an identifier keeps its lexical neighbours,
  because the citing or amending instrument is the answer.

Alias canonicalisation maps `RA 12325`, `R.A. No. 12325` and
`Republic Act No. 12325` to the same key, and likewise for executive orders,
presidential decrees, Batas Pambansa, Commonwealth Acts and G.R. numbers.

## 4. Lexical signal and fusion

Tokens are lowercased, stripped to `a-z0-9§¶.`, length-filtered and
stopword-filtered. Scoring is a TF-IDF cosine-style sum using
`(1 + ln tf) × idf`, with `idf = ln(1 + N / (1 + df))`. A candidate is kept only
if it reaches `MIN_LEXICAL = 0.02` and term coverage `≥ 0.3`, where coverage
ignores generic legal vocabulary (`act`, `law`, `code`, `section`, `republic`,
`philippines`, `data`).

The two lists are fused with reciprocal rank fusion at `k = 60`. Ordering is by
fused score, then `exactPassage`, then `chunkId` ascending, so equal-scoring
results have a stable order.

## 5. Filters and as-of selection

Filters are applied to candidates before scoring. `documentType`, `jurisdiction`
and `verificationStatus` are enforced unconditionally; `court` and `agency` are
enforced only when the entry has a non-null value, so a document with an unknown
court passes any court filter. `dateRange` compares whole years parsed from
`promulgationDate`, `approvalDate` or the version's `effectiveFrom`, not exact
dates. `SearchFilters.topic` is declared but **not applied**.

`asOfDate` keeps an entry only when `effectiveFrom` is non-null, is not later
than the date, and `effectiveTo` is either null or strictly after it. An unknown
start is excluded rather than treated as open; an open end is treated as current.
`SearchQuery.mode` and `SearchQuery.tenantId` are declared but not read by
`retrieve`, so no tenant scoping is enforced at this layer.

## 6. Support verification is a lexical proxy

`packages/citation-engine/src/verifier.ts` decides the support layer with
`supportCoverage`: the fraction of the proposition's operative terms (length > 2,
stopwords removed) that occur in the passage, against `SUPPORT_THRESHOLD = 0.8`.
A proposition that is a direct quotation of at least 25 normalised characters is
classified `DIRECT_QUOTE`; a pass that is not a quote is `LEXICAL_ONLY`; anything
else is `NO_SUPPORT`. Instruction-like sentences are stripped before judging.

This is **not semantic entailment**. No embedding, vector index, reranker or
model call participates in retrieval or support verification. No evaluation has
measured how often the proxy agrees with a lawyer's judgement.
