# Gate 6 — D1 Registry Validation

**Date:** 2026-11-13
**Test:** `tests/integration/gate6-d1-schema.test.ts` (9 tests)
**Engine:** Node `node:sqlite` (SQLite-compatible SQL; **not** D1)

## 1. What was validated

Migrations 0001–0005 were executed in order against an in-memory SQLite database:

- 0001 legal documents
- 0002 Gate 1 ingestion
- 0003 owner authorization
- 0004 Gate 4 activity authorization + ingestion-run audit columns
- 0005 Gate 5 counsel professionals/determinations/activity/audit
- 0006 Gate 6 JSON/hex/date validation triggers

| Check                                                     | Result                       |
| --------------------------------------------------------- | ---------------------------- |
| Clean migration 0001→0005                                 | PASS                         |
| Required tables present                                   | PASS                         |
| Complete synthetic determination + activity row           | PASS                         |
| Duplicate determination/activity rejected                 | PASS                         |
| Unknown activity rejected                                 | PASS                         |
| Invalid status rejected                                   | PASS                         |
| Foreign key to missing determination rejected             | PASS                         |
| VERIFIED counsel without evidence rejected                | PASS                         |
| VERIFIED_FOR_RECORDING without evidence rejected          | PASS                         |
| Update/delete of determination and audit history rejected | PASS (`append-only` trigger) |
| SQLite transaction rollback of incomplete determination   | PASS                         |
| Malformed JSON / non-hex hash / invalid date rejected     | PASS                         |

## 2. What was not validated

- Actual Cloudflare D1 runtime.
- D1 `batch()`/transaction failure semantics.
- D1 binding, network, or deployment behavior.
- An adapter implementation (none exists).
- Automatic rollback of a partially written determination in D1.

## 3. Exact blocker

```
wrangler d1 execute DB --local --command "SELECT 1"
TCMalloc: FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
write EPIPE
```

The local Wrangler/D1 runtime cannot start in this PRoot environment. No local D1 database was created.

## 4. Interpretation

SQLite compatibility is evidence that the SQL is syntactically valid and that the constraints/triggers behave as intended on a compatible engine. It is **not** evidence of D1 transaction atomicity, and it does not make the registry durable or operational.

## 5. Required future validation

Before claiming a durable registry:

1. Apply migrations to a clean local D1 database.
2. Insert a determination with multiple activities and an audit event in one batch; force a failure and prove no partial determination is projected.
3. Test duplicate, FK, CHECK and trigger behavior through D1.
4. Compare in-memory and D1 projection results.
5. Test revocation and supersession across process restarts.

## 6. Conclusion

Schema validation: **PASS on SQLite-compatible SQL**.
D1 adapter: **NOT_IMPLEMENTED**.
D1 transaction verification: **NOT_TESTED**.
