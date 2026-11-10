# Source Snapshots and Change Management

**Date:** 2026-11-10
**Implementation:** `packages/legal-ingestion/src/snapshot.ts`
**Tests:** `tests/legal-data/snapshots.test.ts` (7 passing)

## 1. The problem Gate 2 exposed

Re-fetching the same E-Library URL produced different bytes with an identical length. A hash therefore identifies **one retrieval**, not a stable document.

## 2. Acquisition event model

Every retrieval records: source ID, requested and final URL, redirect chain, timestamp, HTTP status, MIME type, declared Content-Length, received byte count, SHA-256, ETag, Last-Modified, software version, authorization state at acquisition, outcome, reason.

`SnapshotStore` stores bytes by hash once and appends an event even when the hash repeats. Earlier bytes are never replaced.

`toManifestEntry()` always sets `legal_version_created: false`.

## 3. Change classification

`compareLatest(sourceId, requestedUrl, newBytes, newText)` returns:

| Class             | Meaning                             | Legal review? |
| ----------------- | ----------------------------------- | ------------- |
| `IDENTICAL_BYTES` | same SHA-256                        | No            |
| `TEXT_EQUIVALENT` | normalized text equal, bytes differ | No            |
| `CONTENT_CHANGED` | normalized text differs             | **Yes**       |
| `UNKNOWN`         | no text to compare                  | **Yes**       |

A hash change never creates a canonical document or a legal version. Identity and legal-version analysis are required first.

## 4. Tested behaviour

- Two retrievals of the same URL produce two events; both byte sets remain retrievable.
- Identical bytes require no review.
- Whitespace-only differences classify as text-equivalent.
- Content changes require legal review.
- No manifest entry claims a legal version was created.
- Acquisition and snapshot hashes are linked only when they match.

## 5. Not implemented

- Persistent database table for acquisition events (model + tests only).
- Automated diff of legal provisions between snapshots.
- Change detection scheduling for an authorized source.
- ETag/Last-Modified conditional requests (stored, not used for `If-None-Match`).

## 6. Result

The snapshot model is implemented and tested. The Gate 2 pilot predates it; its hashes remain per-retrieval records and are not retroactively normalized.
