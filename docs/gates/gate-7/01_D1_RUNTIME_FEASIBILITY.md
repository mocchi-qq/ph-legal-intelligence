# Gate 7 — D1 Runtime Feasibility

**Date:** 2026-11-14
**Result:** **BLOCKED** — no usable D1 runtime on this host.
**Consequence:** the adapter is `IMPLEMENTED_UNVERIFIED`; no D1 behaviour is claimed.

## 1. Environment assessed

| Item                          | Result                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Host                          | `Linux 6.17.0-PRoot-Distro`, aarch64, PRoot container                                        |
| Node                          | 24.22.1                                                                                      |
| Wrangler (PATH)               | 4.135.0                                                                                      |
| Wrangler (project dependency) | 3.114.17                                                                                     |
| workerd                       | 1.20250718.0 present under `node_modules/.pnpm`                                              |
| Miniflare                     | 3.20250718.3 present (wraps workerd)                                                         |
| D1 binding in repo            | none — `apps/api/wrangler.toml` and `apps/ingestion/wrangler.toml` declare no `d1_databases` |
| Memory                        | 7.4 GiB total, ~2.6 GiB available                                                            |
| `ulimit -v`                   | unlimited                                                                                    |
| Production credentials        | none used; no remote database touched                                                        |
| Deployment                    | not attempted                                                                                |

## 2. Reproduction

A throw-away Wrangler project was created **outside** the repository:

```
wrangler d1 execute DB --local --command "SELECT 1 AS ok" --config wrangler.toml
```

Observed (2026-11-14, repeated once to confirm it is deterministic):

```
Resource location: local
...
external/tcmalloc+/tcmalloc/internal/system_allocator.h:620]
  MmapAligned() failed - unable to allocate with tag
  (hint=0x4ddf00000000, size=1073741824, alignment=1073741824)
... TCMalloc assumes a 48-bit virtual address space size
... FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
✘ [ERROR] write EPIPE
```

This is workerd's statically linked TCMalloc failing to place a 1 GiB aligned
region under this kernel/PRoot combination. It happens before any SQL executes:
no database file is created, no binding is instantiated, no statement runs.

The failure is not caused by a limit we can raise (`ulimit -v` is unlimited) and
not by repository configuration. Per the gate instruction, no retry loop followed.

## 3. Options evaluated, in the required order

| #   | Option                                          | Outcome                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Existing local Workers/D1 test setup            | **None exists.** No D1 binding, no test pool, no `wrangler dev` harness for this repo                                                                                                                                                                      |
| 2   | Compatible Miniflare / Workers test environment | Miniflare 3 requires workerd → same TCMalloc failure. Miniflare 2 (`@miniflare/d1`, better-sqlite3) is end-of-life, needs a native build on aarch64/Node 24, and is a second emulator rather than the D1 runtime — rejected rather than substituted for D1 |
| 3   | Wrangler local D1                               | **Fails** as above                                                                                                                                                                                                                                         |
| 4   | Another documented Cloudflare method            | `@cloudflare/vitest-pool-workers` also runs workerd; remote D1 is prohibited (no credentials, no deployment). No documented method exists that avoids workerd                                                                                              |

`node:sqlite` is available and is used **only** as a supplementary SQL engine. It
is not D1 and is never reported as D1.

## 4. What this means for acceptance

- The D1 adapter, commit-marker design, migrations and audit persistence are
  implemented and unit/integration tested against the shim.
- D1 batch atomicity, D1 constraint enforcement, D1 trigger behaviour and D1
  concurrency remain **unverified**.
- The gate cannot receive `ACCEPTED — DURABLE D1 REGISTRY VERIFIED` on this host.
  Verdict is `BLOCKED` with a complete, testable implementation.

## 5. Exact verification runbook for a suitable host

Requirements: Node 20+, a working workerd/Miniflare local runtime, no remote
credentials.

```bash
cd /root/ph-legal-intelligence
pnpm install
pnpm exec wrangler --version            # 4.x
# 1. Create a local D1 database and bind it (throw-away config, not committed)
pnpm exec wrangler d1 create phli-gate7-local --local
# 2. Apply the full sequence
for f in migrations/d1/000*.sql; do
  pnpm exec wrangler d1 execute phli-gate7-local --local --file "$f"
done
# 3. Run the D1-backed suites against the real binding
PHLI_D1_RUNTIME=1 pnpm vitest run tests/integration/gate7-d1-registry.test.ts
# 4. Failure injection: run 04_ATOMICITY_AND_FAILURE_VALIDATION.md §5 against D1
# 5. Record runtime versions and raw output in this document
```

Acceptance on that host requires, at minimum:

1. all migrations 0001–0008 apply;
2. a determination write is atomic or the commit marker prevents partial
   projection when a statement is forced to fail;
3. `revoke` + immediate projection denies;
4. audit insert failure denies the operation;
5. append-only triggers reject UPDATE/DELETE;
6. duplicate and concurrent writes produce the documented outcomes.

## 6. Test environment actually used

`node:sqlite` (`DatabaseSync`) behind `tests/helpers/d1-sqlite.ts`, which
implements `prepare/bind/first/all/run/batch`. The shim can run batches either
atomically (transaction) or **non-atomically** (statement by statement), and can
inject a failure at any statement index. The non-atomic mode exists specifically
so the implementation cannot depend on unverified D1 atomicity.

Every artifact labels this evidence `SQLITE_COMPATIBILITY_ONLY`.
