# Acquisition and Provenance

**Date:** 2026-11-10
**Implementation:** `packages/legal-ingestion/src/acquisition.ts`, `guards.ts`
**Tests:** `tests/legal-data/acquisition-guards.test.ts` (14 passing: 8 manifest, 6 guards)

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

## 7. Guarded transport (added after owner authorization)

`packages/legal-ingestion/src/transport.ts` is the only network code:

- `http`/`https` only, public hosts, standard ports, no credentials;
- **DNS is resolved and every address checked** (`isPrivateAddress`: loopback,
  RFC1918, link-local, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6);
- redirects are manual, max 3, and each hop is re-validated and re-resolved;
- `Content-Length` mismatch is treated as truncation;
- 25 MB cap, 20 s timeout, MIME allowlist, empty-body rejection;
- no shell; returns `OK` / `REJECTED` / `FAILED` with a reason, never throws.

Tests (`tests/legal-data/transport.test.ts`, 10) cover success, DNS-private,
redirect-to-private, redirect loop, truncation, MIME, size, HTTP 404, empty body
and private-address classification.

## 8. Owner-authorized pilot result

Four official E-Library Republic Act pages were acquired, preserved under
`legal-data/pilot/` (git-ignored, not redistributed), and recorded in
`PILOT_MANIFEST.json`:

| Document | Bytes  | SHA-256 (prefix) | Extracted chars |
| -------- | ------ | ---------------- | --------------- |
| RA 12232 | 39,262 | `6b6972c3eed1`   | 4,010           |
| RA 10931 | 49,603 | `7af9ca2d153e`   | 23,378          |
| RA 12326 | 37,072 | `858c580239b5`   | 6,966           |
| RA 12325 | 58,487 | `a6ff48243be6`   | 22,192          |

All four returned HTTP 200, `text/html`, no redirects, and parsed to the expected
Republic Act identifier. `authorization_basis` = `owner_authorization`.

Two evidenced amendment edges were applied from the documents' own text
(RA 12326 → RA 12232; RA 12325 → RA 10931), each with a quoted evidence passage.

**This is not legal authorization and not a corpus benchmark.**
