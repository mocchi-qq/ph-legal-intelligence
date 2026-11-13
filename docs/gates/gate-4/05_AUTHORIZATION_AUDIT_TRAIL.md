# Gate 4 — Authorization Registry and Audit Trail

**Date:** 2026-11-13
**Implementation:** `ActivityAuthorizationRegistry` (`packages/legal-ingestion/src/authorization.ts`)
**Schema:** `migrations/d1/0004_gate4_activity_authorization.sql`
**Tests:** `authorization-activity.test.ts` (audit/append-only cases), `gate4-migration.test.ts`

## 1. Design

Authorization history is append-only. A later decision supersedes an earlier decision for future runtime checks, but the earlier decision and its audit event remain readable. The runtime registry and the SQL schema both follow this rule.

Runtime audit record fields:

| Field            | Meaning                                           |
| ---------------- | ------------------------------------------------- |
| `id`             | Deterministic event ID                            |
| `sourceId`       | Source the decision applies to                    |
| `activity`       | Exactly one activity                              |
| `previousStatus` | Status before this event, or null                 |
| `newStatus`      | Status after this event                           |
| `basis`          | Counsel, owner risk acceptance, synthetic or none |
| `actor`          | Person/system that recorded the decision          |
| `actorRole`      | Role of the actor, where supplied                 |
| `changedAt`      | ISO timestamp                                     |
| `decisionRef`    | Decision row this event records                   |
| `evidenceRef`    | Evidence relied on                                |
| `conditions`     | Conditions attached to the decision               |
| `reason`         | Why the change was made                           |

## 2. Database schema

`source_activity_authorizations` stores the decisions. `source_authorization_audit` stores the events. Both have `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort the statement, so history cannot be rewritten through normal SQL. Migration 0004 also adds `authorization_decision_ref`, `authorization_decision_refs` and `authorization_basis_detail` to `ingestion_runs` so a strict run points to every activity decision that permitted it and to the basis.

`source_authorization_audit.decision_ref` references the decision row. The decision table has CHECK constraints for:

- the 14 activities;
- the 7 statuses;
- the 4 bases;
- evidence + reviewer + date for `AUTHORIZED`, `AUTHORIZED_WITH_CONDITIONS` and `RESTRICTED`;
- conditions for `AUTHORIZED_WITH_CONDITIONS`;
- a counsel reference for counsel-basis `AUTHORIZED`.

## 3. Status-change rules

| Change                                          | Permitted?                                               | Audit                               |
| ----------------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| UNKNOWN → AUTHORIZED                            | Only with counsel evidence, reviewer, date and reference | New event                           |
| REVIEW_REQUIRED → AUTHORIZED_WITH_CONDITIONS    | Only with conditions recorded                            | New event                           |
| AUTHORIZED → RESTRICTED                         | Permitted                                                | New event, previous status retained |
| AUTHORIZED → PROHIBITED                         | Permitted                                                | New event, previous status retained |
| Expiry                                          | Deny future checks; no deletion                          | Decision row retained               |
| Missing evidence/reference                      | Rejected at record time                                  | No event; exception thrown          |
| Revoked permission                              | Future operations denied; earlier rows retained          | New event                           |
| Conditional authorization with unmet conditions | Denied at check time                                     | Decision retained                   |

## 4. Existing content versus future operations

A status change does not silently delete stored material. The project distinguishes:

- existing stored content;
- new acquisition;
- new processing;
- existing derived artifacts;
- public display;
- retention obligations.

Deletion or retention follows an applicable counsel determination and an approved data-governance policy. None exists yet. The four pilot files are therefore retained locally, non-redistributed, and marked `BLOCKED_AUTHORIZATION` in the readiness assessment.

## 5. Gate 4 state

No decision rows and no audit events exist for real sources. `authorization-decisions.json` is empty with status `COUNSEL_DETERMINATION_PENDING`. The registry has been exercised only with test decisions in the test suite. No test decision was written to the repository's source-of-truth files.

## 6. Limitation

The migration has not been applied to a live D1 database. The runtime registry is in-memory and loses decisions on restart; it is a reference/test implementation. No production ingestion service exists. Persistence and actor authentication are not implemented; the audit trail is structurally append-only but not yet operationally deployed.
