# Gate 6 — Evidence-File Operational Integrity

**Date:** 2026-11-13
**Status:** reference model defined; no evidence storage service exists.

## 1. Evidence reference model

An evidence reference is a stable pointer plus metadata, never the raw counsel document in the authorization database.

| Field                 | Requirement                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `evidence_ref`        | Opaque stable reference (e.g. `synthetic://evidence/1`)                          |
| `evidence_type`       | Counsel opinion, signed letter, terms capture, verification record               |
| `original_filename`   | Metadata only, if appropriate                                                    |
| `sha256`              | Hex hash of the evidence bytes (optional at recording; required by future store) |
| `received_at`         | ISO timestamp                                                                    |
| `verification_status` | See §2                                                                           |
| `availability_status` | See §2                                                                           |
| `access_control`      | Must be private; no public route exists                                          |

The database stores references and hashes, not counsel documents. A hash proves byte integrity only; it does not prove the author's identity or authority.

## 2. Statuses

| Status                 | Meaning                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `NOT_RECEIVED`         | No evidence has been supplied                                             |
| `REFERENCE_INVALID`    | The reference is malformed or points to nothing                           |
| `UNAVAILABLE`          | The reference is valid but the file cannot be read                        |
| `HASH_MISMATCH`        | The file bytes do not match the recorded hash                             |
| `AVAILABLE_UNVERIFIED` | The file is readable but identity/authority is not verified               |
| `VERIFIED`             | File, identity and required authority are verified for this determination |

A missing evidence file must not silently leave a determination eligible. `project()` accepts an optional `evidenceAvailable(reference)` callback; if supplied and any required reference is unavailable, projection returns `evidence_unavailable` and denies.

## 3. Recording vs availability

- At recording, a `VERIFIED_FOR_RECORDING` determination must have at least one evidence reference and a decision-document reference.
- At projection, the caller may supply an availability checker. Absence of the checker is not proof that evidence exists; it means availability is operationally unverified.
- The current tests use synthetic references. No real file store, backup, or access-control system exists.

## 4. Access and exposure

No public or unauthenticated evidence route exists. Authentication and tenancy are not implemented, so no upload/download endpoint is built in Gate 6. Any future evidence endpoint must be authenticated, access-controlled, and excluded from public search.

## 5. Backup and recovery

Not implemented. A future evidence store must define retention, backup, restore and integrity-recheck procedures. Until then, evidence availability is an operational dependency and a disclosed limitation.

## 6. Test

`counsel-determinations.test.ts` includes a verified determination projected with `evidenceAvailable: () => false`, which returns `evidence_unavailable`. This proves the runtime hook; it does not prove a real evidence store exists.

## 7. Consequence

The system can deny on evidence unavailability, but it cannot currently verify that a real evidence file exists. Gate 6 does not claim evidence integrity beyond the reference/hash model.
