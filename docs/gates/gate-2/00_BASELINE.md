# Gate 2 Baseline

**Date:** 2026-11-10
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD at baseline:** `4706252`
**Working tree:** clean at inspection

## 1. Runtime and tooling

| Item        | Value                                              |
| ----------- | -------------------------------------------------- |
| Node        | v24.22.1                                           |
| pnpm        | 9.0.0                                              |
| git         | 2.53.0                                             |
| Test runner | Vitest (root `npx vitest run`)                     |
| Build       | `pnpm build` (library builds + app typechecks)     |
| Lint        | `npx @biomejs/biome check .`                       |
| PDF tools   | `pdftotext`, `pdfinfo` present                     |
| OCR         | `tesseract` **absent**; `pytesseract`/`PIL` absent |
| Python PDF  | `pypdf` present; `PyMuPDF`/`pdfplumber` absent     |

## 2. Gate 1 regression revalidated

| Check                          | Result                              |
| ------------------------------ | ----------------------------------- |
| Test suite at baseline         | 21 files, 198 tests passing         |
| Gate 1 benchmark JSON          | unchanged (SHA-256 `7fca3b67…b0a5`) |
| Synthetic fixture manifest     | intact, all `synthetic: true`       |
| Exact identifiers exact-only   | re-verified by test                 |
| Empty extraction transactional | re-verified by test                 |
| Grounding requires VERIFIED    | re-verified by test                 |
| Migrations 0001 + 0002         | applied to `node:sqlite`, 10 tables |

## 3. Reusable packages

- `@phli/legal-ingestion` — bounded ingestion, versioning, relationships.
- `@phli/legal-search` — exact + lexical + filters + RRF.
- `@phli/citation-engine` — four-layer verifier.
- `@phli/ai-orchestrator` — evidence-only grounding.
- `@phli/document-parser` — parsed types (Gate 1); PDF adapter added in Gate 2.
- `@phli/legal-schema` — canonical model + taxonomy.

## 4. Authorization state carried forward

- 25 sources registered. **All `UNKNOWN` / `NOT_REVIEWED`. Zero approved.**
- No written reuse determination and **no Philippine counsel sign-off**.
- Gate 1 evidence gathered only `robots.txt` for three domains; that is not a reuse licence.

## 5. Environment blockers

| Blocker                                    | Effect                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| No source authorization / counsel sign-off | Real acquisition, ingestion and real-corpus benchmarking are **BLOCKED**          |
| No OCR engine                              | OCR cannot be run or validated; reported `UNAVAILABLE`                            |
| No embedding model                         | Semantic retrieval cannot be implemented or evaluated; reported `NOT_IMPLEMENTED` |
| ARM/PRoot host                             | Vite static builds remain unexercised; library build + typecheck used             |

## 6. Risks

1. Treating public accessibility as permission — explicitly prohibited in code and process.
2. Claiming PDF/OCR/semantic capability that no environment supports — mitigated by status reporting.
3. Synthetic results leaking into real-corpus metrics — mitigated by separate datasets and a hash-pinned Gate 1 result.
4. Silent identity fallback — mitigated by exact-only resolution and tests.

## 7. Gate 2 scope decision

Real-source acquisition is blocked. Work proceeds only on engineering that does not require unauthorized material:

- acquisition manifest + authorization gate + URL/path guards;
- PDF inspection and native text extraction, tested on generated synthetic PDFs;
- exact legal-identifier parsing and resolution;
- citation support classification (lexical proxy vs reviewed annotation);
- benchmark separation and blocker reporting.
