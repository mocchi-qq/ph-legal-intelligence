# Gate 3 Baseline

**Date:** 2026-11-10
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD at baseline:** `ab8153d`
**Working tree:** clean

## 1. Runtime and environment

| Item             | Value                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Node             | v24.22.1                                                                         |
| pnpm             | 9.0.0                                                                            |
| git              | 2.53.0                                                                           |
| Available memory | ~2.3 GB                                                                          |
| Disk free        | ~72 GB                                                                           |
| OCR engine       | absent (`tesseract`, `pytesseract`, `PIL` missing)                               |
| Sandbox tools    | `prlimit` present, `unshare` present, `bwrap` present but unusable (no `/lib64`) |
| Malware scanner  | absent (`clamscan`, `freshclam`)                                                 |
| Semantic model   | none selected or downloaded                                                      |

## 2. Gate 1 and Gate 2 regression at baseline

| Check                     | Result                                            |
| ------------------------- | ------------------------------------------------- |
| `npx vitest run`          | 28 files, 256 tests passed, 1 live-pilot skipped  |
| `pnpm build`              | exit 0                                            |
| Biome                     | exit 0                                            |
| Gate 1 benchmark SHA-256  | `7fca3b67…b0a5`, unchanged                        |
| Gate 2 pilot manifest     | 4 documents, 4 local snapshots, hashes recomputed |
| Migrations 0001–0003      | apply; `authorization_basis` CHECK enforced       |
| Exact identifiers         | exact-only, no neighbour fallback                 |
| Unsupported relationships | no legal status change                            |
| Append-only versions      | intact                                            |
| Failed ingestion          | no partial mutation                               |
| Authorization enforcement | active at ingest                                  |
| URL/SSRF guards           | active; DNS resolved per hop                      |
| Citation support classes  | explicit                                          |

No critical regression was found.

## 3. Carried limitations

- 25 sources `UNKNOWN`, no counsel sign-off.
- Four owner-authorized documents only.
- No OCR, no semantic retrieval, no reranking.
- Poppler was unsandboxed at Gate 2 (addressed in Gate 3).
- No authentication, tenancy or deployment.

## 4. Gate 3 scope decision

Counsel authorization is absent, so corpus expansion is **BLOCKED**. Gate 3 proceeds with safe work only: authorization packet, snapshot model, parser isolation, OCR feasibility, identity/version audit of the existing four documents, retrieval evaluation on those four, technical citation annotation, ground-surface hardening, performance measurement, independent review.
