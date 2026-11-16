# 01 — Rehearsal Results

**Date:** 2026-11-16
**Run:** `tests/integration/gate15-readiness-rehearsal.test.ts` — 12 tests, all
passing.
**Full suite:** 723 tests — 714 pass, 0 fail, 9 skipped.

## 1. The chain, with what was actually observed

Synthetic material only: source `SYNTH-SRC-1`, documents `SYNTH-ACT-1001` and one
unrelated document, fixed clock `2026-11-16T00:00:00Z`, fixed as-of `2026-08-01`,
`.invalid` URLs, no network, in-memory corpus.

| Step      | Observed                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authorize | six `SYNTHETIC_FIXTURE` decisions recorded for the source; `createRegistryAuthorization` returns `AUTHORIZED` for each `(document, activity)`                                                                                 |
| acquire   | `buildAcquisitionRecord` succeeds with `authorizationRecordRef = auth_synthetic_fixture_downloading_1` and a sha256 content hash                                                                                              |
| ingest    | `ingestArtifact` completes: **1 document, 1 current version, 2 chunks with spans**, run recorded with four decision refs                                                                                                      |
| index     | `buildSearchIndex` → `total === chunks.length`; the unrelated document appears in `excludedDocuments` with `no_decision_recorded`                                                                                             |
| retrieve  | the exact-identifier query and a content query both return the ingested document first, with a non-null `span` and a `provenance` object naming source, document, version and chunk                                           |
| verify    | through `createAuthorityStatusLookup` over the SQLite D1 shim: `VERIFIED`, `temporalValidity: true`, `temporalSource: "authority_projection"`, `authorizationSource: "document_activity"`, `state: "IN_FORCE"`, `missing: []` |

The document, version and chunks used for indexing and retrieval are the ones the
ingestion step produced, not a parallel fixture — that is the point of the exercise.

## 2. Refusals, with the exact codes observed

| Stage      | Condition                                          | Observed                                                                                                                                     |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| acquire    | no `downloading` decision                          | `activity_not_authorized:downloading:no_decision_recorded`; corpus has no document, no run, no chunk                                         |
| ingest     | no `text_extraction` decision                      | `activity_not_authorized:text_extraction:no_decision_recorded`; no documents, versions or chunks; run `FAILED`                               |
| index      | no `search_indexing` decision                      | 0 entries, `total` 0, document in `excludedDocuments` with `NOT_CHECKED` / `no_decision_recorded`                                            |
| projection | neither authorization input                        | `UNKNOWN`, `["AUTHORIZATION_INPUT_MISSING"]`, abstained, empty trace — and the lookup itself throws `authorization_required` at construction |
| projection | target `NOT_CHECKED`                               | `UNKNOWN`, `["AUTHORIZATION_NOT_CHECKED", "activity:citation_display"]`, abstained, trace entry with `status: null`; verifier layer 4 false  |
| verify     | assertion source authorized only for `downloading` | layer 4 false, `missing` contains `SOURCE_AUTHORIZATION_NOT_CHECKED:SYNTH-ASSERT-1`                                                          |

## 3. What the rehearsal exposed

Four integration facts that no single-package test had shown. None is a regression
introduced by this gate; all predate it.

### 3.1 Ingestion does not write the authority ledger

The verified citation in §1 rests on a ledger that the rehearsal seeds separately:
the assertion, its evidence, the provision mapping and the review are recorded by
hand, using the ids the ingested document produced. `ingestArtifact` populates
documents, versions and chunks and stops there.

That separation is deliberate and matches the data-governance model — the claim that
one instrument amended another is an analysis finding recorded by a person, not
something to infer from a byte stream. What is missing is the analysis step's own
recorded contract and test. Until it exists, the chain has a seam between ingest and
verify, and this rehearsal is the only place where both sides appear together.

### 3.2 `retrieve` performs no authorization at all

The index enforces `search_indexing` when it is built. `retrieve` takes no
authorization and the built index is searchable by anyone holding it
(`packages/legal-search/src/retrieve.ts`). In the chain, `citation_display` is
enforced only when the citation is later _verified_ — the passage is returned and
displayed first. This is the one stage in the chain with no enforcement point, and it
is the same gap Gate 14 recorded as a limitation.

### 3.3 A caller-settable `synthetic: true` skips all four ingestion activities

`pipeline.ts` computes `strictActivityMode = !artifact.synthetic &&
enforceActivityAuthorization`, so a synthetic artifact skips the four activity
checks _and_ the legacy coarse gate. A guard exists: `synthetic: true` with a
`sourceUrl` that does not start `synthetic://` fails with
`synthetic_flag_without_synthetic_locator`.

So the bypass requires a caller to set both the flag and a `synthetic://` locator. In
this library the caller is the operator, and the audit trail records
`authorizationDecisionRefs: []` alongside basis `SYNTHETIC_FIXTURE`, so a reader can
see that no check occurred. It is a trust assertion, not a remote escalation — but it
does mean "synthetic" in the audit does not mean "checked", and a production caller
is one mislabelled flag away from ingesting unchecked material.

Recorded as a limitation with a recommended follow-up: either require registry
decisions for synthetic artifacts too (the registry already accepts
`SYNTHETIC_FIXTURE` as a basis, so nothing is lost), or record a distinct,
unambiguous basis detail such as `SYNTHETIC_EXEMPT` with a zero-decision marker.

### 3.4 The missing-input refusal is split across two layers

`createAuthorityStatusLookup` throws `authorization_required` at construction, so
`AUTHORIZATION_INPUT_MISSING` cannot be observed through the lookup — only by
calling `projectAuthorityState` directly. Both are fail-closed and tested; the
consequence is that a caller wired through the lookup gets an exception rather than
the machine-readable abstention.

## 4. What this does not prove

- Nothing about real Philippine law: every identifier is fictional.
- Nothing about D1 runtime: the shim is SQLite, as in every gate since 7.
- Nothing about correctness of any legal effect: the reviewed effect in the ledger
  is synthetic and stated as such.
- No authorization cell was created or changed; all 350 remain `UNKNOWN`.
