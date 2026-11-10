# Security and Grounding

**Date:** 2026-11-10
**Tests:** `tests/security/gate1-security.test.ts`, `tests/legal-data/acquisition-guards.test.ts`, `tests/citations/grounding.test.ts`

## 1. Tested controls added in Gate 2

| Control                                                    | Test                         |
| ---------------------------------------------------------- | ---------------------------- |
| SSRF guard: private/local hosts rejected                   | `acquisition-guards.test.ts` |
| Scheme/credential/port rejection                           | `acquisition-guards.test.ts` |
| Filename traversal reduced to leaf name                    | `acquisition-guards.test.ts` |
| Storage-key traversal rejected                             | `acquisition-guards.test.ts` |
| Authorization gate before manifest                         | `acquisition-guards.test.ts` |
| Oversized/ non-PDF / corrupt PDF rejected without throwing | `pdf.test.ts`                |
| Original bytes unchanged after extraction                  | `pdf.test.ts`                |
| Instruction-like text not followed / not echoed            | `grounding.test.ts`          |
| Unverified citations excluded from answers                 | `grounding.test.ts`          |
| Synthetic flag cannot bypass authorization                 | `gate1-security.test.ts`     |

## 2. Grounding guarantees retained

- Only `VERIFIED` citations are used.
- No verified citation → abstention.
- Partially verified citations are excluded and the failed layer is named.
- Instruction-like document text is stripped and reported as data.
- Fact-specific questions are answered with the framework only; missing facts are declared.
- No model call is made; whether a generative model can be constrained to this standard remains unverified.

## 3. Not tested / not implemented

- Authentication, sessions, multi-tenancy (out of Gate 2 scope).
- Live HTTP fetching, redirect handling, TLS pinning.
- Malware scanning, archive/ZIP handling.
- Parser sandboxing beyond process isolation and timeouts.
- SQL injection surface (no database connection in tests).
- Rate limiting, audit immutability, backup/restore.
- OCR-specific resource exhaustion.

## 4. Findings

| ID    | Severity | Finding                                                                                                                           | Disposition                                                                |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| G2-S1 | Medium   | PDF extraction shells out to Poppler; a malicious PDF is untrusted input to that process                                          | Timeout, size cap, private temp file, no shell. Sandboxing not implemented |
| G2-S2 | Medium   | Support remains lexical without an annotation; a reworded claim can pass or a valid paraphrase fail                               | Classified as `LEXICAL_ONLY`; not presented as entailment                  |
| G2-S3 | Low      | Acquisition transport is absent, so redirect/truncation/retry behaviour is unverified                                             | Recorded as not implemented; no claim                                      |
| G2-S4 | Info     | `robots.txt` was the only source evidence gathered                                                                                | Counsels packet still requires full terms review                           |
| G2-S5 | Low      | SSRF guard is hostname-textual: no DNS resolution, no IPv4-mapped IPv6 or decimal/hex IP normalisation, no post-redirect re-check | Latent; must be implemented before any transport exists                    |

## 5. Result

Security work in Gate 2 is limited to guards and parser hardening that can be tested without real sources. No claim of production security or DPA compliance is made.
