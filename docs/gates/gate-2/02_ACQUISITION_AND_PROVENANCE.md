# Acquisition and Provenance

**Date:** 2026-11-10
**Implementation:** `packages/legal-ingestion/src/acquisition.ts`, `guards.ts`
**Tests:** `tests/legal-data/acquisition-guards.test.ts` (14 passing)

## 1. What exists

A manifest builder that refuses to produce a record unless the source is in an authorized state with a written evidence reference.

Each produced record contains: internal ID, source registry ID, official title, legal identifier, document type, original URL, retrieval timestamp, publication/promulgation/effectivity dates, original filename, MIME type, size, SHA-256, acquisition method, authorization reference, attribution, outcome, verification status.

Unknown dates remain `null`. Nothing is inferred.

## 2. Authorization gate (tested)

| Case                                          | Result                                     |
| --------------------------------------------- | ------------------------------------------ |
| `UNKNOWN` / `NOT_REVIEWED` / `RESTRICTED`     | refused `source_not_authorized:<state>`    |
| `AUTHORIZED` without evidence reference       | refused `authorization_evidence_missing`   |
| Authorization bound to another source ID      | refused `authorization_source_mismatch`    |
| Empty bytes                                   | refused `empty_artifact`                   |
| Synthetic flag without `synthetic://`         | refused                                    |
| `AUTHORIZED` with evidence + public HTTPS URL | record produced                            |
| `AUTHORIZED` + private/local URL              | refused `unsafe_url:private_or_local_host` |

## 3. URL and path guards (tested)

- Only `http`/`https`; no `file:`, `ftp:`.
- Rejects credentials in URL, non-standard ports, `localhost`, `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`, `.local`.
- `safeFilename` reduces `../../etc/passwd` to `passwd`, strips control characters and leading dots.
- `assertSafeStorageKey` rejects absolute paths and `..` traversal.

No network client, no fetch, no retry loop exists in Gate 2. Transport is intentionally absent.

## 4. Provenance chain (design, partially implemented)

Original bytes → SHA-256 → manifest → ingestion run → version → provisions → chunks → citation. The Gate 1 pipeline already preserves bytes and records hashes; the Gate 2 manifest adds the authorization reference and acquisition metadata.

## 5. Not tested / not implemented

- Live HTTP acquisition, redirects, truncation, interrupted downloads (no transport).
- PDF MIME sniffing beyond `%PDF-` header.
- URL change detection.
- Authorization revocation handling in a running connector.

These are not claimed. They require an authorized source and a connector that does not yet exist.

## 6. Result

Real acquisition: **BLOCKED — no authorized source.** The gate and guards are implemented and tested; the transport is deliberately not built.
