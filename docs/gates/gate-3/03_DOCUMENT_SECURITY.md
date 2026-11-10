# Document Processing Security

**Date:** 2026-11-10
**Implementation:** `packages/document-parser/src/pdf.ts`
**Tests:** `tests/legal-data/pdf.test.ts` (14 passing), `transport.test.ts` (11)

## 1. Parser isolation implemented

Poppler is invoked through `runTool`, which applies available OS controls:

| Control             | Implementation                                           | Status |
| ------------------- | -------------------------------------------------------- | ------ |
| Network isolation   | `unshare -n` (verified working on this host)             | Active |
| Address-space limit | `prlimit --as=512 MiB`                                   | Active |
| CPU-time limit      | `prlimit --cpu=20`                                       | Active |
| Process limit       | `prlimit --nproc=64`                                     | Active |
| File-size limit     | `prlimit --fsize=64 MiB`                                 | Active |
| Subprocess timeout  | 20 s `execFileSync` timeout                              | Active |
| Input size cap      | 25 MB default                                            | Active |
| Page-count cap      | default 500, configurable                                | Active |
| Private temp file   | `mkdtemp` mode `0700`, file `0600`, removed in `finally` | Active |
| No shell            | `execFile`, not `exec`                                   | Active |

`bwrap` exists but is unusable here (expects `/lib64`), so it is not used. The implementation does **not** claim filesystem sandboxing; only process limits and network namespace isolation.

## 2. Tested malicious/unusual inputs

- Non-PDF bytes → `REJECTED`.
- Corrupt PDF structure → `FAILED`/`REJECTED` without throwing; Poppler stderr observed in tests.
- Oversized input → `REJECTED`.
- Page count above limit → `REJECTED`.
- Invalid MIME in transport → `REJECTED`.
- Truncated body → `FAILED`.
- Redirect to private address / DNS-private host → `REJECTED`.
- Path traversal in filenames and storage keys → rejected.

Not tested: malformed xref bombs, enormous page dimensions, embedded files, invalid fonts, decompression bombs. A page-count and size cap mitigate but do not prove safety.

## 3. Malware scanning

No scanner is installed (`clamscan` absent). No malware scan is performed or claimed. Documents are parsed as untrusted input under the limits above.

## 4. Transport security

HTTPS and HTTP allowed (official sites may redirect); certificates are validated by Node's TLS stack. Redirect destinations are re-validated and re-resolved. DNS rebinding is partially mitigated by resolving and checking every address per hop, but there is no pinning of the resolved IP to the actual connection. TLS pinning is not implemented; it was judged maintenance-heavy for this stage.

## 5. Residual risks

| ID    | Risk                                           | Severity | Disposition                                                 |
| ----- | ---------------------------------------------- | -------- | ----------------------------------------------------------- |
| G3-S1 | Parser is not filesystem-sandboxed             | Medium   | Limits + network isolation only; document it                |
| G3-S2 | No malware scanning                            | Medium   | Accepted; no scanner available; parse as untrusted          |
| G3-S3 | DNS rebinding window between check and connect | Low      | Per-hop resolution limits exposure; pinning not implemented |
| G3-S4 | Poppler memory/CPU bombs                       | Medium   | 512 MiB / 20 s / 500 pages limits                           |
| G3-S5 | No TLS pinning                                 | Low      | Node CA validation only                                     |

No critical unresolved security finding. No production-security claim.
