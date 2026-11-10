# Legal Identity and Structure

**Date:** 2026-11-10
**Implementation:** `packages/legal-ingestion/src/identity.ts`
**Tests:** `tests/legal-data/identity.test.ts` (10 passing)

## 1. Identifier parsing

Recognised forms and canonical keys:

| Form                                          | Canonical key             |
| --------------------------------------------- | ------------------------- |
| `Republic Act No. 10173`, `R.A. No. 10173`    | `REPUBLIC_ACT:10173`      |
| `Executive Order No. 101`, `E.O. No. 101`     | `EXECUTIVE_ORDER:101`     |
| `Presidential Decree No. 442`, `P.D. No. 442` | `PRESIDENTIAL_DECREE:442` |
| `Administrative Order No. 35`                 | `ADMINISTRATIVE_ORDER:35` |
| `Memorandum Circular No. 12`                  | `MEMORANDUM_CIRCULAR:12`  |
| `G.R. No. 999001`                             | `GR:999001`               |
| `A.M. No. 25-11-28-SC`                        | `AM:25-11-28-SC`          |

Parsing is textual and deterministic. It does not guess across numbering systems and returns `null` when no identifier is present.

## 2. Resolution rules (tested)

- Exact kind + number only.
- Nonexistent `G.R. No. 999009` against `999001`/`999002` → `NO_MATCH`. **No neighbour fallback.**
- Same number, two issuing authorities → `AMBIGUOUS` unless an issuing authority is supplied, then `MATCH` on the exact authority.
- A similar title does not affect resolution; candidates are matched by parsed identifier, never by title similarity.

## 3. Structural outline

`parseStatutoryOutline` recognises `Article`, `Chapter`, `Title`, `Part`, `Section`, `Rule`, `Annex` lines with explicit numbering. It preserves the label as printed (`Section 1`, not a rewritten form) and never invents missing numbers. Unlabelled text is not assigned a fake section number.

## 4. Relationship with Gate 1 versioning

Gate 1 already supports evidenced `AMENDS`/`REPEALS`/`PARTIALLY_REPEALS` edges with scope and quoted evidence. Gate 2 adds identifier parsing so a real instrument can be matched to an existing canonical identity before an edge is applied. No new relationship type or automatic inference was introduced.

## 5. Not implemented

- Extraction of identifiers from real PDFs is not wired to the parser; identifier strings are supplied explicitly.
- Issuing-authority registries (which court or agency legitimately issues which number series) are not modelled; authority is an explicit string.
- Annexes, schedules and tables are not parsed into units.
- No automated conflict resolution; ambiguity is surfaced, never resolved silently.

## 6. Result

Identity parsing and exact resolution are implemented and tested. They deliberately refuse to resolve approximate or conflicting identities.

## 7. Real-document result (owner-authorized pilot)

The four pilot documents used both `SECTION n.` and `SEC. n.` headings. The parser
initially recognised only `SECTION`, collapsing each document to one `unsegmented`
unit. After extending the heading pattern to `SEC.`, the pilot produced **56
provisions across the 6 corpus records** (4 real documents plus 2 synthetic
relationship carriers) and 89 chunks.

Identifiers parsed correctly for all four: `REPUBLIC_ACT:12232`, `10931`, `12326`,
`12325`. No title similarity was used.

Limitations confirmed on real HTML:

- `SEC.` support was required and is now tested; other source-specific heading
  styles may still collapse.
- Annexes, schedules and tables are not parsed.
- A referenced "Section 1 of RA 12232" inside another Act is body text, not a
  heading, because the heading pattern requires a line start.
