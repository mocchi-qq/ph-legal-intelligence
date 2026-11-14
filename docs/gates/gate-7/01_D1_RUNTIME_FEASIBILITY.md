# Gate 7 — D1 Runtime Feasibility and Verification

**Date:** 2026-11-14
**Local result:** **BLOCKED** — workerd cannot start on this host.
**Remote result:** **VERIFIED** — the adapter, migrations and failure behaviour
were exercised against actual Cloudflare D1 through the official HTTP API.
**Consequence:** D1 implementation is `IMPLEMENTED_AND_D1_TESTED`; the durable
registry is verified. One bounded limitation remains (binding-level `batch()`).

## 1. Environment assessed

| Item                   | Result                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| Host                   | `Linux 6.17.0-PRoot-Distro`, aarch64, PRoot container               |
| Node                   | 24.22.1                                                             |
| Wrangler (PATH)        | 4.135.0                                                             |
| workerd                | 1.20250718.0 (present, cannot start)                                |
| D1 binding in repo     | none declared; D1 is reached via API in this gate                   |
| Local memory           | 7.4 GiB total, ~2.6 GiB available                                   |
| `ulimit -v`            | unlimited                                                           |
| Cloudflare credentials | present in the environment; used only for a dedicated test database |
| Deployment             | none                                                                |

## 2. Local runtime — blocked, reproducibly

A throw-away Wrangler project outside the repository:

```
wrangler d1 execute DB --local --command "SELECT 1 AS ok" --config wrangler.toml
```

```
external/tcmalloc+/tcmalloc/system_allocator.h:569] MmapAligned() failed
  - unable to allocate with tag (hint=0x4ddf00000000, size=1073741824,
    alignment=1073741824)
... TCMalloc assumes a 48-bit virtual address space size
... FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
✘ [ERROR] write EPIPE
```

The bundled `workerd` binary fails the same way when run directly, with or
without `TCMALLOC_USE_HUGE_REGION_MORE_OFTEN_DISABLE=1`. It aborts before any SQL.
`ulimit -v` is unlimited, so this is not a limit we can raise. Miniflare 3 and the
Workers test pool both require workerd; Miniflare 2 is EOL and a second emulator,
so it was rejected rather than substituted for D1.

## 3. Remote runtime — verified through the official API

`wrangler d1 create` and `wrangler d1 execute --remote` are control-plane and
query calls; neither requires workerd. They worked. The adapter was then exercised
through the documented D1 HTTP endpoint:

```
POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query
```

Design of the verification:

- a **dedicated, non-production** database `phli-gate7-verify` was created for
  this gate, in APAC (`served_by: v3-prod`, colo `SIN`);
- only synthetic `synthetic://` fixtures were written (`real_rows: 0`);
- no other database was read or written;
- no Worker was deployed;
- the database was deleted after the run.

### 3.1 Migrations on real D1

All eight applied, in order, unchanged:

| Migration | Applied |
| --------- | ------- |
| 0001      | yes     |
| 0002      | yes     |
| 0003      | yes     |
| 0004      | yes     |
| 0005      | yes     |
| 0006      | yes     |
| 0007      | yes     |
| 0008      | yes     |

Resulting schema on D1: **19 tables, 19 triggers, 46 indexes**.

### 3.2 Adapter tests on real D1

`tests/integration/gate7-d1-remote.test.ts` — **8 tests, 8 passed** (run twice,
including once after a host restart). It requires `PHLI_D1_RUNTIME=1` and a
database id, and is skipped in the default suite.

| Test                                                                                  | Result |
| ------------------------------------------------------------------------------------- | ------ |
| Migrations present; no real counsel rows                                              | pass   |
| Professional + determination persist and project                                      | pass   |
| Failure injected at each of the 5 write stages → no projectable record                | pass   |
| Identical retry → `ALREADY_COMMITTED`; changed retry rejected                         | pass   |
| Append-only + tamper detection (UPDATE/DELETE rejected)                               | pass   |
| Foreign key, JSON and audit-schema constraints rejected                               | pass   |
| Revocation denies the next projection; duplicate revocation rejected; audit persisted | pass   |
| Concurrent revoke + supersede → exactly one terminal event                            | pass   |

## 4. What is verified and what is not

**Verified on actual D1:** schema application, table/trigger/index creation, FK
and CHECK enforcement, JSON/date/hash validation, append-only triggers, parameter
binding, insert/read round-trips, payload-hash integrity, commit-marker visibility,
partial-write invisibility (safe recovery), idempotent retry, revocation
immediacy, and a real concurrent terminal-event race.

**Not verified:** the Workers binding API itself — `batch()` transaction
semantics, `first()/all()` binding behaviour, and binding-level concurrency. The
HTTP API has no transactional batch, so the remote suite executes `batch()`
statements sequentially. That is why it is a _safe-recovery_ verification rather
than an _atomic-batch_ verification.

This is acceptable because the design does not depend on batch atomicity: the
commit marker is last and is hash-verified at read time. The remote failures at
each statement index prove that no partial write can project on the real engine.

**Residual limitation:** if the Workers binding ever executed batch statements in
an unexpected order, "last statement" would need re-confirmation. Cloudflare
documents sequential execution within a batch, and the design remains fail-closed
(the marker would simply be absent → deny).

## 5. Reproduce

```bash
# 1. dedicated test database (never a production database)
wrangler d1 create phli-gate7-verify
export PHLI_D1_DATABASE_ID=<uuid>

# 2. apply the sequence (remote, no workerd needed)
for f in migrations/d1/000*.sql; do
  wrangler d1 execute phli-gate7-verify --remote --file "$f"
done

# 3. run the real-D1 suite
PHLI_D1_RUNTIME=1 PHLI_D1_DATABASE_ID=$PHLI_D1_DATABASE_ID \
  npx vitest run tests/integration/gate7-d1-remote.test.ts

# 4. remove the test database
wrangler d1 delete phli-gate7-verify
```

The default `npx vitest run` does not touch the network: the remote suite is
skipped without the environment variables.
