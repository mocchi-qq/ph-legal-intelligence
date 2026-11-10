# Owner Authorization — Bounded Internal Pilot

**Date:** 2026-11-10
**Authorized by:** Project owner (instruction: "I authorize")
**Nature:** owner-level risk acceptance for a bounded internal evaluation.
**Not:** a Philippine counsel opinion, a source reuse licence, or a change to any source's authorization status.

## Scope

| Constraint      | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Sources         | Supreme Court E-Library (`elibrary.judiciary.gov.ph`) only                                   |
| Documents       | 4 Republic Act pages (12326, 12325, 12232, 10931)                                            |
| Purpose         | Internal engineering validation of acquisition, extraction, identity, retrieval and citation |
| Storage         | `legal-data/pilot/`, git-ignored, local only                                                 |
| Redistribution  | None. Originals are not committed, republished or served                                     |
| Bulk access     | None. Four one-off requests, 1.5 s apart, no recursion, no crawl                             |
| Access controls | None bypassed; no CAPTCHA evasion; no authentication circumvention                           |
| Rate            | One request per document, bounded timeout and size                                           |

## Explicit acknowledgements

1. The reuse status of every source remains `UNKNOWN`. This document does **not** mark any source as `AUTHORIZED`.
2. Philippine counsel sign-off is still outstanding. This is a risk acceptance by the project owner, not a legal determination.
3. The pilot is not a basis for redistribution, commercial use, or a public corpus.
4. Findings from the pilot apply to these four documents only.
5. If counsel later restricts this use, `legal-data/pilot/` is deleted and the manifest is marked withdrawn.

## Regression guard

The pilot must not alter Gate 0/1 records, source statuses, or the synthetic benchmarks. It writes only:

- `legal-data/pilot/` (ignored)
- `docs/gates/gate-2/PILOT_RESULTS.json`
- `docs/gates/gate-2/PILOT_MANIFEST.json`
