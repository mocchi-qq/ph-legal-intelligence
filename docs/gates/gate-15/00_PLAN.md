# 00 — Gate 15 Plan: End-to-End Readiness Rehearsal

**Date:** 2026-11-16
**Baseline:** `3cc2dc9` (Gate 14), clean, 711 tests.
**Scope:** synthetic only. No migration, no schema change, no real document.

## 1. Why this gate

Gate 13 recommended corpus readiness and named its legal blocker. Gate 14 closed
the last authorization bypass in the retrieval path. What has never been
demonstrated is the **whole chain in one place**:

    authorise → acquire → ingest → extract → index → retrieve → verify

Each stage is tested in isolation, and the verifier was tested against a seeded D1
store, but nothing runs the chain end to end. That is exactly what a corpus-readiness
gate will have to show before the first real document is touched, so rehearsing it on
synthetic material now removes integration risk from the legal step.

The rehearsal also has to demonstrate the **refusals**, not just the happy path:
every stage must fail closed when its activity is not authorized.

## 2. Deliverable

`tests/integration/gate15-readiness-rehearsal.test.ts` — one integration test file,
plus a results document. No production code change is expected; if the rehearsal
finds a real integration gap, that gap is the finding and is recorded rather than
papered over.

## 3. The chain, step by step

| Step      | Call                                                                 | What must hold                                                                                                      |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| authorize | real `ActivityAuthorizationRegistry` + `createRegistryAuthorization` | only the four ingestion activities and `citation_display`/`search_indexing` are recorded, basis `SYNTHETIC_FIXTURE` |
| acquire   | acquisition guard path                                               | refuses when `downloading` is not authorized                                                                        |
| ingest    | pipeline                                                             | refuses when any of `temporary_processing`, `persistent_storage`, `text_extraction`, `search_indexing` is missing   |
| index     | `buildSearchIndex` with the authorization                            | indexes only authorized documents; `excludedDocuments` names the rest                                               |
| retrieve  | `retrieve`                                                           | exact identifier resolves to the ingested document with a passage span and provenance                               |
| verify    | `createCitationVerifier` + `createAuthorityStatusLookup` + D1 shim   | a reviewed, confirmed effect yields a passing layer 4; an unauthorized or unreviewed one does not                   |

## 4. Refusal matrix

For each stage, one case with the decision removed or prohibited, asserting the
specific refusal:

1. acquisition without `downloading` → refuses, and nothing is stored;
2. pipeline without `text_extraction` → refuses, and no chunks exist;
3. index build without `search_indexing` → 0 entries, document in `excludedDocuments`;
4. projection without an authorization input → `AUTHORIZATION_INPUT_MISSING`;
5. projection with a target `NOT_CHECKED` → `UNKNOWN`, abstained, layer 4 fails;
6. verifier with an unauthorized source document → layer 4 fails with the
   `SOURCE_*` code.

## 5. Acceptance

- The happy path completes and produces a verified citation from a synthetic
  document, with each intermediate artifact asserted (document, version, chunks,
  index entry, search result, verification result).
- Every refusal in §4 is asserted with its specific code or outcome, and the
  assertion names the stage that refused.
- No real document, no counsel record, no authorization cell changed.
- Full suite green; build exit 0; Biome 0 errors.
- If an integration gap is found, it is reported as a finding with evidence and this
  gate's verdict says so.

## 6. Non-goals

No new production API, no migration, no read-time authorization, no real corpus, no
deployment.
