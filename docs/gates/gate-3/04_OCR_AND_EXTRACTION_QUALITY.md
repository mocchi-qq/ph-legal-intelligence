# OCR and Extraction Quality

**Date:** 2026-11-10
**Status:** OCR **BLOCKED / NOT REQUIRED for the current corpus**

## 1. Why OCR was not implemented

- No OCR engine is installed (`tesseract`, `pytesseract`, `PIL` absent).
- The current owner-authorized corpus consists of four HTML pages with native text, so OCR provides no benefit for it.
- No counsel-authorized scanned documents exist to justify installing and validating an engine.
- Installing an engine plus language data without a measured need would add runtime and storage for no validated gain.

## 2. Candidate assessment (not installed)

| Candidate | Filipino                                 | Offline | CPU feasibility       | Notes                                                                         |
| --------- | ---------------------------------------- | ------- | --------------------- | ----------------------------------------------------------------------------- |
| Tesseract | language pack needed; quality unmeasured | yes     | likely                | simplest, but no `fil` pack verified here                                     |
| PaddleOCR | multilingual packs, heavy                | yes     | memory risk on 2.3 GB | large download and runtime; not justified                                     |
| Cloud OCR | unknown                                  | no      | n/a                   | would send source text to a third party; privacy and authorization unresolved |

No engine was downloaded or benchmarked. No OCR confidence is reported.

## 3. Native extraction quality on the pilot

| Document | Characters | Extraction flags |         Provisions |
| -------- | ---------: | ---------------- | -----------------: |
| RA 12232 |      4,010 | none             | (part of 54 total) |
| RA 10931 |     23,378 | none             |                    |
| RA 12326 |      6,966 | none             |                    |
| RA 12325 |     22,192 | none             |                    |

Across four documents the corpus produced **54 provisions and 87 chunks**. All four parsed to the expected identifier.

## 4. What is not measured

- No character/word error rate, because there is no OCR output.
- No independently transcribed gold-standard text.
- No table, annex or footnote extraction accuracy.
- No comparison against the printed Official Gazette.

## 5. Extraction classification retained

Native and OCR text remain distinguishable in the model (`ocrUsed`, `ocrConfidence`, `parserVersion`). OCR is never simulated. `NO_OCR_PROVIDER` throws if invoked.

## 6. Consequence

Scanned documents cannot be processed. Any future authorized scanned corpus requires an engine decision, a measured gold-standard comparison, and CPU/memory validation before acceptance.
