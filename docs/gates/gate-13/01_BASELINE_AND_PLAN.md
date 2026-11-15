# 01 — Baseline and Plan

**Date:** 2026-11-15
**HEAD:** `e834045` (`fix(gate12): fail closed on unchecked authorization and gate
assertions by source`).
**Gate 12 verdict:** ACCEPTED WITH LIMITATIONS.

## 1. Baseline verification (independently performed)

| Claim                               | Verified                                | Evidence                                       |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------- |
| HEAD is `e834045`                   | **yes**                                 | `git rev-parse HEAD`                           |
| Working tree clean                  | **no at first inspection**              | one modified file, see §1.1                    |
| 642 tests, 633 pass, 0 fail, 9 skip | **yes**, after reverting the stray edit | three consecutive runs                         |
| Build exit 0                        | yes                                     | `pnpm build`                                   |
| Biome exit 0                        | yes, after reverting                    | `npx biome check .`                            |
| No migration changed                | yes                                     | `0001`–`0009` present, `git status` clean      |
| Counsel determinations 0            | yes                                     | `docs/gates/gate-5/`, no determination records |
| 350 authorization cells `UNKNOWN`   | yes                                     | `docs/gates/gate-4/authorization-matrix.json`  |
| Four pilot documents blocked        | yes                                     | `docs/gates/gate-5/DECISION.md`                |

### 1.1 One discrepancy, resolved

The first inspection found `packages/legal-ingestion/src/authority-projection.ts`
modified but uncommitted: a half-finished activity-authorization attempt whose
comments were labelled "Gate 12", introducing an `enforceActivityAuthorization`
boolean (a bypass switch), an optional `activity` parameter, and a fallback that
checked all fourteen activities when none was named. It failed Biome formatting,
implemented neither per-source nor per-evidence authorization, and the suite still
passed — so nothing would have caught it.

It was reverted to `e834045` after confirming with the requester. It is not the
basis of this gate.

### 1.2 One flake, noted

A single full-suite run reported
`tests/authority/core.test.ts > returns UNKNOWN for a calendar date that does not
exist` failing. Three subsequent full runs were green, and the file passes in
isolation (40 tests). Recorded as observed once, not reproducible, not a Gate 13
blocker. Every Gate 13 run below reports its own count.

## 2. What Gate 12 left open

Authorization is decided per **document**. A caller says "this document is
authorized" and the projection accepts it for whatever the projection is doing.
The 14-activity matrix — the actual Gate 4 source of truth — is consulted only by
the ingestion pipeline and the acquisition path, never by authority projection or
citation verification. Consequently:

- a document authorised for `viewing` can be projected as if authorised for
  `search_indexing`;
- nothing records which activity a projection decision was made for;
- the projection cannot distinguish "a counsel decision says no" from "nobody has
  decided".

## 3. Design in one paragraph

A new module defines a typed `(documentId, activity, role) → decision` contract and
an adapter over the **existing** `ActivityAuthorizationRegistry` (no second source
of truth). The projection gains a required `activity` and accepts that resolver;
when supplied, the target document, every effect-assertion source document and
every evidence-bearing document are each resolved for that same activity,
independently, with a per-`(document, activity)` memo. Gate 12's bare scalar does
**not** survive: an independent review showed it authorised whatever activity the
request named, so the caller-asserted path is now a scoped
`{ activity, decision }` assertion that is refused when the activity differs, and a
registry-backed decision arrives as a full `DocumentActivityDecision`. The two are
labelled apart in the result. The verifier needs no change to its pass predicate:
an unspecified activity fails closed upstream.

## 4. Caller inventory

Every code path that supplies an authorization decision to authority projection or
verification, at `e834045`:

| Caller                                                             | Document checked                          | Activity required                                                                  | Current input                        | Required change                                                         |
| ------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| `projectAuthorityState` (target)                                   | `req.documentId`                          | not represented                                                                    | scalar or `(documentId) => decision` | require `activity`; accept `(doc, activity, role)`                      |
| `projectAuthorityState` (assertion source)                         | `assertion.sourceDocumentId`              | not represented                                                                    | same callback, same scalar           | resolve per source for the same activity                                |
| `projectAuthorityState` (evidence document)                        | `evidence.documentVersionId → documentId` | not represented                                                                    | not checked at all                   | resolve, record `EVIDENCE_*` codes                                      |
| `queryAuthorityAsOf`                                               | forwards to projection                    | not represented                                                                    | forwards                             | forward `activity`                                                      |
| `createAuthorityStatusLookup`                                      | target document                           | not represented                                                                    | scalar                               | require `activity`; accept document-activity resolver                   |
| `createCitationVerifier` layer 4                                   | via the lookup                            | not represented                                                                    | consumes `AuthorityStatusView`       | unchanged predicate; tokens gain provenance                             |
| `buildSearchIndex` (`legal-search`)                                | `documentId` per document                 | indexing                                                                           | caller-supplied `authorize` callback | out of scope; documented as a separate, unregistered gate               |
| Ingestion `pipeline.ts`                                            | `artifact.sourceId`                       | `temporary_processing`, `persistent_storage`, `text_extraction`, `search_indexing` | registry check                       | unchanged; no document-level path added                                 |
| Acquisition `acquisition.ts`                                       | `input.sourceId`                          | `downloading`                                                                      | registry check                       | unchanged                                                               |
| Temporary storage / text extraction / search indexing / reindexing | via pipeline                              | as above                                                                           | registry check                       | unchanged; reindexing has no separate activity (uses `search_indexing`) |

No HTTP route, worker entry point or background job calls the projection, so the
library is the entire surface.

## 5. Cards

| ID    | Card                                                                | Files                                                 | Depends on |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| G13-A | Document/activity contract + registry adapter + memoisation         | `document-activity-authorization.ts`, tests           | —          |
| G13-B | Projection: required activity, target/source/evidence gating, trace | `authority-projection.ts`, `temporal-query.ts`, tests | G13-A      |
| G13-C | Bridge + verifier end-to-end                                        | `authority-status-lookup.ts`, tests                   | G13-B      |
| G13-D | Test matrix (A–E), regression                                       | `tests/authority/gate13-*.test.ts`                    | A–C        |
| G13-E | Three independent reviews + remediation                             | `docs/gates/gate-13/13_*`                             | A–D        |
| G13-F | Deliverables, KANBAN, decision                                      | `docs/gates/gate-13/`                                 | all        |

## 6. Non-goals and invariants

- No real document acquired, read, extracted or indexed; synthetic fixtures only.
- No counsel determination created; all 350 cells remain `UNKNOWN`.
- No migration change unless the audit shows a schema gap; the registry already
  stores `(sourceId, activity, status, basis, conditions, expiresAt)`.
- Gate 12 behaviour preserved: `NOT_CHECKED` fails closed at every entry point,
  supersession resolves before gating, resolver decisions memoised, and the
  `projectUnchecked()` regression test retained.
- No push, no deployment.
