# Gate 7 Decision

**Verdict:** **ACCEPTED WITH LIMITATIONS**
**Date:** 2026-11-14
**Gate:** Durable D1 Counsel Registry and Atomic Authorization Decisions

## Why this verdict

The gate required actual D1 runtime evidence; `node:sqlite` was explicitly not a
substitute. Two paths existed:

- **Local workerd** — still cannot start under this PRoot host (TCMalloc
  `MmapAligned(1 GiB)` failure). Blocked, reproducibly, before any SQL.
- **Actual Cloudflare D1 via the official HTTP API** — this works, requires no
  workerd, and is the real D1 engine.

The durable registry was therefore verified on real D1: a dedicated,
non-production database was created (`phli-gate7-verify`, APAC), migrations
0001–0008 were applied unchanged (19 tables, 19 triggers, 46 indexes), and
`tests/integration/gate7-d1-remote.test.ts` passed **8/8** (twice, including once
after a host restart). Only synthetic fixtures were written; `real_rows: 0`; no
other database was touched; no Worker was deployed; the database was deleted
afterwards.

That satisfies the acceptance rules for an implemented D1 adapter, D1 runtime
tests, durable projection, audit persistence, and verified safe recovery.

## The limitation

The Workers **binding** API (`batch()`, `first()`, `all()`) was not exercised,
because it requires workerd. The HTTP API has no transactional batch, so the
remote suite runs `batch()` sequentially — deliberately the harder case.

This does not weaken the result, because the write design does not depend on batch
atomicity: the commit marker is the last statement and is hash-verified at read
time. The remote failure-injection test proves that no partial write can project
on the real engine. The residual risk is fail-closed: if the marker were not
written, projection denies.

Closing that limitation requires one run on a host where workerd starts. It is not
a legal or correctness blocker for the registry.

## What this decision does NOT do

It grants no legal permission. It changes no authorization cell. It does not make
any pilot document ingestible. It does not authorize acquisition, bulk use,
redistribution, commercial reuse, display, retention or deletion. It is not a
legal-correctness claim.

Counsel determinations remain **0**. All **350** cells remain **UNKNOWN**. The
four pilot documents remain **BLOCKED_AUTHORIZATION**.

## Conditions attached to acceptance

1. The remote D1 suite must remain the acceptance test; the SQLite shim cannot
   replace it.
2. Binding-level `batch()` tests are required before claiming full `ACCEPTED`.
3. Any future change to the write order or commit-marker logic invalidates the
   safe-recovery evidence until re-run on D1.
4. No production ingestion may be wired until counsel determinations exist.

## Next action

Two parallel tracks:

- **Engineering:** run the binding-level batch tests on a workerd-capable host,
  then upgrade to `ACCEPTED` if clean.
- **Legal:** obtain genuine source- and activity-specific counsel determinations.
  `sc_elibrary` remains the first source selected for review; selection is not
  authorization.
