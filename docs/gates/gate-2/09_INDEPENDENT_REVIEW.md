# Gate 2 Independent Review

**Reviewer lane:** B (OpenCode), independent of the authoring lane (A)
**Reviewed commit:** `15a926f` (plus the remediation commit that follows)
**Date:** 2026-11-10
**Verdict:** **APPROVE** for the engineering additions, with Gate 2's primary objective recorded as **BLOCKED** (real acquisition).

## 1. Reproduced evidence

| Check                                 | Observed by reviewer                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| `git status --short`                  | clean                                                                 |
| Baseline at `4706252`                 | 21 files, 198 tests                                                   |
| Current suite                         | 26 files, 241 tests at review; 243 after remediation tests            |
| `pnpm build`                          | exit 0                                                                |
| `npx @biomejs/biome check .`          | exit 0, warnings only                                                 |
| Migrations 0001+0002 on `node:sqlite` | 10 tables; document type and relationship type rejected when invalid  |
| Gate 1 benchmark JSON                 | SHA-256 `7fca3b67…b0a5`, unchanged and pinned by test                 |
| PDF tooling                           | `pdftotext`/`pdfinfo` present, `tesseract` absent — baseline accurate |
| Real corpus                           | `REAL_CORPUS_MANIFEST.json` = 0 documents, 0 acquisition attempts     |

## 2. Findings at first pass

| ID  | Severity       | Finding                                                                                                 | Disposition                                                                                                                   |
| --- | -------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| F1  | minor          | Acquisition test count stated as 14 but was 13                                                          | **Corrected**; after adding the missing test the count is genuinely 14 (8 manifest + 6 guards)                                |
| F2  | minor          | Identity test count stated as 10 but was 9                                                              | **Corrected** to 10 after adding the G.R. precision test                                                                      |
| F3  | minor          | "Authorized + private URL" row was listed as tested but only `assertFetchableUrl` was tested directly   | **Fixed**: a direct `buildAcquisitionRecord` test now drives authorized refs with localhost, `169.254.169.254` and `10.0.0.5` |
| F4  | minor          | Dead ternary in the Gate 2 benchmark (`"UNAVAILABLE"` both branches)                                    | **Fixed** to a literal                                                                                                        |
| F5  | minor (latent) | SSRF guard is hostname-textual: no DNS resolution, no IPv4-mapped IPv6, no decimal/hex IP normalisation | **Documented** as finding G2-S5; must be fixed before any fetch client exists                                                 |
| F6  | minor          | `Gr 100` could parse as a G.R. number                                                                   | **Fixed**: the G.R. pattern now requires `G.` and `R.`; a negative test covers it                                             |

## 3. Substantive verification

The reviewer independently confirmed:

- all 25 sources remain `UNKNOWN`/`NOT_REVIEWED`; the registry file is unchanged since Gate 1;
- no network transport exists (no fetch/axios/http client) in the acquisition code;
- the authorization gate precedes record creation and rejects unauthorized states, missing evidence, source mismatch, empty bytes and unsafe URLs;
- PDF extraction really invokes Poppler and leaves the input bytes identical;
- OCR is reported unavailable and throws if called; no confidence is fabricated;
- identity resolution is exact-only and has no neighbour fallback;
- semantic retrieval and reranking are `NOT_IMPLEMENTED` with `metrics: null`;
- support classes separate direct quotation, lexical proxy and reviewed annotation, and annotations are labelled "not legal validation";
- no real Philippine legal document, PDF or case name is committed;
- Gate 1 results are byte-identical and are never merged with the real-corpus (empty) result.

## 4. Second pass — owner-authorized pilot and guarded transport

After the owner authorized a bounded pilot, the reviewer re-ran everything at a later HEAD.

| Check                | Observed                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite                | 27 files / 253 tests at review (28 / 256 after the fixes below)                                                                                          |
| Pilot provenance     | **SHA-256 of all four local files matches `PILOT_MANIFEST.json`**; byte counts match                                                                     |
| Pilot originals      | `legal-data/pilot/` untracked and git-ignored                                                                                                            |
| Amendment evidence   | Both quotes occur verbatim (whitespace-normalised) in the corresponding source HTML                                                                      |
| Transport            | Real `fetch` + real `dns.lookup`; DNS checked per hop; redirects re-validated; truncation, MIME, size, timeout enforced; 10 tests (11 after remediation) |
| Source statuses      | Unchanged — 25 × `UNKNOWN`; `counsel_signoff: false`; `authorization_basis: owner_authorization`                                                         |
| Benchmark separation | Pilot is `SEPARATE_DATASET`; legally-authorized slot stays `BLOCKED`, `metrics: null`                                                                    |
| Gate 1 hash          | unchanged                                                                                                                                                |

Findings at second pass and dispositions:

| ID  | Severity       | Finding                                                                        | Disposition                                                                                                                  |
| --- | -------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| S1  | major          | Hash prefixes in `02_ACQUISITION_AND_PROVENANCE.md` did not match the manifest | **Fixed** to the verified manifest prefixes                                                                                  |
| S2  | major          | `KANBAN.md` uncommitted and unformatted, breaking `biome check`                | **Fixed** and committed                                                                                                      |
| S3  | minor          | `G2-S3` still said transport was absent                                        | **Corrected** to remaining unverified behaviour (retry, TLS pinning, proxies)                                                |
| S4  | minor          | `SEC.` heading support had no offline test                                     | **Added** `segmentation.test.ts`                                                                                             |
| S5  | minor          | Duplicate section number in doc 04                                             | **Fixed**                                                                                                                    |
| S6  | minor          | Pilot JSON `documents: 6` did not disclose 2 synthetic carriers                | **Fixed**: `real_documents: 4`, `synthetic_relationship_carriers: 2`                                                         |
| S7  | minor          | Two short evidence excerpts are committed                                      | **Accepted**: `01A_OWNER_AUTHORIZATION.md` now records the evidence-excerpt carve-out (under ~300 chars, not redistribution) |
| S8  | minor (latent) | Body buffered before size check                                                | **Fixed**: streaming read with a running cap, plus a test                                                                    |

## 5. Final verdict

Gate 2 is **ACCEPTED WITH LIMITATIONS**. The bounded owner-authorized pilot is real and independently verified; the guarded transport is real and tested; the Gate 1 guarantees are preserved.

**Legal authorization is still absent.** All 25 sources remain `UNKNOWN`/`NOT_REVIEWED`, counsel sign-off is false, originals are not redistributed, and bulk ingestion is not authorized. The pilot is four documents, not a corpus benchmark.
