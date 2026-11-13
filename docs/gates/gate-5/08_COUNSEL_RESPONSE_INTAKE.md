# Gate 5 — Counsel Response Intake Workflow

**Date:** 2026-11-13
**Status:** workflow defined; no response has been received.

## 1. Purpose

This workflow records a real counsel response after it is received outside the application. A file upload, email or informal discussion is not authorization. No intake step may create an approval automatically.

## 2. Required steps

1. **Receive the original response.** Preserve the original email, letter, signed PDF or other record; do not transcribe over it.
2. **Preserve the original.** Store it read-only with a SHA-256, receipt date, sender and channel.
3. **Record receipt date and issuer.** Record who sent it, their capacity and how identity was established.
4. **Record source and activity scope.** Identify the exact source ID and documents; identify each activity and whether it is approved, conditional, restricted, prohibited or unresolved.
5. **Record counsel identity.** Name, firm, jurisdiction, capacity and verification evidence.
6. **Verify evidence.** Confirm signature/approval reference, professional standing where required, source terms and supporting documents.
7. **Manual structured entry.** A human enters the structured determination. No model interpretation is authoritative. Preserve the original alongside the entry.
8. **Independent review.** A second person reviews the structured entry against the original.
9. **Validate completeness.** Every activity must have an explicit decision or remain unresolved. Conditions, limitations and scope must be recorded.
10. **Record conditions and dates.** Record conditions, effective date, expiry/review date and permitted users/use cases.
11. **Approve for recording.** Only a complete, verified determination becomes `VERIFIED_FOR_RECORDING`.
12. **Audit.** Append the determination, activity rows and audit events; never rewrite an earlier decision.
13. **Re-evaluate readiness.** Re-run the source/document/activity readiness check; only the exact covered source and activities can change state.
14. **Escalate conflicts.** A conflict with an earlier determination, an ambiguous scope or a condition that cannot be enforced requires human escalation, not automatic resolution.

## 3. Status mapping

`NOT_RECEIVED` → `RECEIVED_UNVERIFIED` → `IDENTITY_UNVERIFIED` / `EVIDENCE_INCOMPLETE` / `SCOPE_AMBIGUOUS` / `REVIEW_REQUIRED` → `VERIFIED_FOR_RECORDING` → `SUPERSEDED` / `REVOKED`

`VERIFIED_FOR_RECORDING` is not universal authorization. A determination can still contain prohibited, restricted, conditional or unresolved activity decisions.

## 4. Handling common cases

| Response                                        | Handling                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Authorizes only some activities                 | Covered activities may be recorded; all others remain `UNKNOWN`/`UNRESOLVED`                                                             |
| Refers to a source generally without activities | `SCOPE_AMBIGUOUS`; clarification required                                                                                                |
| Includes conditions                             | `APPROVED_WITH_CONDITIONS`; conditions must be recorded and enforced                                                                     |
| Conflicts with an earlier determination         | Escalate; do not silently choose one                                                                                                     |
| Silent on an activity                           | That activity remains unresolved; silence is not consent                                                                                 |
| Verbal or informal                              | Not `VERIFIED_FOR_RECORDING` unless counsel explicitly establishes it as the required determination and identity/evidence are verifiable |
| Revokes an earlier permission                   | Append a revocation; block future operations; do not delete history                                                                      |

## 5. Evidence preservation

The original decision document, hash, evidence references, reviewer identities, timestamps and audit events are retained. A hash proves byte integrity only; it does not prove the author's identity or authority.

## 6. Current state

No counsel response has been received. `authorization-decisions.json` remains empty; all 350 Gate 4 cells remain `UNKNOWN`; the four pilot documents remain `BLOCKED_AUTHORIZATION`. Gate 5 does not contact counsel or create a determination.
