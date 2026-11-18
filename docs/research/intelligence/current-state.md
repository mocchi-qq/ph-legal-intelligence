# Current State — Verified Project Baseline

**Repository:** `/root/ph-legal-intelligence` (Philippine Legal Intelligence Platform)
**Branch:** `main`
**HEAD:** `1a61e2c` feat(gate18): read the citation corpus and the ledger snapshot from D1
**Remote:** none (not pushed; `git remote -v` empty)
**Working tree:** dirty — in-progress Gate 19 work (uncommitted + untracked)
**VERSION:** `0.0.0-gate0`

## Working-tree status (as of this baseline)

Modified files (11):
- `KANBAN.md`
- `packages/legal-ingestion/src/pipeline.ts`
- `packages/legal-ingestion/src/types.ts`
- `tests/benchmark/gate1-benchmark.test.ts`
- `tests/benchmark/helpers.ts`
- `tests/ingestion/pipeline.test.ts`
- `tests/integration/gate15-readiness-rehearsal.test.ts`
- `tests/integration/gate16-effect-chain.test.ts`
- `tests/legal-data/authorization-pipeline.test.ts`
- `tests/legal-data/counsel-determinations.test.ts`
- `tests/security/gate1-security.test.ts`

Untracked:
- `docs/gates/gate-19/`
- `tests/helpers/fixture-authorization.ts`
- `tests/ingestion/gate19-synthetic-authorization.test.ts`

**Assumption:** the dirty tree is in-progress Gate 19 (synthetic ingestion exemption) work. It is left untouched by this runway; research does not modify production code.

## Architecture (verified from README + package layout)

- Monorepo, pnpm workspaces, TypeScript
- 5 apps: `web`, `api` (Cloudflare Workers), `ingestion`, `admin`, `benchmark`
- 16 packages: `contracts`, `domain`, `database`, `auth`, `legal-schema`, `legal-ingestion`, `legal-search`, `legal-graph`, `ai-orchestrator`, `model-gateway`, `citation-engine`, `document-engine`, `document-parser`, `permissions`, `observability`, `shared`
- Infrastructure intent: Cloudflare Workers + D1 (SQLite) metadata + R2 (documents) + Vectorize/AI Search (hybrid retrieval) + Queues (ingestion/embedding pipelines)
- Migrations: `migrations/d1/0001_` … `0009_authority_core.sql` (9 migrations; 0009 = authority core)
- No remote D1 writer adapter is production-ready per Gate 6/7 limitations (workerd TCMalloc OOM locally; D1 HTTP API works remotely but no transactional batch)

## Gate status (verified from KANBAN.md)

| Gate | Subject | Verdict | Counsel determinations |
|------|---------|---------|------------------------|
| 0 | Foundation | ACCEPTED WITH LIMITATIONS | 0 |
| 1–4 | Ingestion, retrieval, citation engine, authorization matrix | various reports | 0 of 25 |
| 5 | Counsel registry and determinations | ACCEPTED WITH LIMITATIONS | 0 |
| 6 | Corpus readiness and execution plan | ACCEPTED WITH LIMITATIONS | 0 |
| 7 | D1 runtime, migrations, API surface | ACCEPTED WITH LIMITATIONS | 0 |
| 8 | Authority core: assertions, reviews, projection | ACCEPTED WITH LIMITATIONS | 0 |
| 9 | Passage-level retrieval contract | ACCEPTED | 0 |
| 10 | Authority-aware verification and D1 ledger store | ACCEPTED WITH LIMITATIONS | 0 |
| 11 | Maintenance and ingest idempotence | in progress | 0 |
| 12 | Authorization is checked, not assumed | IN PROGRESS | 0 |
| 13 | Document-activity authorization | IN PROGRESS | 0 |
| 14 | Index build authorization | IN PROGRESS | 0 |
| 15 | End-to-end readiness rehearsal | ACCEPTED WITH LIMITATIONS | 0 |
| 16 | Effect claim intake | ACCEPTED WITH LIMITATIONS | 0 |
| 17 | Corpus → D1 writer | ACCEPTED WITH LIMITATIONS | 0 |
| 18 | Production D1 reader | ACCEPTED WITH LIMITATIONS | 0 |
| 19 | Synthetic ingestion exemption | IN PROGRESS (uncommitted) | 0 |
| Research Gate — International legal-tech landscape | International platforms, PH gap | ACCEPTED WITH LIMITATIONS | 0 |

## Authorization state (constant across all gates)

- **Counsel determinations: 0.**
- **All 350 source-authorization cells: `UNKNOWN`.**
- **Four pilot documents: `BLOCKED_AUTHORIZATION`.**
- No source may be ingested, stored, displayed, or reused until counsel authorizes the specific activity.

## Test suite (per KANBAN + memory)

- ~78 test files; full suite historically green (e.g. Gate 18: 826 tests, 817 pass, 9 skip; Gate 12: 642 tests, 633 pass, 0 fail, 9 skip).
- Build: `pnpm build` exit 0.
- Lint: `npx biome check .` exit 0.
- Environment: Node v24.22.1, pnpm 9.0.0, git 2.53.0; ARM64/PRoot host; workerd cannot start locally (TCMalloc `MmapAligned(1GiB)` fail) — D1 verified remotely via HTTP API only.

## Known limitations (from GATE0_REPORT.md and gate decisions)

- Legal source reuse unverified; all sources `Pending`.
- Benchmark questions are placeholders; content/expected authorities require qualified Philippine legal expert authorship.
- ADR content stubbed.
- No product implementation; retrieval, RAG, citation engine, ingestion connectors, UI specified not built.
- Cloudflare limits cited from documentation, not load-tested.
- Good-law determination unsolved; explicitly out of scope for automation at launch.
- workerd cannot start locally; D1 binding behaviour untested locally.

## Existing research (relevant to this runway)

- `docs/research/international-legal-tech/` — 17-document international legal-tech research dossier, dated 2026-11-14, ACCEPTED WITH LIMITATIONS. Covers: platform landscape (22 identified, 10 deep), retrieval/AI/comparison, authority/temporal validity, provenance, jurisdiction comparison (9 jurisdictions), Philippine market/gap analysis, positioning, feature prioritization (F1–F20), architecture lessons, commercial models, source register (17 sources), research gaps/uncertainties, recommended product roadmap (R0–R5). Source register at `docs/research/international-legal-tech/source-register.json`; feature matrix at `feature-matrix.csv/json`.
- `docs/research/COMPETITOR_RESEARCH.md` — marked stale/deprecated (superseded by the international dossier).
- Gate decision records under `docs/gates/gate-N/` and ADRs under `docs/decisions/`.

## What this baseline does NOT claim

- No real Philippine legal document has been ingested.
- No counsel determination has been received.
- No production deployment exists.
- The authorization matrix is not evidence of legality; it is an enforcement boundary.
