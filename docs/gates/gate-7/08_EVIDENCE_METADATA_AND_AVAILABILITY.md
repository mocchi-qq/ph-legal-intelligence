# Gate 7 — Evidence Metadata and Availability

**Date:** 2026-11-14
**Module:** `packages/legal-ingestion/src/evidence.ts`

## 1. Scope

Registry-side metadata only. There is:

- no evidence upload endpoint;
- no download or serving endpoint;
- no evidence bytes in the repository;
- no real counsel document bundled.

Default implementation is `UnavailableEvidenceStore`, which returns `null` for
every reference. Test evidence must use `synthetic://` references; the test
catalogue throws on anything else.

## 2. States

| State                    | Meaning                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `NOT_RECEIVED`           | no metadata for the reference, or `received === false`      |
| `REFERENCE_INVALID`      | empty reference, or metadata belongs to another reference   |
| `FILE_UNAVAILABLE`       | metadata exists but the bytes are not in the external store |
| `HASH_MISMATCH`          | recorded hash is not a 64-hex digest                        |
| `IDENTITY_UNVERIFIED`    | signer identity not attested                                |
| `AUTHORITY_UNVERIFIED`   | signer's authority to bind the source not attested          |
| `EVIDENCE_INCOMPLETE`    | missing hash/size/date/verifier for an attested record      |
| `AVAILABLE_UNVERIFIED`   | bytes present and intact, no attestation yet                |
| `VERIFIED_FOR_RECORDING` | complete metadata + identity + authority attestation        |

These are deliberately not collapsed. `AVAILABLE_UNVERIFIED` is a distinct,
non-approving state: a file being present proves nothing about legal effect.

## 3. Attestation model

`EvidenceAttestation = "NONE" | "IDENTITY_ONLY" | "AUTHORITY_ONLY" | "FULL"`.
`FULL` requires a named `verifiedBy`. This keeps "we have the file" separate from
"a human checked who signed it" and "a human checked they could bind the source".

## 4. Projection integration

`resolveEvidenceStatuses(references, store)` returns a map. When a store is
configured on `CounselAuthorizationService`, every reference a determination
relies on must resolve to `VERIFIED_FOR_RECORDING`, otherwise projection denies
with `evidence_unavailable` and audits `EVIDENCE_UNAVAILABLE`.

If no store is configured, the Gate 5/6 opt-in `evidenceAvailable` predicate still
applies and the `"not assessed"` behaviour is preserved. The durable service is
expected to configure a store; tests cover both.

## 5. Integrity helper

`verifyEvidenceBytes(metadata, bytes)` compares `sha256(bytes)` with the recorded
hash. It is a byte-integrity check, not a legal-validity check, and it does not
store or return the bytes.

## 6. Tested

- all nine states reachable and distinct;
- missing reference → `NOT_RECEIVED`, never approval;
- `AVAILABLE_UNVERIFIED` denies projection;
- non-synthetic reference rejected by the test catalogue;
- byte hash mismatch detected;
- unavailable store denies when configured.

## 7. Not implemented

Upload, download, serving, OCR, opinion parsing, retention and deletion. No real
evidence reference was created or invented.
