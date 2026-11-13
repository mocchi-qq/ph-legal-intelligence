# Gate 4 — Activity-Specific Authorization Matrix

**Date:** 2026-11-13
**Machine-readable:** `authorization-matrix.json`
**Scope:** 25 registered sources × 14 activities = **350 cells**

## 1. Result

**All 350 cells are `UNKNOWN`.** No source has a counsel determination for any activity. No status was promoted because a source is official, public, reachable or previously processed under owner risk acceptance.

| Measure                            |                                                       Value |
| ---------------------------------- | ----------------------------------------------------------: |
| Registered sources                 |                                                          25 |
| Activities                         |                                                          14 |
| Cells                              |                                                         350 |
| `AUTHORIZED`                       |                                                           0 |
| `AUTHORIZED_WITH_CONDITIONS`       |                                                           0 |
| `RESTRICTED`                       |                                                           0 |
| `PROHIBITED`                       |                                                           0 |
| `REVIEW_REQUIRED` / `NOT_REVIEWED` | 0 cells (source-level review status remains `NOT_REVIEWED`) |
| `UNKNOWN`                          |                                                         350 |

## 2. Status vocabulary

`UNKNOWN` · `NOT_REVIEWED` · `REVIEW_REQUIRED` · `AUTHORIZED` · `AUTHORIZED_WITH_CONDITIONS` · `RESTRICTED` · `PROHIBITED`

`RESTRICTED` carries the same evidence/reviewer/date requirement as `AUTHORIZED` because a restriction is itself a counsel determination that may later be relied on; a bare restricted status without evidence would be unauditable.

The existing source-level vocabulary in `sources.authorization.json` is preserved for those records. The activity-level vocabulary above is stricter and is the Gate 4 source of truth for activity checks. `APPROVED_FOR_TEST` at source level does not imply any activity-level `AUTHORIZED`.

## 3. Activities

| Activity               | Question                                          | Current determination |
| ---------------------- | ------------------------------------------------- | --------------------- |
| `viewing`              | May the material be accessed and viewed?          | UNKNOWN               |
| `downloading`          | May the original document be acquired?            | UNKNOWN               |
| `temporary_processing` | May it be processed temporarily?                  | UNKNOWN               |
| `persistent_storage`   | May the original bytes be retained?               | UNKNOWN               |
| `text_extraction`      | May text be extracted?                            | UNKNOWN               |
| `ocr`                  | May scanned documents be OCR-processed?           | UNKNOWN               |
| `search_indexing`      | May extracted text be indexed?                    | UNKNOWN               |
| `embedding_generation` | May derived embeddings be created?                | UNKNOWN               |
| `ai_assisted_analysis` | May the content be processed by AI systems?       | UNKNOWN               |
| `citation_display`     | May passages and references be displayed?         | UNKNOWN               |
| `quotation`            | What quotation limits and attribution apply?      | UNKNOWN               |
| `redistribution`       | May original or derived content be redistributed? | UNKNOWN               |
| `commercial_use`       | Are commercial applications permitted?            | UNKNOWN               |
| `retention`            | What retention or deletion requirements apply?    | UNKNOWN               |

Each cell in `authorization-matrix.json` records: source ID, activity, status, evidence, evidence location, counsel decision reference, reviewer, decision date, conditions, expiration, and notes. All evidence fields are null; all notes state that no counsel determination exists.

## 4. Distinctions preserved

- Public accessibility ≠ reproduction right.
- Government publication ≠ unrestricted commercial reuse.
- Official domain ≠ blanket permission for automated acquisition.
- Original legal text ≠ website formatting and metadata.
- Source content ≠ derived text.
- Search indexing ≠ public redistribution.
- Private internal research ≠ commercial public access.
- Temporary processing ≠ permanent storage.
- Owner risk acceptance ≠ counsel authorization.
- A hash match ≠ legal authenticity or currency.

## 5. Enforcement relationship

The matrix is the policy source. The runtime registry (`packages/legal-ingestion/src/authorization.ts`) fails closed: a missing decision is `UNKNOWN` and blocks the requested activity. Strict activity enforcement is the default for non-synthetic ingestion and acquisition. Ingestion requires counsel-basis decisions for temporary processing, persistent storage, text extraction and search indexing. Acquisition requires a counsel-basis downloading decision. The legacy coarse gate requires explicit `allowLegacySourceGate: true` and is limited to the internal pilot. See `04_AUTHORIZATION_ENFORCEMENT.md`.

## 6. What would change a cell

A cell may become `AUTHORIZED` or `AUTHORIZED_WITH_CONDITIONS` only when:

1. A signed or verifiable counsel determination is on file.
2. The determination covers this exact source and activity.
3. Evidence and a decision reference are recorded.
4. Any conditions are recorded and can be checked.
5. An expiry or review date is recorded.

A determination for one activity does not change any other cell.
