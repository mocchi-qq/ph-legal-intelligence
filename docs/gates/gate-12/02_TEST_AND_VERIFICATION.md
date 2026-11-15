# 02 — Test and Verification Results

**Date:** 2026-11-15
**Baseline:** `71365a7` (Gate 11) — 619 tests: 610 pass, 0 fail, 9 skipped.
**Final:** **642 tests — 633 pass, 0 fail, 9 skipped.**

| Check                | Baseline                  | Final                                 |
| -------------------- | ------------------------- | ------------------------------------- |
| Test files           | 63 (61 passed, 2 skipped) | 65 (63 passed, 2 skipped)             |
| Tests                | 619 (610 pass, 9 skip)    | **640 (631 pass, 9 skip)**            |
| Build (`pnpm build`) | exit 0                    | exit 0                                |
| Biome                | 0 errors                  | 0 errors                              |
| Gate 12 tests        | —                         | 21 (17 projection, 4 bridge/verifier) |

## 1. The two doors that were open

**Unchecked authorization read as authorization.** `projectAuthorityState` special-cased
only `UNAUTHORIZED`. `NOT_CHECKED` fell through every guard and produced the same
result as `AUTHORIZED`, which is how the test helper in
`tests/authority/authority-core.test.ts` had been written: it defaulted to
`NOT_CHECKED` and asserted determined, non-abstained results.

**Only the target was authorized.** `authorization` was one scalar applied to the
requested document. An `EffectAssertion` carries its own `sourceDocumentId` — the
instrument claiming the effect — and nothing checked it, so an assertion derived
from an unauthorized source could ground a determination about an authorized
target.

## 2. What the tests prove

**Target gating** (`tests/authority/gate12-authorization.test.ts`)

- `NOT_CHECKED` → `UNKNOWN`, `missing: ["AUTHORIZATION_NOT_CHECKED"]`,
  `abstained: true`, never `DETERMINED_WITH_REVIEWED_EVIDENCE`;
- `UNAUTHORIZED` → unchanged (`UNAUTHORIZED`, `NOT_AUTHORIZED`, `abstained: false`);
- `AUTHORIZED` → determined, matching a full-object expected literal, so a scalar
  caller's behaviour is pinned rather than assumed;
- untyped junk fails closed: `"authorized"`, `""`, `() => undefined`;
- `queryAuthorityAsOf` with `NOT_CHECKED` → `UNKNOWN`, abstained;
- a non-deterministic resolver (authorizes on its first call, denies after) is
  consulted once per source document, so two assertions from one source cannot be
  split between kept and dropped inside a single projection.

**Source gating**

- a resolver authorizing only the target drops an assertion sourced from another
  document and records `SOURCE_AUTHORIZATION_NOT_CHECKED:<assertionId>`;
- `UNAUTHORIZED` for the source records `SOURCE_NOT_AUTHORIZED:<assertionId>`;
- every candidate dropped → `UNKNOWN`, abstained, all codes present;
- mixed survivors → the determination is made from the survivors and the dropped
  codes ride in `missing`, so the answer states what was excluded;
- an unauthorized superseding assertion still suppresses the assertion it
  supersedes (supersession is computed before gating), leaving `UNKNOWN` rather
  than resurrecting a superseded effect.

**End to end** (`tests/authority/gate12-bridge-auth.test.ts`)

- `createAuthorityStatusLookup(store, { authorization: "NOT_CHECKED" })` →
  verifier layer 4 fails, `authorityStatus.outcome` is `UNKNOWN`;
- `"UNAUTHORIZED"` → layer 4 fails, outcome `UNAUTHORIZED`;
- `"AUTHORIZED"` → layer 4 passes, `temporalSource: "authority_projection"`
  (the control proving the fix did not break the happy path);
- a resolver that leaves the assertion's source uncheckable → layer 4 fails with
  `SOURCE_AUTHORIZATION_NOT_CHECKED:a1` visible in the status.

## 3. Tests changed, and why

`tests/authority/authority-core.test.ts` — two lines:

- the `project()` helper default `"NOT_CHECKED"` → `"AUTHORIZED"`;
- the determinism test's request `"NOT_CHECKED"` → `"AUTHORIZED"`.

Both were asserting projection _logic_ while passing an authorization state that,
after this gate, correctly refuses to project. Passing `AUTHORIZED` explicitly
restores the original intent — the projection is being tested, not the
authorization gate — and keeps the assertions meaningful. No assertion was deleted
or weakened, and `authority-core` still fails if the old fall-through is
reintroduced, because the new gate tests assert the `NOT_CHECKED` outcome directly.

## 4. What is not proven

- **No activity-level authorization.** A decision is per document, not per
  `(document, activity)` pair; the 14-activity matrix is not consulted here.
- **D1 remains shim-validated**; no remote D1 or workerd run.
- The projection is pure and trusts the snapshot it is given: a caller that
  prepares a snapshot with assertions it should not have does not get them
  authorized, but the snapshot contents themselves are not re-validated here.
- No real corpus, no counsel determination, no authorization change.
