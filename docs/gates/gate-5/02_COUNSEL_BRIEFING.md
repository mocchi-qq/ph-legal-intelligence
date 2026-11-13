# Gate 5 — Counsel Briefing

**Prepared:** 2026-11-13
**Status:** prepared for Philippine counsel review. No determination has been received. This is not legal advice and does not assert any permission.

## 1. What the platform does

The project is a Philippine legal research platform. It preserves legal documents, extracts their text, indexes it for retrieval, and presents short passages with citations. It is intended to assist research, not to provide legal advice.

## 2. Source types intended

Republic Acts, implementing rules and regulations, administrative issuances, Supreme Court decisions and related judicial materials, and historical versions where available. No new source was acquired in Gate 5.

## 3. Processing activities that may be performed

Viewing, downloading, temporary processing, temporary local storage, persistent storage, text extraction, OCR, search indexing, embedding generation, AI-assisted analysis, citation display, quotation, substantial reproduction, redistribution/export, commercial use, and retention/archival storage.

## 4. Activities currently implemented

- Guarded document acquisition is implemented, but no new acquisition is authorized.
- Native HTML/PDF text extraction is implemented.
- Lexical search indexing is implemented.
- Temporary in-memory processing and private temporary PDF files are implemented.
- Local pilot storage exists for four owner-authorized documents only.
- Citation identity, location, support and temporal checks are implemented; support is currently lexical.

## 5. Activities only proposed

OCR, embedding generation, semantic retrieval, reranking, AI-assisted analysis, substantial reproduction, public citation display at scale, redistribution, commercial use, authentication, tenancy and deployment are **not implemented**.

## 6. Acquisition

A source registry, URL/SSRF guards, redirect re-validation, streaming size limits and timeouts exist. Four Republic Act pages were acquired during a bounded Gate 2 pilot under a project-owner risk acceptance, not counsel approval. Gate 5 acquired no new documents.

## 7. Storage and processing

Original bytes are preserved before parsing and identified by SHA-256. Acquisition snapshots are append-only. PDF extraction uses Poppler under process limits and network-namespace isolation; there is no filesystem sandbox or malware scanner. Extracted text is segmented into provisions and chunks.

## 8. Indexing

The current index is lexical and deterministic. No embedding or vector index exists. No document text is sent to a third-party AI provider at this stage.

## 9. Intended AI-assisted retrieval

Proposed only. Any future answering layer would be grounded in retrieved passages, would cite evidence, and would abstain when evidence is insufficient. `LEXICAL_ONLY` support is already excluded from grounded answers.

## 10. Citations and source references

The system can record citation identity, location, support and temporal checks and can display short evidence passages with a source URL. The exact public display format is a question for counsel.

## 11. Quotation and substantial reproduction

Short evidence excerpts are used internally in manifests and reports for provenance. Substantial reproduction, redistribution and public quotation at scale are not implemented and are not authorized.

## 12. Commercialization

Commercial deployment is proposed, not authorized. No commercial use is made of any source today.

## 13. Retention

Pilot originals are held locally under git-ignored `legal-data/pilot/` and are not redistributed. No retention schedule, deletion workflow or archival policy has been approved.

## 14. Restrictions and revocation enforcement

Gate 4 introduced activity-specific, fail-closed authorization with append-only decisions and audit events. Gate 5 adds a counsel-determination model with verified identity, evidence completeness, conditions, effective/expiry dates, supersession, revocation and conflict handling. A revocation can override a prior projected authorization in the enforcement registry.

## 15. Unimplemented or unverified

No counsel determination; no authorized corpus; unknown legal dates; no independent second-source authenticity; no OCR; no semantic retrieval; no reranking; no authentication; no tenancy; no production ingestion; no deployment; residual parser and transport risks.

## 16. Questions requiring counsel determination

See `questions-register.md` and the 25 source worksheets. A determination for one source or activity does not authorize another. A blanket approval is not requested.
