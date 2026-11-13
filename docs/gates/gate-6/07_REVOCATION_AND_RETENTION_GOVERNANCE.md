# Gate 6 — Revocation, Retention and Stored-Content Governance

**Date:** 2026-11-13
**Status:** governance state machine defined and tested with synthetic records; no automatic deletion.

## 1. Principle

Revocation immediately blocks new operations that depend on the determination. It does **not** automatically delete stored content. Deletion requires an applicable counsel determination and an approved retention/deletion policy. Neither exists.

## 2. State model

| State                         | Meaning                                                | Runtime behaviour                                                  |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `AUTHORIZATION_VALID`         | Verified, active, effective, unexpired, conditions met | Operations may proceed if other checks pass                        |
| `AUTHORIZATION_EXPIRED`       | Expiry date passed                                     | Deny new operations                                                |
| `AUTHORIZATION_REVOKED`       | Revocation event recorded                              | Deny new operations; add Gate 4 `PROHIBITED` override              |
| `AUTHORIZATION_SUPERSEDED`    | New determination supersedes                           | Old determination inactive; new one applies only to its activities |
| `CONTENT_ACCESS_BLOCKED`      | Access denied by projection                            | Read/display must fail closed                                      |
| `CONTENT_PROCESSING_BLOCKED`  | Processing denied                                      | Extraction/index/embedding must fail closed                        |
| `RETENTION_UNRESOLVED`        | No policy or counsel decision                          | Retain without new processing; no public exposure                  |
| `DELETION_PENDING_DECISION`   | Deletion requested, awaiting legal/governance decision | Do not delete                                                      |
| `DELETION_AUTHORIZED`         | Written decision permits deletion                      | Controlled deletion workflow may begin                             |
| `DELETION_COMPLETED_VERIFIED` | Deletion performed and verified                        | Audit record retained                                              |

## 3. Transitions

- Valid → expired/revoked/superseded: projection denies; no deletion.
- Revoked → blocked: Gate 4 override is appended; existing content remains.
- Retention unresolved → deletion pending: requires a decision record, not an inference.
- Deletion authorized → completed: requires a controlled workflow, verification and audit; not implemented.

## 4. Current behaviour

- Revocation blocks projection and appends a `PROHIBITED` enforcement override in the Gate 4 registry.
- A test revokes a retention decision and confirms the synthetic corpus still contains its document. No deletion occurs.
- The four real pilot files are not deleted, altered or reprocessed.
- No purge, archive or retention job exists.

## 5. Future workflow requirements

1. Identify affected documents by source/document scope.
2. Block access and processing first.
3. Preserve audit records.
4. Evaluate counsel and retention obligations.
5. Record a deletion decision with actor, date and evidence.
6. Delete only authorized content, with a manifest/hash record.
7. Verify deletion and retain an audit tombstone.

## 6. Residual limitation

Retention policy is unresolved. Revocation is enforced for new operations but does not purge existing bytes. This is intentional for Gate 6.
