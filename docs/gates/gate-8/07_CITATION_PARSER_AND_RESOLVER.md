# 07 — Philippine Citation Parser and Resolver

**Date:** 2026-11-14
**Status:** design + synthetic implementation. No real citations are resolved to
real documents in this gate.

## 1. Why this is foundational

The research found that exact citation resolution is the difference between a
search engine and an authority system. The existing `identity.ts` parses seven
instrument types and resolves exact keys only. Gate 8 adds structure, aliases,
ambiguity and provenance without replacing that function.

## 2. Parser contract

Input: citation text. Output:

```ts
interface ParsedCitation {
  raw: string;
  normalized: string;
  citationType:
    | "STATUTE"
    | "EXECUTIVE_ISSUANCE"
    | "ADMINISTRATIVE_ISSUANCE"
    | "CASE"
    | "COURT_RULE"
    | "PROVISION_REFERENCE"
    | "UNKNOWN";
  components: {
    instrumentKind?: string; // REPUBLIC_ACT, G.R., A.M., ...
    instrumentNumber?: string; // normalized
    year?: string; // where the format includes one
    provisionType?:
      | "ARTICLE"
      | "SECTION"
      | "RULE"
      | "PARAGRAPH"
      | "CLAUSE"
      | "ITEM";
    provisionLabel?: string; // "2", "3(a)", "45.2"
    subdivision?: string; // "(a)", "¶ 4"
  };
  confidence: "exact" | "partial";
  warnings: string[];
}
```

Parsing never invents identifiers. If a number is missing, the result is
`INVALID_FORMAT` or `PARTIAL`, with a warning.

## 3. Patterns (synthetic-testable)

| Type                  | Example shape                                        |
| --------------------- | ---------------------------------------------------- |
| Republic Act          | `RA 1234`, `Republic Act No. 1234`                   |
| Executive Order       | `EO 123`, `Executive Order No. 123`                  |
| Presidential Decree   | `PD 1234`                                            |
| Administrative Order  | `AO 12`                                              |
| Memorandum Circular   | `MC 12`                                              |
| Case                  | `G.R. No. 123456`                                    |
| Administrative Matter | `A.M. No. 25-11-28-SC`                               |
| Court rule            | `Rule 45`, `Rule 45, Section 2`                      |
| Provision             | `Section 2`, `s. 2`, `Article III`, `Art. III, s. 1` |
| Composite             | `RA 1234, s. 5`, `G.R. No. 123456, 2026-01-01`       |

Composite parsing returns the instrument plus the provision reference; the
resolver resolves the instrument and then the provision identity.

## 4. Resolver contract

```ts
type ResolutionStatus =
  | "EXACT"
  | "ALIAS"
  | "MULTIPLE_CANDIDATES"
  | "PARTIAL"
  | "NO_MATCH"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_TYPE"
  | "UNCERTAIN";

interface CitationResolution {
  status: ResolutionStatus;
  raw: string;
  normalized: string;
  parsed: ParsedCitation | null;
  candidates: Array<{
    documentId: string;
    provisionIdentityId?: string | null;
    match: "CANONICAL_ID" | "ALIAS" | "PROVISION_LABEL";
    provenance: string;
  }>;
  provenance: string[];
}
```

Rules:

1. Exact canonical identifier wins over alias when both would match the same set; if a canonical match and an alias match point to different documents, the result is `MULTIPLE_CANDIDATES` (safer than preferring one).
2. Alias matches are explicit; they do not overwrite canonical matches.
3. More than one candidate → `MULTIPLE_CANDIDATES`; never pick the first.
4. Partial identifier (e.g. `RA 12` when 1234 and 12 both exist) →
   `MULTIPLE_CANDIDATES` or `PARTIAL`, not a guess.
5. Unsupported type → `UNSUPPORTED_TYPE`.
6. Malformed → `INVALID_FORMAT`.
7. No fuzzy edit distance, no embedding similarity, no "closest" match. Instrument patterns are word-bounded so "para 5" is not an RA citation.
8. Every resolution records provenance (canonical table, alias table, provision
   label) for audit.
9. Provision resolution requires a document match first; a bare `Section 2` is
   `PARTIAL` unless the document context is supplied.

## 5. Aliases

Aliases are stored explicitly (`citation_aliases`) with a type and normalizer:
title, short title, citation variant, abbreviation. They are created by an
authorized operator/editorial action, not inferred from similarity. An alias that
collides with another document's canonical identifier is rejected.

## 6. Interaction with verification

The resolver returns identity candidates. The four-layer verifier then checks:

1. identity (resolved document exists);
2. location (provision/passage exists in the resolved version);
3. support (passage vs proposition — unchanged lexical proxy, explicitly not
   entailment);
4. authority state (effects-ledger projection as of the relevant date).

A resolution result is not a verification result. `EXACT` resolution can still fail
location, support or temporal layers.

## 7. Synthetic fixtures

Use `SYNTH-ACT-0001`, `SYNTH-ACT-0002`, `SYNTH-CASE-0001`, `SYNTH-SEC-0001`,
`SYNTH-SEC-0002` with a fictional issuing body. Cover exact, alias, multiple
candidates, partial, no match, invalid, unsupported, and ambiguous provision.

## 8. Acceptance

- Every status is reachable and tested.
- No input produces a silent exact match.
- Original text and provenance are preserved.
- Existing `parseLegalIdentifier` behaviour is unchanged (regression tests).
