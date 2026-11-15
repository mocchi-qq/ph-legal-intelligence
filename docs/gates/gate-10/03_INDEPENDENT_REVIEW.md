# 03 — Independent Review

**Date:** 2026-11-15
**Review:** one read-only pass over the verifier bridge and the D1 authority store.

## Findings and disposition

| ID  | Severity | Finding                                                                                                                                                                                                                  | Disposition                                                                                                                                                                                                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MAJOR    | No bridge existed; the documented example passed a provision-version id where the projection expects a provision-identity id, passed `null` instead of omitting the filter, and hardcoded `authorization: "AUTHORIZED"`. | **FIXED** — `createAuthorityStatusLookup(store, { authorization })` maps `provisionVersionId → provisionIdentityId`, omits the filter when absent, and requires the caller to choose authorization. End-to-end test added. |
| R2  | MAJOR    | Layer 4 ignored `abstained` and `VERSION_NOT_IN_EFFECT`, so a projection that said the version did not cover the date could still pass.                                                                                  | **FIXED** — pass requires `!abstained` and no `VERSION_NOT_IN_EFFECT`; matrix tests added.                                                                                                                                 |
| R3  | MAJOR    | Duplicate writes surfaced as `append_only_violation` for some tables and `duplicate_authority_record` for others.                                                                                                        | **FIXED** — all five record methods pre-check id and throw `duplicate_authority_record`; triggers remain defence.                                                                                                          |
| R4  | MAJOR    | Verifier tests used impossible projection combinations and skipped most fail-closed branches.                                                                                                                            | **FIXED** — 11-case outcome/state matrix plus legacy repealed-document failure.                                                                                                                                            |
| R5  | MINOR    | Cross-document supersession could resurrect a superseded assertion because the snapshot was scoped to one target.                                                                                                        | **FIXED** — `loadStateFor` also loads assertions that supersede in-scope ids; tested.                                                                                                                                      |
| R6  | MINOR    | FK/CHECK storage errors leaked raw SQLite text.                                                                                                                                                                          | **FIXED** — mapped to `unknown_reference` / `invalid_authority_record`.                                                                                                                                                    |
| R7  | MINOR    | Unbounded `IN (?, …)` lists could exceed D1's bound-parameter cap.                                                                                                                                                       | **FIXED** — ids chunked at 90.                                                                                                                                                                                             |
| R8  | NIT      | Headers said Gate 8 and claimed a call the adapter does not make.                                                                                                                                                        | **FIXED** — retitled Gate 10, wording corrected.                                                                                                                                                                           |

## Clean areas

- SQL is fully parameterized; no legal logic in SQL; no update/delete methods.
- Append-only enforced and tested, not assumed.
- Row→domain mapping complete for all five record types.
- Unknown document yields an empty snapshot (`UNKNOWN`, abstained), never a guess.
- No D1 runtime claim; the shim is labelled supplementary.

## Residual limitations

1. D1 validation is on `node:sqlite` only; no remote D1 or workerd run.
2. `loadStateFor` scopes one target at a time; multi-target conflict detection is
   the caller's responsibility.
3. The verifier's passage support remains the lexical proxy.
4. No real corpus or counsel determination.
