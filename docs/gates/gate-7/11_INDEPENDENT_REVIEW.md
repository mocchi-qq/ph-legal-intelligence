# Gate 7 — Independent Review and Remediation

**Date:** 2026-11-14
**Reviewers:** two read-only reviewers, both from a different model provider than
the author. No reviewer could modify files.
**Scope:** Review 1 — persistence and transaction integrity. Review 2 —
authorization and security.

Findings are recorded with their disposition. Nothing was suppressed to reach a
verdict; the verdict is `BLOCKED` regardless.

## Review 1 — Persistence and transaction integrity

| ID    | Severity | Finding                                                                                                                                                                 | Disposition                                                                                                                       |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R1-01 | BLOCKER  | Separate `REVOKED` and `SUPERSEDED` partial unique indexes still allowed both terminal events to coexist for one determination; revocation and supersession could race. | **FIXED**                                                                                                                         |
| R1-02 | BLOCKER  | `appendTerminalEvent` did not explicitly detect the _other_ terminal action, so a race produced a raw constraint error (or, before R1-01, two events).                  | **FIXED**                                                                                                                         |
| R1-03 | MAJOR    | `loadState` reads all professionals unscoped.                                                                                                                           | **ACCEPTED** — professionals are global, the table is small, and adding `source_id` would be wrong modelling. Documented in code. |
| R1-04 | MAJOR    | `auditTrail()` without a filter read the entire audit table.                                                                                                            | **FIXED** — hard cap 1000 rows, `limit` parameter, test added.                                                                    |
| R1-05 | MAJOR    | Error classification relies on message strings, which can change.                                                                                                       | **MITIGATED** — additional patterns and case-insensitive matching; residual risk recorded.                                        |
| R1-06 | MINOR    | `operationId` fallback used `Math.random()`.                                                                                                                            | **FIXED** — `crypto.getRandomValues` fallback plus a counter; `randomUUID` preferred.                                             |
| R1-07 | MINOR    | `Date.now()` fallback could collide in the same millisecond.                                                                                                            | **FIXED** — counter added.                                                                                                        |
| R1-08 | MINOR    | Migration 0008 has a foreign-key dependency on 0005 that was not stated.                                                                                                | **FIXED** — dependency documented in the migration header.                                                                        |
| R1-09 | MINOR    | `context_json` validation depends on SQLite JSON1.                                                                                                                      | **ACCEPTED** — D1 includes JSON1; no action.                                                                                      |
| R1-10 | NIT      | `revision` counts audit events, so it over-invalidates.                                                                                                                 | **ACCEPTED** — monotonic over-count is harmless.                                                                                  |
| R1-11 | NIT      | `registryStatus` is `null` when no determination exists.                                                                                                                | **ACCEPTED** — column is nullable by design.                                                                                      |
| R1-12 | NIT      | A test drops a trigger to simulate corruption.                                                                                                                          | **ACCEPTED** — deliberate; demonstrates defence in depth.                                                                         |

Reviewer confirmed clean: contract satisfaction, parameterized SQL, commit-marker
ordering, payload-hash soundness, idempotency, append-only enforcement, no
swallowed errors that become allows.

### Verification of R1-01 / R1-02

- Migration 0008 now creates `ux_counsel_audit_single_terminal` over
  `action IN ('REVOKED','SUPERSEDED')`. One terminal slot per determination.
- `appendTerminalEvent` queries existing terminal events and returns
  `cannot_revoke_superseded` / `cannot_supersede_revoked` before hitting the index.
- New test: concurrent `revoke` + `supersede` via `Promise.allSettled` → exactly
  one fulfilled, exactly one terminal row.
- Migration test now asserts that `SUPERSEDED` after `REVOKED` throws.

## Review 2 — Authorization and security

| ID       | Severity | Finding                                                                                                                                    | Disposition                                                                                                                                                                                                                            |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-01    | BLOCKER  | `recordProjectionAudit` returned success when no audit service was supplied, so reindex/temp-storage could be authorized without a record. | **FIXED** — missing service now denies with `authorization_audit_unavailable`; test added; existing callers updated.                                                                                                                   |
| R2-02    | MAJOR    | TOCTOU: a grant returned before a revocation can be acted on afterwards.                                                                   | **ACCEPTED WITH CONTROL** — no cache; every decision re-reads state; `evaluatedAt` + `registryRevision` are returned; contracts require re-authorization before each content access. New test covers revocation between two decisions. |
| R2-03    | MAJOR    | Audit context denylist was not exhaustive; e.g. `legalOpinion` or `documentSummary` could carry prose.                                     | **FIXED** — exact-key + substring denylist (`opinion`, `advice`, `privilege`, `confidential`, `excerpt`, `summary`, `content`, credentials), key length cap, broader document-pattern regex. Test added.                               |
| R2-04    | MINOR    | `AVAILABLE_UNVERIFIED` name could mislead.                                                                                                 | **ACCEPTED** — the state name is mandated by the gate; documentation and tests state it is non-approving.                                                                                                                              |
| R2-05    | MINOR    | Legacy coarse gate (`allowLegacySourceGate`) is an escape hatch.                                                                           | **ACCEPTED (pre-existing)** — requires two explicit flags, is outside Gate 7 scope, and default behaviour remains fail-closed. Recorded as a Gate 8 candidate.                                                                         |
| R2-06    | MINOR    | `enforceActivityAuthorization` defaults to undefined, which is fail-closed but inverted.                                                   | **ACCEPTED (pre-existing)** — behaviour denies; changing the default is a Gate 4 API change, out of scope.                                                                                                                             |
| R2-07    | NIT      | A sync sink returning a promise is discarded after being caught.                                                                           | **ACCEPTED** — defence in depth; the operation is denied and the rejection is observed, not unhandled.                                                                                                                                 |
| R2-08    | NIT      | Fallback IDs were not crypto-secure.                                                                                                       | **FIXED** — `getRandomValues` fallback.                                                                                                                                                                                                |
| R2-09–14 | CLEAN    | No silent D1→memory fallback; projection parity; audit coverage; evidence non-approval; synthetic isolation; strict gate.                  | Verified.                                                                                                                                                                                                                              |

### Verification of R2-01

`authorizeTemporaryLocalStorage(repo, request)` with no audit context now returns
`{ allowed: false, reason: "authorization_audit_unavailable" }`. Ten existing test
call sites were updated to pass an in-memory audit service; no production caller
exists. New regression test asserts the denial.

## Remediation verification

| Check                    | Result                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Full suite               | 448 tests, 446 pass, 1 pre-existing fail, 1 skip                |
| Gate 7 new tests         | 66, all pass                                                    |
| `pnpm build`             | exit 0                                                          |
| `npx biome check .`      | 0 errors, 74 warnings                                           |
| Concurrent terminal race | one winner, one terminal row                                    |
| Missing audit service    | denied                                                          |
| Migration re-run         | 0007/0008 idempotent; full history not re-runnable (documented) |

## Verification added after the reviews

`tests/integration/gate7-d1-remote.test.ts` and the remote execution in `01` were
added after both reviews closed. They are test-only and do not change the reviewed
production code paths, but they are **not covered by the two independent
reviews**. This is recorded in `gate-7-status.json` rather than implied.

## Remaining risk (not remediable in this gate)

1. **Workers binding `batch()` is unverified.** Actual D1 was verified through the
   HTTP API with sequential statements; safe recovery is proven, batch atomicity
   is not, and the design does not rely on it.
2. `classify()` depends on error text until binding-level error codes can be
   inspected.
3. A caller that ignores `allowed: false` is outside the gate's enforcement.
4. The audit service is optional in signatures; at runtime absence denies, but a
   future caller could still forget to pass it and then see a denial rather than a
   grant — safe, but operationally noisy.
5. The remote test file was not independently reviewed.
