# Counsel Briefing — Philippine Legal Intelligence Platform

**Prepared:** 2026-11-10
**Status:** prepared for review. No determination has been received.

## What the platform does

It indexes Philippine legal documents and retrieves passages to support legal research. It does not provide legal advice. Outputs are research assistance and must cite the source passage.

## Intended processing

1. Retrieve official documents over HTTPS.
2. Preserve the original bytes privately with a SHA-256 fingerprint.
3. Extract text and structure (sections, paragraphs).
4. Index text for keyword and (later) semantic retrieval.
5. Display short passages with citation and a link to the official source.
6. Generate research summaries grounded only in retrieved passages.

## What we are not asking

We are not asking for blanket approval. We are not asking you to approve bulk redistribution or commercial resale.

## What we need

A per-source, per-activity determination using the worksheet: permitted, conditional, prohibited, or unknown. The dossier lists 25 sources and 13 activities, all currently UNKNOWN.

## Current corpus

Four Republic Act pages were acquired under a project-owner risk acceptance for internal evaluation only. They are stored locally, not redistributed. If your determination prohibits retention, they will be deleted.

## Technical facts relevant to the analysis

- Originals are content-addressed and never overwritten.
- A repeated retrieval can return different bytes with the same length; each retrieval is a separate snapshot.
- Text extraction is local; no document text is sent to a third-party AI provider at this stage.
- The system can delete the local pilot corpus on request.
