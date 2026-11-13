# Gate 6 — Independent Review

**Review date:** 2026-11-13
**Repository:** `/root/ph-legal-intelligence`
**HEAD under review:** `405a350` plus Gate 6 working-tree changes
**Reviewers:** two independent read-only reviews (NVIDIA-backed, no write access) plus one remediation verification pass.
**Scope:** taxonomy, call-path inventory, temp-storage gate, reindex gate, D1 design/validation, projection/revocation, evidence, retention, tests.

## 1. Verdict

**Engineering and security: ACCEPTED WITH LIMITATIONS.**
**Counsel determinations: 0.** No authorization was created or promoted.

Both reviews found **no material findings**. Four minor observations were dispositioned; the validation-trigger and wording corrections were verified.

## 2. Review 1 — Authorization completeness

Checked the 16/14 reconciliation, every implemented content path, temp-local-storage enforcement, reindex enforcement, source/document/activity matching, expiry/revocation, future boundaries and fail-closed tests.

**Result: NO MATERIAL FINDINGS.**

Minor observations:

1. Coverage wording said "empty index on denial"; actual behaviour is per-document filtering. **Corrected** in `02_ENFORCEMENT_COVERAGE.md` and JSON.
2. Temp-storage and reindex denials are not centrally audited. **Disclosed** as a residual gap.
3. Retention has no policy/gate. **Disclosed**.
4. No production reindex service exists; the function boundary is the gate. **Disclosed**.

## 3. Review 2 — Persistence and security

Checked D1 honesty, migration constraints/triggers, transaction evidence, append-only history, evidence availability, projection/cache, conflicts/expiry, revocation/retention and overclaims.

**Result: NO MATERIAL FINDINGS.**

Minor observations and disposition:

1. Migration 0005 used string date comparison without format enforcement. **Corrected** by additive migration 0006 ISO-date validation triggers.
2. 0005 hash CHECK was length-only, not hex. **Corrected** by migration 0006 hex validation.
3. 0005 JSON fields were not JSON-validated. **Corrected** by migration 0006 array validation.
4. `document_scope_json` had no JSON validity constraint. **Corrected** by migration 0006.

Migration 0006 is additive; it does not rewrite 0001–0005.

## 4. Remediation verification

A third read-only pass verified:

- migration 0006 validates JSON arrays, hex hashes and ISO dates;
- the SQLite test covers malformed JSON/hash/date rejection;
- IDX/REI wording is per-document filtering;
- prior material findings remain at none;
- no new defect was introduced.

## 5. Adverse checks

| Check                                           | Finding                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 16/14 taxonomy silently merged                  | No. Canonical 16; Gate 4 14 preserved; two extended activities documented.                                                                  |
| Implemented path without authorization          | No. Acquisition, ingestion, in-memory, persistent storage, extraction, indexing, temp local storage and reindexing are gated before access. |
| Temp storage inferred from in-memory permission | No. Tests deny `temporary_processing`-only for temp storage.                                                                                |
| Reindex authorized by prior indexing            | No. Reindex requires current projections; revocation empties the index.                                                                     |
| Legacy bypass                                   | No. Default fails closed; legacy requires explicit opt-in.                                                                                  |
| D1 claimed operational                          | No. Adapter not implemented; live D1 not tested; blocker documented.                                                                        |
| D1 transaction atomicity claimed                | No. SQLite rollback tested; D1 batch semantics explicitly unverified.                                                                       |
| Append-only history mutable                     | No. SQLite triggers reject update/delete; repository returns copies.                                                                        |
| Evidence overclaimed                            | No. Optional availability checker denies; no evidence store exists.                                                                         |
| Revocation deletes content                      | No. Revocation blocks projection; test confirms synthetic content remains.                                                                  |
| Unimplemented features claimed enforced         | No. Marked NOT_IMPLEMENTED in taxonomy/coverage.                                                                                            |
| Synthetic data promotes real sources            | No. All fixtures use synthetic source IDs; 350 real cells remain UNKNOWN.                                                                   |
| New real document acquired/processed            | No. Zero new documents; pilot hashes unchanged.                                                                                             |
| Deployment/push                                 | None.                                                                                                                                       |

## 6. Residual limitations

1. No live D1 adapter; Wrangler local D1 cannot start in this PRoot host (TCMalloc OOM).
2. No D1 transaction/batch verification.
3. Temp-storage and reindex denials are not centrally audited.
4. Display, quotation, substantial reproduction, export, commercial use, retention, deletion, admin and background paths are not implemented.
5. No evidence store; availability is an optional operational hook.
6. No authentication/tenancy/OCR/semantic retrieval/reranking/deployment.
7. Counsel determinations remain zero.

## 7. Conclusion

The implemented content paths are fail-closed and independently reviewed. The durable registry is schema-validated but not adapter-validated. Gate 6 is accepted with these explicit limitations and does not authorize ingestion.

**Disposition:** ACCEPTED WITH LIMITATIONS.
