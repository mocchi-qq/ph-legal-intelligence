# Gate 4 — Independent Review

**Review date:** 2026-11-13
**Repository:** `/root/ph-legal-intelligence`
**Branch:** `main`
**HEAD under review:** `7e9824a` plus the Gate 4 working-tree changes
**Reviewers:**

1. Independent read-only reviewer (NVIDIA-backed, no repository write access), pass 1 and pass 2.
2. Lead engineering verification of every finding and remediation.
   **Scope:** source inventory, activity matrix, counsel packet, authenticity/date framework, enforcement code, migration, audit trail, readiness, tests and working-tree state.

## 1. Verdict

**Engineering: APPROVE WITH CORRECTIONS.**
**Gate 4 overall: BLOCKED** — no counsel determination exists, no source is authorized, and no document is ready for controlled ingestion.

The corrections below were applied after the review. The verdict does not claim legal authorization.

## 2. Independent verification performed

| Check                    | Result                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npx vitest run`         | 36 files passed, 1 skipped; **315 tests passed, 1 skipped** (37 files, 316 tests) |
| `pnpm build`             | exit 0                                                                            |
| `npx biome check .`      | exit 0; 0 errors, 59 warnings                                                     |
| Matrix                   | 25 sources × 14 activities = 350 cells; **0 non-UNKNOWN**                         |
| Decisions file           | empty; status `COUNSEL_DETERMINATION_PENDING`                                     |
| Counsel worksheets       | 25 source worksheets, 4 pilot sheets, 1 Tier 1 sheet                              |
| Pilot hashes             | all four match `PILOT_MANIFEST.json`                                              |
| Readiness                | 4 of 4 `BLOCKED_AUTHORIZATION`; 0 ready                                           |
| Migration                | 0001–0003 intact; 0004 additive; append-only triggers present                     |
| Unauthorized acquisition | 0 new documents in Gate 4                                                         |

## 3. Findings and remediation

### F-01 — CRITICAL — Strict activity enforcement was opt-in (corrected)

**Evidence.** `pipeline.ts` and `acquisition.ts` enforced activity permissions only when `enforceActivityAuthorization` was true. A caller that omitted it fell back to the coarse Gate 1/2 gate.

**Correction.** Strict activity enforcement is now the default for non-synthetic ingestion and acquisition. The legacy coarse gate is unavailable unless the caller explicitly sets `allowLegacySourceGate: true`; that flag is used only by the bounded internal pilot tests. A non-strict, non-legacy call fails with `activity_authorization_required`.

**Verification.** `authorization-pipeline.test.ts` asserts the default refusal for both ingestion and acquisition, and the explicit legacy path. Full suite passes.

### F-02 — CRITICAL — No persistence adapter for the activity registry (disclosed, not implemented)

**Evidence.** `ActivityAuthorizationRegistry` is in-memory. Migration 0004 defines the schema but no D1 adapter hydrates or appends decisions.

**Disposition.** The registry is now explicitly documented as a reference/test implementation, not a production authorization store. No production ingestion service exists; the SQL is the schema of record. This is a **disclosed limitation**, not a claim that persistence works. Implementing a D1 adapter is a controlled next-stage task, not something fabricated in Gate 4.

### F-03 — HIGH — OCR was not in the required activity list (corrected by gating MIME expansion)

**Evidence.** `REQUIRED_INGEST_ACTIVITIES` contained four text activities, not `ocr`. `ALLOWED_MIME` currently rejects PDF and image input.

**Correction.** PDF input is rejected before any OCR path; a test asserts `unsupported_mime:application/pdf`. The code documents that expanding `ALLOWED_MIME` requires adding `ocr` to the required list first. The matrix and registry continue to treat OCR as a separate activity.

### F-04 — HIGH — Strict runs could be labelled with the legacy basis (corrected)

**Evidence.** `addRun` used the legacy `authorizationBasis` expression and a single decision reference.

**Correction.** Strict runs now record `authorizationDecisionRef` (primary), `authorizationDecisionRefs` (all required decisions), and `authorizationBasisDetail` (`COUNSEL_DETERMINATION` / `OWNER_RISK_ACCEPTANCE` / `SYNTHETIC_FIXTURE`). Failed strict runs no longer fall through to a legacy basis. Migration 0004 adds the three columns additively.

**Verification.** Strict ingestion test asserts four decision references and the counsel basis; migration test asserts the three additive columns.

### F-05 — MEDIUM — RESTRICTED required the same evidence as AUTHORIZED (retained with rationale)

**Evidence.** Validation and SQL require evidence, reviewer and date for `RESTRICTED`.

**Disposition.** Retained. A restriction is itself a counsel determination that may later be relied on; a bare status without evidence would be unauditable. The rationale is now recorded in `02_ACTIVITY_AUTHORIZATION_MATRIX.md`.

### F-06 — MEDIUM — Counsel reference authenticity is not verified by code (disclosed)

**Evidence.** The code checks that `counselDecisionRef` is a non-empty string; it cannot verify a signature, professional standing or document existence.

**Disposition.** Documented as an operational control requiring human verification before a decision is recorded. No model or agent may substitute for it.

### F-07 — LOW — Decision IDs used a global counter (corrected)

**Correction.** IDs are now per `(sourceId, activity)` sequence, e.g. `auth_sc_elibrary_viewing_1`. An optional explicit audit timestamp is accepted and validated.

### F-08 — LOW — Audit timestamp used only the process clock (corrected)

**Correction.** `record()` accepts an explicit ISO `changedAt`; invalid values are rejected. It defaults to the process clock for local use.

## 4. Second-pass findings and remediation

The second independent pass reviewed the corrected code and found three further issues:

### G-01 — HIGH — A strict run linked only the first activity decision (corrected)

Strict ingestion now records **all** required decision references in `authorizationDecisionRefs` (four for the current text path), with `authorizationDecisionRef` retained as the primary reference.

### G-02 — MEDIUM — Acquisition stored the counsel/evidence string instead of the decision ID (corrected)

Strict acquisition now stores `check.decision.id` in `authorizationRecordRef`, matching the pipeline and the migration's decision-reference column. A test asserts the `auth_` prefix.

### G-03 — MEDIUM — Failed strict runs could be mislabelled with a legacy basis (corrected)

The legacy basis fallback is now bypassed whenever strict context is active. Failed strict runs record no legacy basis; the failure reason remains `activity_not_authorized:…`.

### G-04 — LOW — Flag naming (documented)

The absence of `enforceActivityAuthorization` does **not** mean legacy mode; it means fail closed with `activity_authorization_required`. Legacy mode requires an explicit `allowLegacySourceGate: true`.

A third read-only verification confirmed all three G-findings resolved with no new defect.

## 5. Adverse checks

| Check                                      | Finding                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Invented approvals                         | None. No decision row exists; all 350 cells `UNKNOWN`.                                                                                                                                                 |
| Implied authorization                      | None. Viewing/downloading/storage/indexing/AI/display are checked separately.                                                                                                                          |
| Generic approval applied to all activities | None. The matrix is per source and per activity.                                                                                                                                                       |
| Missing evidence                           | Not concealed. Every source records that terms are uncaptured and counsel is pending.                                                                                                                  |
| Incorrectly promoted statuses              | None. No source-level or activity-level status was changed.                                                                                                                                            |
| Untracked authorization changes            | None. No real decision was recorded; the runtime creates audit events for test decisions only.                                                                                                         |
| Mutable decision history                   | Runtime returns copies; SQL has append-only triggers on both tables.                                                                                                                                   |
| Retry bypass                               | Tested: revocation blocks retry and leaves the corpus unchanged.                                                                                                                                       |
| Background-job bypass                      | No background worker, queue or crawler exists.                                                                                                                                                         |
| Unsupported authenticity claim             | None. All four are `SECOND_SOURCE_UNVERIFIED`; hash integrity is labelled as file integrity only.                                                                                                      |
| Invented legal dates                       | None. All nine date fields are null/`UNKNOWN`.                                                                                                                                                         |
| Unverified second-source claim             | None. No second source was contacted.                                                                                                                                                                  |
| Tests that only assert success             | Denial paths are asserted for UNKNOWN, RESTRICTED, PROHIBITED, missing evidence, missing counsel ref, unmet conditions, expiry, revocation, owner-basis rejection, missing registry and legacy bypass. |

## 6. Residual limitations

1. No counsel determination; 0 of 25 sources and 0 of 350 activity cells authorized.
2. No authorized corpus; the four pilot documents are `BLOCKED_AUTHORIZATION`.
3. No D1-backed registry; decisions do not survive process restart.
4. No production ingestion service, authentication, tenancy or deployment.
5. No OCR, semantic retrieval, reranking or entailment model.
6. Counsel professional standing and signature verification are operational controls, not software checks.
7. The legacy owner path remains for the internal pilot only; it is not counsel authorization.

## 7. Review conclusion

The Gate 4 enforcement model is fail-closed by default, distinguishes activities, preserves append-only history, and refuses to promote UNKNOWN. The counsel packet is complete enough to request source-specific and activity-specific determinations. Gate 4 cannot accept a corpus because no determination exists.

**Engineering disposition:** APPROVE WITH CORRECTIONS.
**Gate 4 disposition:** BLOCKED on external counsel authorization.
