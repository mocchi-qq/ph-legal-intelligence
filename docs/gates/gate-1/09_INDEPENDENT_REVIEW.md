# Gate 1 Independent Review

**Reviewer lane:** B (OpenCode), independent of the authoring lane (A)
**Reviewed commit:** `e8a806c`
**Date:** 2026-11-10
**Verdict at first review:** **REQUEST CHANGES** (one blocking status defect; engineering approved in substance)

## 1. Reproduced evidence

The reviewer re-ran everything rather than trusting the implementation report.

| Check                                   | Observed                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                    | clean                                                                                                                 |
| `npx vitest run`                        | 21 files, 196 tests passing                                                                                           |
| `pnpm build`                            | exit 0, all libraries build, all apps typecheck                                                                       |
| `npx @biomejs/biome check .`            | 125 files, exit 0                                                                                                     |
| Migrations 0001 + 0002 on `node:sqlite` | applied; 10 tables; all new relationship types accepted; bogus type and bogus run status rejected by CHECK            |
| Benchmark JSON freshness                | committed JSON byte-identical to a fresh run; 8 docs / 9 versions / 31 provisions / 31 chunks / 10 runs / 1 duplicate |
| Secret/scope scan                       | no remote; no secrets; no real legal text; no product UI; no crawler                                                  |

## 2. Substantive findings (all non-blocking)

The reviewer independently confirmed:

- the authorization guard runs before any derived write;
- failure/duplicate paths are transactional and audited;
- dedupe is three-layered (bytes, source, normalized text);
- originals are preserved content-addressed;
- migration 0002 rebuilds relationships without dropping columns;
- the four citation layers are independent and `VERIFIED` requires all four;
- support is labelled a lexical proxy in every result;
- grounding uses only `VERIFIED` evidence, abstains otherwise, and strips instruction-like text;
- benchmark thresholds are pre-declared and semantic retrieval is scored as `NOT IMPLEMENTED`;
- no source is approved and no legal-compliance claim is made.

Minor issues raised and their disposition:

| #   | Issue                                                                     | Disposition                                                                                          |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | The synthetic flag alone could bypass the authorization guard             | **Applied** in `e0e86b0`: synthetic-locator cross-check + test                                       |
| 2   | `REPEALED` provision with unknown repeal date passed temporal validity    | **Applied after re-review**: fails closed with "repeal date is unknown"                              |
| 3   | "Private/public separation by construction" overstated index isolation    | **Applied after re-review**: relabelled conditional; no enforced tenant boundary                     |
| 4   | Dead `LAW_LIKE` set in `pipeline.ts`                                      | **Applied after re-review**: removed                                                                 |
| 5   | Ingestion doc comment imprecise about transactional scope                 | **Applied** in `e0e86b0`                                                                             |
| 6   | Chunk offsets drifted after trimming; fallback label invented "Section 1" | **Applied** in `e0e86b0` for the final chunk and label; mid-loop offsets **applied after re-review** |
| 7   | PLAN's support-case denominator drifted from 4 to 10                      | **Applied after re-review**: drift note added                                                        |

The first re-verification pass correctly caught that items 2, 3, 4 and 7 had been claimed but not applied, and that item 6 was only partly applied. Those claims were inaccurate; this table records the timeline rather than hiding it.

## 3. Blocking finding and disposition

**Blocking:** `GATE1_REPORT.md` claimed the independent review was _Done_ and referenced this file before it existed. That is an unsupported status claim in the gate record — the exact class of defect Gate 0 identified.

**Disposition:** the report was corrected to `IN REVIEW`; this record was then created from the actual review. The gate's independent-review status remains `IN REVIEW` until the reviewer re-verifies the fixes and issues a final verdict.

## 4. Re-verification

_Pending._ This section will record the reviewer's second-pass command output and final verdict. It will not be filled speculatively.
