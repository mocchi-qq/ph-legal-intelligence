# 02 — Results

**Date:** 2026-11-17
**Baseline:** `1a61e2c` (Gate 18) — 826 tests, 817 pass, 9 skipped.
**Final:** **838 tests — 829 pass, 0 fail, 9 skipped.**

| Check            | Baseline       | Final                      |
| ---------------- | -------------- | -------------------------- |
| Tests            | 826 (817 pass) | **835 (826 pass, 9 skip)** |
| Test files       | 77 (75 passed) | 78 (76 passed, 2 skipped)  |
| Build            | exit 0         | exit 0                     |
| Biome            | exit 0         | exit 0, 0 errors           |
| New tests        | —              | 9                          |
| Fixtures updated | —              | 8 files                    |

## 1. The exemption is gone

A `synthetic: true` artifact now runs the same four activity checks as any other, and
`synthetic` only selects the accepted basis:

| Artifact | Accepted basis                    |
| -------- | --------------------------------- |
| real     | `COUNSEL_DETERMINATION` (default) |
| fixture  | `SYNTHETIC_FIXTURE` only          |

Proved by twelve tests in `tests/ingestion/gate19-synthetic-authorization.test.ts`:

- no registry → `activity_authorization_registry_missing`, no document, run records
  `null` refs and `null` basis detail rather than an empty list;
- three of four decisions → refused naming `search_indexing`, no document, one DENIED
  audit event with `no_decision_recorded`;
- four counsel determinations → refused `basis_not_accepted:COUNSEL_DETERMINATION`;
- four fixture decisions on a real artifact → refused
  `basis_not_accepted:SYNTHETIC_FIXTURE`;
- four fixture decisions → success, basis `synthetic_fixture`, detail
  `SYNTHETIC_FIXTURE`, four decision references;
- four `AUTHORIZATION_GRANTED` audit events in activity order;
- `synthetic` without a synthetic locator still refused for that reason, where a
  synthetic locator is `synthetic://` or a host under the reserved `.invalid` TLD
  (acquisition refuses non-HTTP schemes, and the rehearsal must exercise it);
- `synthetic: false` naming a `synthetic://` URL refused as contradictory;
- a real artifact asking to accept the fixture basis refused outright;
- `acceptedAuthorizationBases` ignored for a fixture.

## 2. The audit stopped claiming decisions it never consulted

`addRun` used to derive a basis and a reference from the artifact's flag:
`"synthetic_fixture"`, `"synthetic_fixture"`, `[]`. That read as an authorization and
was written on failures too. It now writes only what the checks produced, and `null`
when nothing was consulted.

## 3. Fixtures that had relied on the exemption

Eight files needed fixture decisions: the Gate 1 pipeline and security suites, the
benchmark helpers and two benchmarks, the Gate 4 enforcement suite, the Gate 6 counsel
suite, and the Gate 15 rehearsal (whose secondary source had been leaning on the
exemption — it is now authorized on its own registry, while the chain's shared registry
stays primary-only so the exclusion assertions still hold).

One test was genuinely obsolete: Gate 4's "does not gate synthetic fixtures on
legal-source authorization". Its premise was the behaviour this gate removed. It is
rewritten as "gates a synthetic fixture on fixture authorization, not the legal-source
gate", and now proves both halves: refused without a registry, accepted with fixture
decisions for a source that is deliberately absent from `authorizedSourceIds`, with
`SYNTHETIC_FIXTURE` recorded on the run. No other assertion was relaxed, deleted or
made vacuous.

## 4. What is still not proven

- **`SYNTHETIC_FIXTURE` remains a caller-declared basis.** The gate now refuses it for
  real artifacts and refuses counsel for fixtures, but it cannot verify that the
  content really is a fixture. That is why the basis is confined to ingestion here and
  why no legal conclusion rests on it.
- **The generic activity registry does not restrict which activity a
  `SYNTHETIC_FIXTURE` decision may cover.** The synthetic end-to-end chains need
  fixture decisions for `citation_display` to rehearse the whole path, and production
  `citation_display` authorization comes from counsel determinations through a
  different store. No fixture decision exists outside tests.
- **Still no remote D1, no workerd** (Gate 7 limitation), **no read-time
  authorization** (B-3).
- Nothing legal: 0 counsel determinations, 350 `UNKNOWN` authorization cells, four
  pilot documents `BLOCKED_AUTHORIZATION`, no real document touched.
