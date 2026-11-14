# 01 — Passage Retrieval Contract

**Date:** 2026-11-14
**Status:** implemented in `@phli/legal-search` (synthetic).

## 1. Result shape (additive)

Every `SearchResult` now carries the identity needed to verify a citation without
a second storage lookup:

| Field                           | Meaning                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `documentId`                    | canonical document                                       |
| `versionId`                     | version that produced the passage                        |
| `provisionId`                   | provision version, where known                           |
| `chunkId`                       | retrievable chunk                                        |
| `span`                          | character offsets within the version text, when known    |
| `effectiveFrom` / `effectiveTo` | interval of the version                                  |
| `provenance`                    | source/document/version/provision/chunk tuple            |
| `exactMatch`                    | true when the result came from the exact-identifier path |
| `passage`                       | the text actually retrieved                              |

`metadata` is unchanged. The additions are additive for readers; any code that
constructs a `SearchResult` literal must add the new fields.

## 2. Exact-identifier bypass

An identifier-shaped query (`G.R. No. …`, `RA …`, `EO …`, `PD …`, `A.M. …`)
returns results only from the document(s) whose exact key matched. If none match,
it returns an empty list — never a fuzzy neighbour. Within the matched document,
lexical ranking may still select the most relevant passages; it never introduces
another document. `exactMatch` is document-level: it marks every returned passage of a document
whose exact identifier matched. It is not a claim that the passage repeats the
identifier; use `provisionLabel`/`span` for a pinpoint.

## 3. Point-in-time retrieval

`asOfDate` filters by `[effectiveFrom, effectiveTo)`:

- a version with a null `effectiveFrom` is excluded when an `asOfDate` is given
  (unknown start cannot be assumed to cover the date);
- a version with `effectiveFrom > asOf` is excluded;
- a version with `asOf >= effectiveTo` is excluded (upper bound is exclusive);
- a null `effectiveTo` means no recorded end and is treated as open-ended for
  retrieval. This is a retrieval convenience, not a legal conclusion that the
  version is still in force.

The retrieval layer does not decide legal effect; it only selects the version
interval. Authority state remains the effects-ledger projection.

## 4. Passage, not document

A result is a chunk with a provision label and (when available) a character span.
The contract explicitly does not treat whole-document text as passage support.
The span is relative to the version's extracted text; its provenance is recorded
in `provenance` and `chunkId`.

## 5. Verifier hand-off

`toCitationInput(result, proposition, relevantDate?)` produces the existing
`CitationInput` shape:

```ts
{
  citationText, documentId, passageId: chunkId, location: provisionLabel,
  proposition, relevantDate
}
```

It is structural: `legal-search` does not import `citation-engine`. The verifier
still performs its own identity/location/support/temporal checks; the helper only
removes manual field mapping.

## 6. Non-goals

- No embeddings, vector index or reranker.
- No authority projection inside the search score.
- No claim that retrieval relevance is legal support.
- No real corpus.
