# Known Limitations — Philippine Legal Intelligence Platform

Research gaps carried forward from dossier Section 22. This file records the state as of Gate 0. It states only what actually exists in this repository. No negotiation, connector, prototype, or acquisition is claimed beyond the artefacts listed.

Status values used here:

- **Not started** — no work exists in this repository.
- **Specified** — a design or schema exists, but no operational capability.
- **Pending review** — a technical or legal review is outstanding.
- **Blocked** — cannot proceed until an external dependency resolves.

| Research gap               | Status         | What actually exists (Gate 0)                                                                                                                                                                    |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E-Library bulk acquisition | Pending review | Source registered as `sc_elibrary` with `acquisition_status: "Pending"`. No connector, no bulk-access agreement, no scraping prototype. Technical access and reuse permission remain unverified. |
| LawPhil bulk acquisition   | Pending review | Source registered as `lawphil` with `acquisition_status: "Pending"`. No connector exists. Terms and reuse assessment outstanding.                                                                |
| Official Gazette coverage  | Pending review | Source registered as `official_gazette`, `Pending`. Completeness of coverage is unmeasured.                                                                                                      |
| Agency source connectors   | Not started    | Agency sources are registered as `Pending`. No connector code exists (apps/ingestion is a scaffold only).                                                                                        |
| Local ordinance coverage   | Not started    | No local-ordinance source is registered. Geographic coverage is unmeasured and must not be claimed until records exist.                                                                          |
| Historical law versions    | Specified      | Temporal model and `DocumentVersion` / `LegalProvision` schema exist. No versioned corpus or amendment graph has been built.                                                                     |
| Case treatment data        | Not started    | No treatment/citator data exists. Good-law status must not be displayed as authoritative until evidence and classification are reviewed.                                                         |
| Multilingual retrieval     | Not started    | No English–Filipino retrieval benchmark exists. Model and embedding choices are unvalidated.                                                                                                     |
| AI model selection         | Specified      | Provider-neutral interfaces exist (packages/model-gateway, packages/ai-orchestrator). No model has been evaluated against a legal benchmark.                                                     |
| OCR quality                | Not started    | No OCR pipeline exists. Quality on scanned Philippine legal documents is unmeasured.                                                                                                             |
| Cloudflare cost            | Not started    | No representative workload has been run. Cost and capacity at 10k/100k/1M documents are unmeasured. Limits are cited from documentation only.                                                    |
| Legal service boundaries   | Pending review | Requires Philippine counsel review of disclaimers, professional-practice implications, and document-generation workflows.                                                                        |
| Privacy implementation     | Specified      | Privacy specification, AI governance, and threat model exist. No consent, retention, or data-subject-request mechanism is implemented yet.                                                       |
| Copyright and licensing    | Pending review | Every source is `Pending`. No source is marked `Approved`. No bulk ingestion may proceed until reuse review and counsel sign-off.                                                                |
| Professional verification  | Not started    | No lawyer-verification workflow exists. Account category does not grant professional privileges.                                                                                                 |

## Gate 0 honesty note

At Gate 0 the platform has no ingested corpus, no connectors, no trained or selected models, and no product UI. This table must not be read as evidence of operational capability. It records design state and open reviews only.
