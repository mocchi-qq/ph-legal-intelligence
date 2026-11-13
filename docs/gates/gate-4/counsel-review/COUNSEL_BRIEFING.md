# Counsel Briefing — Philippine Legal Intelligence Platform

**Prepared:** 2026-11-13
**Status:** prepared for Philippine counsel review. No determination has been received. This document is not legal advice and does not assert any permission.

## 1. Project overview

The project is building a Philippine legal research platform. It preserves legal documents, extracts their text, indexes it for retrieval, and presents short passages with citations. It is intended to assist research; it does not provide legal advice and is not a substitute for a lawyer.

## 2. Intended users

Proposed users include legal researchers, students, lawyers and institutional subscribers. Public access, professional access and commercial access are **proposed**, not implemented. No user authentication or tenancy exists yet.

## 3. Intended legal research functionality

- Exact-identifier lookup (Republic Act, G.R. number, other instrument identifiers).
- Keyword and passage retrieval over extracted text.
- Citation display linked to the source.
- Research summaries grounded only in retrieved passages, with abstention when evidence is insufficient.
- Later: semantic retrieval and reranking (not implemented).

## 4. Source acquisition architecture

A source registry, URL/SSRF guards, redirect re-validation, streaming size limits and a 20-second timeout exist. Four Republic Act pages were acquired during a bounded Gate 2 pilot from the Supreme Court E-Library under a **project-owner risk acceptance**, not counsel approval. Gate 4 has acquired **no new documents**.

## 5. Original file preservation

Original bytes are preserved before parsing. SHA-256 identifies each retrieval. An acquisition-snapshot model records every retrieval separately because the same URL can return different bytes of identical length. Earlier snapshots are not overwritten.

## 6. Text extraction

Native HTML and PDF text extraction exists. PDF text extraction currently uses Poppler under process limits and network-namespace isolation. No filesystem sandbox or malware scanner is implemented.

## 7. OCR plans

No OCR engine is installed. Scanned documents are not processed. OCR is a **proposed** capability that would require engine selection, accuracy measurement and resource validation. No OCR output exists.

## 8. Search indexing

Extracted text is segmented into provisions and chunks and indexed lexically. The index is local and deterministic. No embedding index exists.

## 9. Semantic embeddings

**Proposed only.** No embedding model has been selected, downloaded or run. No vector index exists.

## 10. AI-assisted analysis

**Proposed only.** No generative or entailment model is called. The grounding layer is deterministic and uses only verified evidence; `LEXICAL_ONLY` support is excluded. No document text is sent to a third-party AI provider at this stage.

## 11. Citation display

The system can display short passages with a citation and a link to the official source. Citation identity, location, support and temporal layers exist; support is currently lexical, not semantic. `LEXICAL_ONLY` cannot be presented as verified support.

## 12. Storage and retention

Pilot originals are stored locally under git-ignored `legal-data/pilot/` and are not redistributed. No production storage, backup schedule, deletion workflow or retention policy has been approved. Retention is unresolved and is a question for counsel.

## 13. Commercial-use intentions

Commercial deployment is **proposed, not authorized**. No commercial use is made of any source today.

## 14. Proposed attribution

Proposed attribution would name the issuing institution and the source, display the official identifier, and link to the source record. The exact format is a question for counsel.

## 15. Technical safeguards

- Source-level ingestion gate and new activity-specific, fail-closed authorization gate.
- URL, SSRF, credential and path-traversal guards.
- Per-retrieval SHA-256 and append-only acquisition snapshots.
- Append-only authorization decisions and audit events.
- Process limits and network isolation for PDF parsing.
- No authentication or tenant isolation yet.

## 16. Existing limitations

No counsel determination; no authorized corpus; four owner-authorized pilot documents only; unknown legal dates; no independent second-source authenticity confirmation; no OCR; no semantic retrieval; no reranking; no authentication; no multi-tenancy; no deployment; residual parser and transport risks.

## 17. Specific questions requiring counsel determination

See `OUTSTANDING_QUESTIONS.md` and the per-source worksheets. In summary:

1. For each source and each of the 14 activities, is the activity permitted, conditional, restricted or prohibited?
2. Which materials are government works, and what does that imply for reproduction, indexing, AI processing and commercial use?
3. Does displaying short passages with attribution and a source link constitute redistribution?
4. May original bytes and extracted text be retained privately for verification, and for how long?
5. May extracted text be indexed, embedded or processed by AI systems?
6. What attribution, quotation limits and takedown process apply?
7. May the four pilot documents be retained, or must they be deleted?

A blanket approval is not requested and cannot be relied on. Determinations must be source-specific and activity-specific.
