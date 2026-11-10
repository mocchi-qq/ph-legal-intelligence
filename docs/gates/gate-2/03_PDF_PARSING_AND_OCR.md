# PDF Parsing and OCR

**Date:** 2026-11-10
**Implementation:** `packages/document-parser/src/pdf.ts`
**Tests:** `tests/legal-data/pdf.test.ts` (11 passing, 3 conditional on Poppler)

## 1. Environment

| Tool                             | Status             |
| -------------------------------- | ------------------ |
| `pdftotext`                      | present            |
| `pdfinfo`                        | present            |
| `tesseract`                      | **absent**         |
| `PyMuPDF` / `pdfplumber` / `PIL` | absent             |
| `pypdf`                          | present (not used) |

Tool availability is probed at runtime and reported; a missing tool returns `UNAVAILABLE`, never a fabricated extraction.

## 2. Implemented native pipeline

1. Signature check (`%PDF-`).
2. Size limit (default 25 MB).
3. `pdfinfo` → page count, PDF version, encryption flag.
4. `pdftotext -enc UTF-8` → text, with optional `-layout`.
5. Quality assessment.

Safety: `execFile` (no shell), timeout 15 s, output cap, temporary file in a private `mkdtemp` directory with mode `0o600`, removed in `finally`. Original bytes are never modified — a test asserts the input buffer is byte-identical after extraction.

## 3. Quality flags

`empty_text`, `low_text_density` (<40 non-space chars/page), `empty_pages:<n>`, `garbled_characters` (U+FFFD > 0.5%), `control_characters`, `no_punctuation`. Text is never repaired.

## 4. Measured on a synthetic PDF

A generated one-page PDF containing two synthetic legal-style lines:

- inspection: `OK`, 1 page, not encrypted;
- extraction: `native_text`, 1 page, text contains the expected sentence;
- status `OK` after excluding the page-separator form feed from control-character counting.

This is a **parser test on a synthetic file**, not validation on a real Philippine legal PDF.

## 5. Corrupt input

A file beginning with `%PDF-` but containing garbage returns `FAILED`/`REJECTED`/`EMPTY` without throwing and without text. Rejection is explicit.

## 6. OCR

OCR is an interface (`OcrProvider`) with an eligibility classifier. On this host `NO_OCR_PROVIDER` is exported with `available: false`, and a test asserts it throws rather than pretending to run. OCR status is **UNAVAILABLE**.

Consequences:

- scanned PDFs cannot be processed;
- low-density detection can flag them, but the fallback cannot run;
- no OCR confidence can be recorded.

## 7. Not implemented

- Page-level text mapping into the legal schema (PDF page → chunk) is not wired into ingestion.
- Tables and footnotes are not structurally preserved by `pdftotext` plain output.
- Reading-order recovery is limited to the tool's output order.
- No PDF/A, no form fields, no embedded-file handling.

## 8. Result

Native PDF extraction is implemented and tested on a synthetic PDF. OCR is unavailable and reported as such. Real legal PDFs were not acquired, so real-document parsing accuracy is **unmeasured**.
