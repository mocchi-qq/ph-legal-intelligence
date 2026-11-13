# Gate 4 Baseline

**Date:** 2026-11-13
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD at Gate 4 start:** `7e9824a` (33 commits)
**Working tree at start:** clean

## 1. Repository discovery

The prompt's baseline (`ab8153d`, 31 commits) was stale. `ab8153d` is the Gate 2 sync commit; Gate 3 added `0dea7ba`, and the Gate 3 independent-review corrections added `7e9824a`. Gate 4 starts from `7e9824a` and preserves all prior work. Nothing has been pushed.

| Item                   | Value                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | Node v24.22.1                                                                                                                               |
| Package manager        | pnpm 9.0.0                                                                                                                                  |
| Git                    | 2.53.0                                                                                                                                      |
| Migrations             | `0001_legal_documents.sql`, `0002_gate1_ingestion.sql`, `0003_owner_authorization.sql`; Gate 4 adds `0004_gate4_activity_authorization.sql` |
| Source registry        | `legal-data/source-registry/sources.json` (25 sources)                                                                                      |
| Authorization registry | `legal-data/source-registry/sources.authorization.json` (25 sources, all `UNKNOWN`/`NOT_REVIEWED`)                                          |
| Matrix                 | `legal-data/source-registry/SOURCE_AUTHORIZATION_MATRIX.md`                                                                                 |
| Gate 1–3 reports       | `docs/gates/gate-1/`, `docs/gates/gate-2/`, `docs/gates/gate-3/`                                                                            |
| Gate 3 counsel packet  | `docs/gates/gate-3/counsel-review/`                                                                                                         |
| Pilot manifest         | `docs/gates/gate-2/PILOT_MANIFEST.json`                                                                                                     |
| Pilot originals        | `legal-data/pilot/` (git-ignored)                                                                                                           |
| Test command           | `npx vitest run`; `pnpm build`; `npx biome check .`                                                                                         |

## 2. Gate 1–3 regression at Gate 4 start

| Check                                      | Result                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `npx vitest run`                           | 33 test files passed, 1 skipped; 277 tests passed, 1 skipped (live pilot)                |
| `pnpm build`                               | exit 0                                                                                   |
| `npx biome check .`                        | exit 0; 0 errors, 59 warnings (pre-existing non-null assertions)                         |
| Gate 1 benchmark hash                      | `7fca3b67a347f634f6b88d274804d5d17662d6ea837c425f5f55a83030bfb0a5`, unchanged and pinned |
| Pilot hashes                               | all four match `PILOT_MANIFEST.json`                                                     |
| Exact identifier routing                   | exact-only; Gate 3 alias/equality safeguards intact                                      |
| Unsupported relationships                  | non-operative; no implied repeal                                                         |
| Append-only versions                       | intact                                                                                   |
| Failed ingestion                           | no partial mutation                                                                      |
| Source authorization enforced at ingestion | yes; source-level gate plus new Gate 4 activity gate                                     |
| URL/SSRF guards                            | active; redirects re-validated                                                           |
| Migration CHECK constraints                | 0001–0003 intact; 0004 additive with CHECKs and append-only triggers                     |
| Citation support classifications           | explicit; `LEXICAL_ONLY` excluded from grounded answers                                  |

The Gate 4 test additions increase the suite to **37 test files, 316 tests** (315 passing, 1 skipped). No prior test was removed or weakened.

## 3. Existing authorization implementation

- Gate 1/2: source-level `AuthorizationState` and `authorizedSourceIds`/`ownerAuthorization` in `packages/legal-ingestion/src/acquisition.ts` and `pipeline.ts`.
- Gate 3: counsel dossier and matrix; no determination.
- Gate 4 adds: activity-specific `ActivityAuthorizationRegistry`, fail-closed checks for ingestion and acquisition (strict by default; the legacy coarse gate needs explicit opt-in), append-only audit events, migration 0004, and readiness logic.

## 4. Carried limitations

- 25 sources `UNKNOWN`; 0 counsel determinations.
- Four owner-authorized pilot documents only; no authorized corpus.
- No verified legal dates; no independent second-source authenticity.
- No OCR, semantic retrieval, reranking, authentication, tenancy or deployment.
- Parser: process limits and network isolation; no filesystem sandbox or malware scanner.

## 5. Scope decision

Counsel authorization is absent, so corpus expansion is **BLOCKED**. Gate 4 performs authorization-closure preparation and safe enforcement work only. It acquires no new documents.
