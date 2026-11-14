# Gate 7 Decision

**Verdict:** **BLOCKED**
**Date:** 2026-11-14
**Gate:** Durable D1 Counsel Registry and Atomic Authorization Decisions
**Implementation commit:** `71fc9df`

## Why BLOCKED and not ACCEPTED

The verdict rules are explicit: `ACCEPTED` requires actual D1-compatible
integration tests to pass, and `BLOCKED` is required when D1 runtime behaviour
remains unverified.

On this host, workerd cannot start. Wrangler local D1, Miniflare 3 and the
Workers test pool all require it, and it aborts before executing any SQL:

```
TCMalloc: FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
MmapAligned() failed ... size=1073741824, alignment=1073741824
write EPIPE
```

That is a host limitation, not a configuration defect (`ulimit -v` is unlimited).
Substituting `node:sqlite` for D1 would be exactly the substitution the gate
forbids.

## What is nevertheless delivered

- A repository contract with two adapters and one shared projection function, so
  in-memory tests and the durable adapter cannot drift.
- A D1 adapter with parameterized queries, commit-marker writes and payload-hash
  verification.
- An atomicity design that is safe under both atomic and non-atomic batch
  execution, proven with 10 injected-failure cases.
- Centralized audit with a corrected fail-closed contract (the draft's async-sink
  hole is closed) and coverage of acquisition, ingestion, temporary storage and
  reindexing.
- Durable authorization projection with no in-memory fallback in production mode.
- A nine-state evidence-availability contract that never treats a present file as
  permission.
- Migration 0008, 66 new tests, two independent reviews with both blockers fixed.

## What this decision does NOT do

It grants no legal permission. It changes no authorization cell. It does not make
any pilot document ingestible. It does not authorize acquisition, bulk use,
redistribution or commercial reuse. It is not a legal-correctness claim.

Counsel determinations remain **0**. All **350** cells remain **UNKNOWN**. The
four pilot documents remain **BLOCKED_AUTHORIZATION**.

## What would change the verdict

Run `docs/gates/gate-7/01_D1_RUNTIME_FEASIBILITY.md` §5 on a host where workerd
starts, then:

1. apply 0001–0008 to a local D1 binding;
2. re-run the failure matrix with D1's real batch semantics;
3. confirm revocation, expiry and audit-failure denial on D1;
4. confirm append-only triggers and constraint enforcement on D1;
5. record the versions and raw output.

If those pass and no new finding appears, the correct verdict becomes
`ACCEPTED — DURABLE D1 REGISTRY VERIFIED`, which still carries no legal
authorization.

## Next action

Environment-bound: verify on a D1-capable host. In parallel, external counsel must
provide source- and activity-specific determinations. `sc_elibrary` remains the
first source selected for review; selection is not authorization.
