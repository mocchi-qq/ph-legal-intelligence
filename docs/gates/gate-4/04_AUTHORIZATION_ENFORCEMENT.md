# Gate 4 — Authorization Enforcement

**Date:** 2026-11-13
**Implementation:** `packages/legal-ingestion/src/authorization.ts`, `pipeline.ts`, `acquisition.ts`
**Migration:** `migrations/d1/0004_gate4_activity_authorization.sql`
**Tests:** `tests/legal-data/authorization-activity.test.ts` (16), `authorization-pipeline.test.ts` (15), `tests/integration/gate4-migration.test.ts` (7)

## 1. What existed before Gate 4

Gate 1/2 enforced a **source-level** gate: non-synthetic ingestion required `authorizedSourceIds` or an owner-authorization reference. Acquisition similarly required a source `AuthorizationRef` in `AUTHORIZED` or `AUTHORIZED_WITH_CONDITIONS` with an evidence reference. This was necessary but coarse: one source state did not distinguish viewing from storage, indexing, AI processing, display or redistribution.

## 2. What Gate 4 adds

### 2.1 Activity registry

`ActivityAuthorizationRegistry` records one append-only decision per `(sourceId, activity)`. Each decision carries status, basis, evidence reference, evidence location, counsel decision reference, reviewer, decision date, conditions, expiry and notes.

Accepted statuses: `UNKNOWN`, `NOT_REVIEWED`, `REVIEW_REQUIRED`, `AUTHORIZED`, `AUTHORIZED_WITH_CONDITIONS`, `RESTRICTED`, `PROHIBITED`.

Fail-closed rules:

- No decision → deny (`no_decision_recorded`).
- `UNKNOWN`, `NOT_REVIEWED`, `REVIEW_REQUIRED` → deny.
- `RESTRICTED`, `PROHIBITED` → deny.
- `AUTHORIZED` → allow only if the decision had evidence, reviewer and date at record time.
- `AUTHORIZED_WITH_CONDITIONS` → allow only when every recorded condition is supplied as satisfied.
- Expired decision → deny.
- Basis not accepted by the caller → deny. Strict ingestion accepts `COUNSEL_DETERMINATION` only.
- A later decision supersedes earlier ones for checks; earlier decisions and audit events remain.

### 2.2 Ingestion

`ingestArtifact` uses strict activity enforcement by default for non-synthetic artifacts. The legacy coarse gate is unavailable unless the caller explicitly sets `allowLegacySourceGate: true` (used only by the bounded internal pilot). Strict mode requires `activityAuthorization` and an allowed decision for:

1. `temporary_processing`
2. `persistent_storage`
3. `text_extraction`
4. `search_indexing`

A missing registry, a missing decision, an owner-basis decision in counsel-only mode, a revoked decision or an expired decision all return `FAILED` before any derived record is written. The corpus is not mutated on failure; the failed run is recorded.

Synthetic fixtures bypass the legal-source gate by design (they are not legal sources) and still require a `synthetic://` locator.

### 2.3 Acquisition

`buildAcquisitionRecord` uses the same strict default. For non-synthetic input it requires an allowed `downloading` decision; a legacy path requires explicit `allowLegacySourceGate: true` and the existing source-level `AuthorizationRef`. In strict mode the activity decision is the authority and the legacy state is not required. A source approved for viewing cannot acquire merely because the source-level state is set.

### 2.4 Retry, background and alternate paths

- Retries re-run the same checks; a revoked or expired decision blocks the retry and leaves the corpus unchanged.
- No background job, queue or crawler exists in the repository, so there is no unaudited background ingestion path.
- The acquisition manifest path and the ingestion pipeline both check the registry in strict mode. Transport (`fetchLegalDocument`) is a raw fetch primitive and is not an ingestion path; it is still gated by URL/SSRF guards and must be followed by a guarded acquisition/ingestion call.
- The legacy owner-authorized pilot path remains available only with an explicit `allowLegacySourceGate: true`. It is explicitly not counsel authorization and is not a route to a production corpus.

## 3. Migration 0004

Additive only. It creates:

- `source_activity_authorizations` — one decision row per source/activity event, with CHECK constraints requiring evidence, reviewer and date for `AUTHORIZED`, `AUTHORIZED_WITH_CONDITIONS` and `RESTRICTED`; conditions JSON required for conditional authorization; counsel reference required for counsel-basis `AUTHORIZED`.
- `source_authorization_audit` — append-only audit events with previous status, new status, actor, role, timestamp, decision reference, evidence, conditions and reason.
- Indexes for source/activity history and audit lookup.
- Additive `ingestion_runs` columns `authorization_decision_ref`, `authorization_decision_refs` (all required decisions) and `authorization_basis_detail`, linking a strict run to the exact activity decisions and their basis without changing the legacy enum.
- `BEFORE UPDATE` / `BEFORE DELETE` triggers that `RAISE(ABORT)` on both tables.

The migration is additive and does not rewrite 0001–0003. It has not been applied to a live D1 database in Gate 4; the repository test verifies its static structure. The in-memory registry is the executable enforcement model.

## 4. Test evidence

| Test                             | Behaviour                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorization-activity.test.ts` | Viewing ≠ downloading; downloading ≠ storage/redistribution; extraction ≠ AI; embedding and display independent; UNKNOWN/RESTRICTED/PROHIBITED deny; conditions; expiry; revocation; missing evidence/reviewer/counsel reference; append-only audit; owner basis rejected in counsel mode; readiness blockers |
| `authorization-pipeline.test.ts` | Missing registry; one missing activity; owner basis rejected; full counsel set succeeds; revocation blocks retry without corpus mutation; synthetic bypass; legacy owner path preserved only with explicit `allowLegacySourceGate`; acquisition fails without registry or when downloading is prohibited      |
| `gate4-migration.test.ts`        | Additive migration; tables; 14 activities; 7 statuses; evidence/conditional CHECKs; append-only triggers                                                                                                                                                                                                      |

All 38 Gate 4 tests pass. The full suite is **315 passed, 1 skipped** (37 files, 316 tests).

## 5. Residual limitations

- The legacy owner path is not removed. It is bounded to the existing four-document internal pilot and is labelled as owner risk acceptance; it is not counsel authorization and must not be used for new sources.
- Strict activity enforcement is the default. The legacy coarse gate remains behind an explicit `allowLegacySourceGate: true` for the existing internal pilot; it is documented and not used by the Gate 4 strict tests except to prove the legacy path still works.
- The in-memory registry has no D1 adapter. The SQL is the schema of record; decisions do not survive a process restart. The in-memory registry is a reference/test implementation, not a production authorization store. No production ingestion service exists.
- OCR is not in the required ingestion activity list because `ALLOWED_MIME` currently rejects PDF and image input before extraction. Expanding the MIME allowlist requires adding `ocr` to `REQUIRED_INGEST_ACTIVITIES` first; a test now asserts that PDF input is rejected before any OCR path.
- No authentication, tenancy, background worker or production ingestion service exists to test.
- An `AUTHORIZED` record with a counsel basis requires a counsel reference, but the project cannot verify the professional standing of the signer. That verification is an operational control, not a software check.
