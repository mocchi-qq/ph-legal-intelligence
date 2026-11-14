# Gate 7 — Centralized Authorization Audit

**Date:** 2026-11-14
**Service:** `AuthorizationAuditService` (`authorization-audit.ts`)
**Persistence:** migration `0007` (`authorization_audit_events`)

## 1. The defect this closes

Gate 6 disclosed that temporary-storage and reindexing denials were not centrally
audited. The Gate 7 draft implementation appeared to fix this but had a
**fail-open** bug: `record()` was synchronous while the D1 sink's `append()` was
async, and the returned promise was never awaited or observed. With a D1 sink, an
audit failure would surface as an unhandled rejection while the content operation
proceeded.

## 2. Execution contract

Sinks declare their shape:

- `kind: "sync"` — `append()` completes before `record()` returns;
- `kind: "async"` — only `recordAsync()` may be used.

Rules enforced in code:

1. `record()` throws `AuthorizationAuditUnavailableError` on an async sink
   **before** calling it, so no promise is created.
2. If an undeclared sink returns a thenable, `record()` attaches a no-op catch
   (no unhandled rejection) and throws.
3. `recordAsync()` awaits the append and converts any rejection into
   `AuthorizationAuditUnavailableError`.
4. Every caller treats a throw as **deny**:
   - `buildAcquisitionRecord` → `authorization_audit_unavailable`
   - `ingestArtifact` → `FAILED / authorization_audit_unavailable`
   - `authorizeTemporaryLocalStorage` → `allowed: false`
   - `authorizeIndexing` → `allowed: false`
   - `CounselAuthorizationService` → `allowed: false`

Consequence: an audit failure can never turn a denial into an approval. It can
only add a denial.

## 3. Event IDs

`auth_audit_<uuidv4>` (fallback: timestamp + counter + random suffix). The draft
used a per-process counter, which would collide on the durable primary key after
restart or across instances. Tests assert distinct ids.

## 4. Event fields

`id, eventType, outcome, occurredAt, sourceId, documentId, activity, operation,
reasonCode, determinationId, correlationId, registryStatus, context`.

13 event types are supported: request, granted, denied, projection rejected,
evidence unavailable, condition unmet, expired, revoked, superseded, conflict,
registry unavailable, operation aborted, retry denied.

### Data minimisation

`context` accepts only `string | number | boolean | null`. A denylist rejects keys
such as `content`, `text`, `body`, `html`, `excerpt`, `opinion`, `secret`,
`token`, `password`, `authorization`, `cookie`, `api_key`. Strings over 512
characters or containing a bare `SECTION n` / `ARTICLE n` / `RULE n` pattern are
rejected. Violations throw, which denies the operation. No document body,
extracted text, counsel opinion or credential can enter the audit table through
this API.

## 5. Enforcement integration

| Path                    | Function                                | Activities audited                                                                 |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Acquisition             | `buildAcquisitionRecord`                | `downloading`                                                                      |
| Ingestion               | `ingestArtifact`                        | `temporary_processing`, `persistent_storage`, `text_extraction`, `search_indexing` |
| Reindexing              | `authorizeIndexing`                     | `temporary_processing`, `text_extraction`, `search_indexing`                       |
| Temporary local storage | `authorizeTemporaryLocalStorage`        | `temporary_local_storage`                                                          |
| Durable projection      | `CounselAuthorizationService.authorize` | any requested activity                                                             |

Grants and denials are both recorded. Registry-unavailable is recorded as
`REGISTRY_UNAVAILABLE / ERROR`. See `audit-coverage.json`.

The audit service is a required input to a decision, not an optional extra. On the
sync entry points the parameter is optional in the type signature only so the
modules can be imported; at runtime a missing service is a **denial**
(`authorization_audit_unavailable`), never an unaudited grant. The first review
found the draft's "missing service returns true" behaviour and it was removed;
a regression test asserts the denial.

## 6. Ordering decision

The safest available design is: **audit before content access, and deny if the
write fails.**

- Sync content paths require a sync sink; the write completes inside the decision
  call, before any file is created or bytes are processed.
- Async paths `await recordAsync()` before returning `allowed`.

Limitation: the async D1 sink cannot be used from the synchronous content entry
points. Attaching it there causes `authorization_audit_unavailable` — a denial, not
an unaudited approval. Making those entry points async is a separate, larger
change and is recorded as a Gate 8 candidate.

## 7. Persistence and integrity

`authorization_audit_events` (migration 0007):

- primary key `id`; `CHECK` on event type and outcome;
- `context_json` must be a JSON object;
- `occurred_at` must be a valid date;
- `BEFORE UPDATE` / `BEFORE DELETE` triggers abort (append-only);
- indexes on `(source_id, activity, occurred_at)`, `(determination_id, …)`,
  `(correlation_id)`.

Tested: duplicate id rejected, invalid event type rejected, invalid timestamp
rejected, non-object JSON rejected, UPDATE/DELETE rejected, concurrent/duplicate
writes rejected, sink failure denies, registry unavailability denies.

## 8. Honest coverage statement

`ALL_IMPLEMENTED_PATHS_COVERED` means: every implemented content-access path has
explicit audit calls for grant and denial, verified by tests when a service is
supplied. It does not mean every future operation is audited, and it does not
mean D1 persistence is runtime-verified.
