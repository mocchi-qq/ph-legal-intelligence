# Gate 1 Security and Privacy Review

**Date:** 2026-11-10
**Tests:** `tests/security/gate1-security.test.ts` (6 passing)
**Baseline:** `docs/security/THREAT_MODEL.md`, `docs/security/SECURITY_ARCHITECTURE.md`, `docs/privacy/PRIVACY_SPECIFICATION.md`

## 1. Tested controls

| Control                                   | Result  | Evidence                                                                                                                        |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Unauthorized source refusal               | Pass    | Non-synthetic artifact with `sourceId: sc_elibrary` → `FAILED / source_not_authorized`, zero documents/manifestations persisted |
| Audit of every attempt                    | Pass    | Each ingest, including refusals, writes an `ingestion_run` with status and pipeline version                                     |
| File type validation                      | Pass    | `application/pdf` → `FAILED / unsupported_mime`                                                                                 |
| Empty extraction                          | Pass    | Artifact with no legal text → `FAILED / empty_extraction`, corpus unchanged                                                     |
| Private/public separation by construction | Pass    | Index built from the legal corpus contains no `private_upload` source; a corpus of only private docs yields an empty index      |
| Synthetic material labelling              | Pass    | All fixtures `synthetic: true`, `synthetic://` URLs, manifest notice                                                            |
| No secrets in example env                 | Pass    | `.env.example` contains empty placeholders only                                                                                 |
| Prompt-injection handling                 | Partial | Instruction-like sentences are stripped before support checking and answer assembly; treated as data. Heuristic only            |

## 2. Untested controls (not implemented at Gate 1)

- Authentication, sessions and MFA (Gate 4).
- Authorization and tenant isolation at the storage layer (no D1/R2 deployed).
- D1 row-level scoping and Workers bindings.
- Rate limiting and WAF behaviour.
- Malware scanning / parser sandboxing.
- Encryption-at-rest configuration and key management.
- Audit immutability and hash chaining.
- Backup and restore.
- Data-subject request automation and retention purge.

## 3. Findings

| ID  | Severity | Finding                                                                                                 | Disposition                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| F1  | Medium   | Prompt-injection defence is a regex heuristic; novel phrasing can pass                                  | Accept for Gate 1; document; revisit before any model integration        |
| F2  | Medium   | Support verification is lexical, not semantic; a reworded claim can pass or a valid paraphrase can fail | Documented in report 07; benchmark expectations are authored accordingly |
| F3  | Low      | In-memory/file store has no concurrency control                                                         | Accept; not deployed                                                     |
| F4  | Low      | No authentication exists yet, so admin actions are not protected                                        | Out of scope until Gate 4; no admin surface exists                       |
| F5  | Info     | Only `robots.txt` was checked for source terms, not full terms of use                                   | Recorded in the source matrix; counsel packet raised                     |

## 4. Privacy

- No personal data is processed. Fixtures are fictional; one contains instruction-like text but no personal data.
- The privacy specification and AI governance documents remain design artefacts. **No claim of DPA compliance is made** because no personal data processing system exists.
- The NPC AI guidance and DPA obligations remain open for counsel review.

## 5. Residual risk statement

The only executable surface is a local, offline pipeline plus an in-memory index. There is no network listener, no deployed database, no authentication and no user data. Security risk at Gate 1 is therefore bounded by the test surface. The absence of auth, tenancy and deployment controls must not be mistaken for their being satisfied.
