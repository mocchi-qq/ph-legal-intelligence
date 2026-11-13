# Gate 5 — Independent Review

**Review date:** 2026-11-13
**Repository:** `/root/ph-legal-intelligence`
**HEAD at review:** `7a5c9d1` plus Gate 5 working-tree changes
**Reviewers:** two independent read-only reviews (NVIDIA-backed, no repository write access), plus a remediation verification pass.
**Scope:** counsel packet, canonical inventory, provenance model, durable registry, lifecycle audit, authenticity/date governance, intake workflow, code, migration, tests and working-tree state.

## 1. Verdict

**Engineering and governance: ACCEPTED WITH LIMITATIONS.**
**Counsel determinations: 0.** No real authorization exists.

The two reviews found **no material findings**. Five minor observations were dispositioned; one documentation clarification was applied and verified.

## 2. Review 1 — Legal governance readiness

Checked: packet usability, source-specific and activity-specific scope, 16 activities, first-review designation, Tier 1 preservation, evidence/conditions/identity/signature fields, ambiguity and silence handling, authenticity/date separation, and absence of invented legal conclusions.

**Result: NO MATERIAL FINDINGS.**

Minor observations and disposition:

1. Authenticity/legal-date fields were inventory-only, not in the counsel form. **Disposition:** added an explicit section stating authenticity and legal dates are separate and must not be certified in the reuse form unless separately engaged. Verified by remediation pass.
2. `sc_elibrary` worksheet questions were alleged to be identical to the template. **Disposition:** checked; they are the source-specific questions from the Gate 3 dossier. No change required.
3. The decision form did not ask counsel for authenticity/date assessments. **Disposition:** intentional; those are separate evidence tracks. Clarified in the form.

## 3. Review 2 — Engineering and security

Checked: decision provenance, identity/evidence completeness, hash caveat, source/activity/document isolation, conditions, effective/expiry, supersession, revocation, conflicts, projection and override, immutability/audit, duplicate IDs, atomicity, migration constraints/triggers, legacy bypass, denial tests, synthetic isolation, and persistence claims.

**Result: NO MATERIAL FINDINGS.**

Minor observations and disposition:

1. Hash validation checks format only. **Disposition:** documented as format-only; the docs already state a hash proves bytes, not identity. Comment added.
2. `Date.parse` has cross-runtime quirks. **Disposition:** Node-only environment; dates are validated at recording and projection. No change.
3. Conditions-unmet sync exception needed a comment. **Disposition:** comment added explaining that a conditional decision self-enforces and must not be converted into a prohibition.
4. `IF NOT EXISTS` can mask schema drift. **Disposition:** accepted for additive migrations; migration tests inspect the current schema.
5. D1 transaction atomicity is untested. **Disposition:** disclosed in `05_DURABLE_REGISTRY_ASSESSMENT.md`; no operational-persistence claim is made.

## 4. Remediation verification

A third read-only pass verified:

- the counsel form now separates authenticity/legal dates;
- the hash check is documented as format-only;
- the conditions-unmet exception is documented;
- no new defect was introduced;
- prior material findings remain at none.

## 5. Adverse checks

| Check                                            | Finding                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Invented counsel identities/opinions/signatures  | None. All fixtures are synthetic and labelled.                                                   |
| Invented approvals                               | None. Real decisions file is empty; 350 cells `UNKNOWN`.                                         |
| Source selected for review treated as authorized | No. `selected_for_initial_counsel_review` is explicitly non-authorizing.                         |
| Generic approval applied to all activities       | No. 16 activities are separate; omitted activities remain unresolved.                            |
| Downloading treated as storage/indexing/display  | No. Tests deny the inference.                                                                    |
| Synthetic data promoting a real source           | No. A synthetic determination for another source does not project to `sc_elibrary`.              |
| Hash treated as authenticity                     | No. Hash is file integrity only; authenticity remains `NOT_VERIFIED`/`SECOND_SOURCE_UNVERIFIED`. |
| Dates inferred                                   | No. All nine date fields remain `UNKNOWN`.                                                       |
| Revocation leaving stale authorization           | No. Projection sync appends a `PROHIBITED` override; test passes.                                |
| Expiry ignored                                   | No. Projection and Gate 4 checks deny after expiry.                                              |
| Conflicts silently resolved                      | No. Multiple active determinations for the same source/activity deny.                            |
| History mutable                                  | Repository returns copies; SQL has append-only triggers on all Gate 5 tables.                    |
| Duplicate determinations                         | Rejected by ID; duplicate activity rejected.                                                     |
| Partial record on failure                        | Repository validates before mutation; test asserts no record/event added.                        |
| Legacy bypass                                    | Default fails closed; legacy path requires explicit `allowLegacySourceGate`.                     |
| D1 persistence overclaimed                       | No. Adapter is `NOT_IMPLEMENTED`; docs and status JSON say so.                                   |

## 6. Residual limitations

1. No real counsel determination; no authorized source or activity.
2. No D1 adapter or live transaction test; the repository is in-memory.
3. Temporary local storage and reindexing of existing content have no activity gate.
4. Display, quotation, substantial reproduction, redistribution, commercial use and retention have no runtime gate because they are not implemented.
5. Evidence-file availability is an operational control, not a runtime check.
6. Revocation does not delete stored content; no retention policy exists.
7. No production ingestion, authentication, tenancy, OCR, semantic retrieval, reranking or deployment.

## 7. Review conclusion

Gate 5 is ready to receive and safely structure real counsel determinations, with the disclosed limitations. It does not create, imply or substitute for legal authorization.

**Engineering/governance disposition:** ACCEPTED WITH LIMITATIONS.
**Counsel determination status:** NOT_RECEIVED (0).
