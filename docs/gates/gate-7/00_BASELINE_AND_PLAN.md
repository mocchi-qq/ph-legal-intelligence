# Gate 7 — Baseline and Plan

**Date:** 2026-11-14
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD at Gate 7 start:** `91bb20a` (38 commits)
**Gate 6 baseline:** `405a350` (feature commit), HEAD `91bb20a`

## 1. Baseline verification

| Check                  | Reported                    | Verified                                                                                |
| ---------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Branch                 | `main`                      | `main`                                                                                  |
| HEAD                   | `91bb20a`                   | `91bb20aa0785131233cf8cfb8410ee428408e315`                                              |
| Commit count           | 38                          | 38                                                                                      |
| Working tree           | clean                       | **not clean** — see §2                                                                  |
| Full suite at HEAD     | 381 pass, 1 skip (44 files) | **380 pass, 1 fail, 1 skip** (44 files) on a clean HEAD checkout — see §2.1             |
| Build                  | exit 0                      | re-verified at close                                                                    |
| Biome                  | 0 errors, 68 warnings       | re-verified at close                                                                    |
| Migrations             | 0001–0006                   | 0001–0006 present, unmodified                                                           |
| D1 binding in repo     | none                        | `apps/api/wrangler.toml`, `apps/ingestion/wrangler.toml` define no `d1_databases` block |
| Wrangler               | 4.135.0                     | 4.135.0 (`/usr/bin/wrangler`); project pin 3.114.17 in `node_modules/.pnpm`             |
| Counsel determinations | 0                           | 0                                                                                       |
| Authorization cells    | 350, all `UNKNOWN`          | 350, all `UNKNOWN`                                                                      |
| Pilot readiness        | 4/4 `BLOCKED_AUTHORIZATION` | 4/4 `BLOCKED_AUTHORIZATION`                                                             |

## 2. Pre-existing uncommitted Gate 7 work (disclosed)

The reported baseline said the working tree was clean. It was not. An earlier,
unrecorded Gate 7 attempt left these files uncommitted:

- Modified: `KANBAN.md`, `acquisition.ts`, `counsel-determinations.ts`,
  `index.ts`, `pipeline.ts`, `types.ts`
- Untracked: `migrations/d1/0007_gate7_authorization_audit.sql`,
  `authorization-audit.ts`, `counsel-d1-store.ts`, `d1-types.ts`,
  `tests/helpers/d1-sqlite.ts`, two test files, and docs `00`–`09` plus
  `audit-coverage.json`.

That work was inspected before anything was changed. It is retained and
extended where sound. Three defects were found and are corrected in this gate:

1. **Fail-open audit (critical).** `AuthorizationAuditService.record()` is
   synchronous but `D1AuthorizationAuditSink.append()` is async, and the
   returned promise was never awaited or observed. With a D1 sink, an audit
   failure would be an unhandled rejection while the content operation
   proceeded. Fixed by an explicit sync/async sink contract that fails closed.
2. **Non-unique audit event IDs.** IDs came from a per-process counter
   (`auth_audit_1`), which collides across restarts and instances against a
   `TEXT PRIMARY KEY` durable table. Fixed with generated UUIDv4 IDs.
3. **No durable projection.** The D1 store was a set of CRUD primitives with no
   repository contract, no commit semantics, and no path from durable state to
   the authorization decision. Implemented in Phases C, D and G below.

The earlier docs `00`–`09` are rewritten to match what is actually implemented.

## 3. Scope

In scope: durable counsel registry, repository contract, D1 adapter, atomic
determination writes with a verified recovery design, idempotency, centralized
authorization audit, durable authorization projection, evidence-metadata
availability contract, migration compatibility, tests, two independent reviews,
final status.

Out of scope (explicitly): acquiring or processing any real document, expanding
the pilot corpus, enabling ingestion, promoting any authorization cell, creating
counsel evidence, deployment, push.

## 4. Task ledger

| ID   | Objective                                 | Primary files                                  | Depends on | Acceptance                                   | Status         |
| ---- | ----------------------------------------- | ---------------------------------------------- | ---------- | -------------------------------------------- | -------------- |
| G7-A | Baseline + plan                           | `00_…`                                         | —          | Divergence disclosed, no silent overwrite    | DONE           |
| G7-B | Bounded D1 runtime feasibility            | `01_…`                                         | A          | Exact runtime result; no retry loop          | DONE (blocked) |
| G7-C | Shared projection + repository contract   | `counsel-projection.ts`, `counsel-registry.ts` | A          | In-memory and D1 use one projection function | TODO           |
| G7-D | D1 adapter + commit marker                | `counsel-d1-registry.ts`, migration 0008       | C          | Parameterized CRUD; commit-last writes       | TODO           |
| G7-E | Atomicity + failure injection             | tests                                          | D          | No partial state can project                 | TODO           |
| G7-F | Idempotency + concurrency contract        | `05_…`, tests                                  | D          | Duplicates rejected; retries safe            | TODO           |
| G7-G | Central audit (sync + async, fail closed) | `authorization-audit.ts`                       | A          | Async sink cannot be silently dropped        | TODO           |
| G7-H | Durable projection + no memory fallback   | `counsel-registry.ts`                          | D,G        | Registry failure denies; no fallback         | TODO           |
| G7-I | Evidence availability contract            | `evidence.ts`                                  | C          | 9 states distinct; failures deny             | TODO           |
| G7-J | Migration validation 0001–0008            | `09_…`, tests                                  | D          | Fresh + repeated apply; constraints          | TODO           |
| G7-K | Test + regression report                  | `10_…`                                         | E–J        | Counts reported per category                 | TODO           |
| G7-L | Two independent reviews + remediation     | `11_…`                                         | all        | Findings recorded, not suppressed            | TODO           |
| G7-M | Final status + decision                   | `12_…`, JSON, `DECISION.md`                    | L          | Truthful D1 verdict                          | TODO           |

## 5. D1 environment decision (bounded)

Re-probed on 2026-11-14 with Wrangler 4.135.0 and a throwaway project outside the
repository. Result is unchanged and is a host limitation, not a configuration
error:

```
external/tcmalloc+/tcmalloc/internal/system_allocator.h:620] MmapAligned() failed
  - unable to allocate with tag (hint=0x4ddf00000000, size=1073741824,
    alignment=1073741824)
... FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
... write EPIPE
```

`ulimit -v` is unlimited and overcommit is not the constraint; workerd's
TCMalloc cannot place a 1 GiB aligned region under this PRoot kernel. No further
attempts are made. Consequence: **D1 runtime validation is BLOCKED on this
host**, and no ACK of D1 behaviour is claimed. See `01_D1_RUNTIME_FEASIBILITY.md`.

The SQLite-compatible shim is retained **only** as supplementary SQL/constraint
evidence and is labelled as such everywhere.

## 6. Atomicity strategy (decided before coding)

D1 `batch()` atomicity cannot be verified here. The design must therefore be
safe under _both_ atomic and non-atomic batch execution, and must not depend on
an unverified claim.

Strategy: **commit-last marker**. A determination write is one ordered statement
list:

1. `counsel_determinations` insert
2. one `counsel_activity_decisions` insert per activity
3. the counsel audit event insert
4. `counsel_registry_commits` insert (payload hash, last)

Projection only considers a determination whose commit row exists **and** whose
payload hash recomputes. If the batch is atomic, the marker is all-or-nothing.
If it is not, the marker can only exist when every earlier statement succeeded,
because it is last. A failure before the marker leaves an invisible
determination that is denied by default and can be recovered explicitly.

This satisfies "atomic or verified safe recovery" without claiming unverified D1
semantics.

## 7. Risks

| Risk                                              | Mitigation                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Changing the sync content-path API breaks callers | No signature change; sync paths require a sync sink and fail closed on an async one                                   |
| Synthetic fixtures mistaken for counsel records   | All fixtures under `synthetic_*` ids and `synthetic://` refs; a regression test asserts the real registry stays empty |
| Shim evidence reported as D1                      | Every artifact labels `SQLITE_COMPATIBILITY_ONLY`; final verdict cannot be ACCEPTED                                   |
| Pre-existing work overwritten                     | Inspected first, defects documented, retained where sound                                                             |

## 8. Verification plan

- `npx vitest run` (full), plus per-category counts for the report.
- `pnpm build`, `npx biome check .`.
- Regression: 350 cells `UNKNOWN`, 0 determinations, 4 pilot documents
  `BLOCKED_AUTHORIZATION`, pilot hashes unchanged, no new documents.
- Two independent read-only reviews from different model lanes, then remediation
  verification.
