# Corpus Verification Report

**Date:** 2026-11-10
**Corpus:** `SYNTHETIC` fixtures only
**Records:** `legal-data/verification/corpus-verification.csv`

## 1. What was verified

Ten synthetic artifacts were ingested through the bounded pipeline. All are fictional and marked `synthetic: true`. They exist to exercise provenance, identity, extraction, versioning, retrieval and citation mechanics.

| Measure                                       | Actual                            |
| --------------------------------------------- | --------------------------------- |
| Artifacts ingested                            | 10                                |
| Canonical documents                           | 8                                 |
| Document versions                             | 9 (one document has two versions) |
| Provisions                                    | 31                                |
| Chunks                                        | 31                                |
| Duplicate runs                                | 1 (identical bytes, same source)  |
| Documents with independent human verification | 0                                 |

## 2. Verification dimensions

For each artifact the CSV records: internal identity key, source ID, source URL, source classification, retrieval date, artifact ID, SHA-256, extraction result, verification result, reviewer, exceptions, legal-status confidence, publication eligibility.

- **Provenance:** every artifact has a stable `synthetic://` URL and a SHA-256 of its original bytes.
- **Original preservation:** the pipeline preserves bytes in `artifacts/<sha256>` before parsing (file store); the in-memory store records the key and hash.
- **Extraction:** all ten produced text. The HTML-only artifact with no legal text was rejected as `empty_extraction` in the recovery test.
- **Structure:** statutes segmented into `Section N` provisions; decisions into `¶ N` paragraphs.
- **Publication eligibility:** every synthetic record is `NOT_ELIGIBLE_SYNTHETIC`.

## 3. What was NOT verified

- No real Philippine legal document was acquired, so **no real document identity, authorship, authenticity or current legal status has been verified**.
- No independent human reviewer examined the fixtures; they are machine-checked, not legally checked.
- Legal-status confidence for every synthetic record is `not_applicable_synthetic`.

## 4. Identity and exceptions

One duplicate pair exists by design: `fx-ra1001-v1` and `fx-ra1001-dup` have identical bytes and the same source, and the second is detected as `DUPLICATE` with no new document, version or chunk.

`fx-sc2022-injection` contains an instruction-like sentence. It is recorded with the exception `contains_instruction_like_text` and is treated as document data throughout.

## 5. Conclusion

The **mechanics** of identity, provenance, extraction, deduplication and verification recording work on synthetic data. The **legal** verification of a real corpus has not happened and cannot be claimed.
