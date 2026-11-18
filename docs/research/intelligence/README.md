# Research Runway — Philippine Legal Intelligence Platform

**Directory:** `docs/research/intelligence/`

**Purpose:** A structured, long-running, repeatable research-intelligence program that lets the development team and future AI agents conduct broad internet research, learn from credible external sources, synthesize findings, and make better architectural, product, security, legal-technology, UX, and engineering decisions.

## What this is NOT (non-negotiable)

- **Not a document acquisition system.** Internet research must never enter the production legal document database, D1 legal registry, provision tables, citation indexes, search indexes, vector databases, legal retrieval systems, or any database designed to store actual Philippine legal authorities.
- **Not a corpus expansion project.** No legal documents are downloaded, ingested, or populated into production databases.
- **Not permission to populate production databases with internet research.**

A research source is **not automatically** authentic, authoritative, current, applicable to the Philippines, licensed for redistribution, legally usable, approved by counsel, or suitable for production. Research information is not legal authority.

## Directory structure

```
docs/research/intelligence/
  README.md            # this file — how to use the runway
  research-index.md    # curated master index of conclusions
  research-methodology.md  # research rules and source standards
  current-state.md     # verified project baseline (branch, HEAD, tree, tests)
  research-questions.md  # prioritized unanswered questions
  source-register.md   # metadata + links for every source used
  research-findings.md # synthesized findings
  capability-matrix.md # living product capability matrix (verified vs repo)
  research-backlog.md  # prioritized research backlog
  roadmap.md           # prioritized research roadmap
  decisions.md         # recommendation decisions (NEW..IMPLEMENTED)
  session-report.md    # last session report
  limitations-and-unknowns.md

  architecture/          # domain syntheses
  legal-infrastructure/
  legal-ai/
  authority-and-temporal/
  citations/
  retrieval-and-evaluation/
  security/
  privacy-and-licensing/
  cloudflare/
  product-and-ux/
  business/
  technology-watch/
  source-register/       # per-source records
  research-questions/    # per-question records
  decisions/             # per-recommendation records
  roadmap/               # phased plans
  archived/              # superseded conclusions
```

## The research process (every session)

1. Read `research-index.md`.
2. Read current project status (`current-state.md`, KANBAN).
3. Review existing recommendations (`decisions.md`, `research-backlog.md`).
4. Identify unanswered questions; check whether prior findings are outdated.
5. Select a bounded set of research questions.
6. Search the internet (multiple queries, official sources first, docs, academic, GitHub, independent evaluations, criticisms).
7. Read relevant sources; record concise notes only (never entire articles/PDFs).
8. Verify evidence; classify source quality (Level A–D).
9. Compare findings against the actual repository.
10. Synthesize; deduplicate aggressively.
11. Update research memory (`research-index.md`, `source-register.md`, domain syntheses).
12. Identify recommendations; update `research-backlog.md` and `roadmap.md`.
13. Identify what requires human decision.
14. Produce a concise `session-report.md`.

## Boundaries

- No bulk downloads, no mirroring, no crawling entire domains, no scraping.
- No research data enters D1, R2, a vector index, or any production table.
- No deployment, no push, no authorization change, no legal corpus expansion.
- Every claim carries a source link and a quality classification (VERIFIED FACT / SOURCE CLAIM / INDEPENDENTLY CORROBORATED / RESEARCH INFERENCE / RECOMMENDATION / UNKNOWN / DISPUTED / OUTDATED).
- Recommendations never automatically implement changes; they route through normal development and verification workflows.

## Relation to existing research

This runway builds on the completed international legal-tech dossier at
`docs/research/international-legal-tech/` (17 documents, accepted with limitations
2026-11-14, covering platforms, retrieval, AI, authority/temporal, citations,
provenance, jurisdiction comparison, Philippine gap analysis, positioning,
prioritization, architecture lessons, commercial models, roadmap). This runway
adds the repeatable process, Philippine infrastructure inventory, Cloudflare
verification, security, privacy, capability matrix, backlog, and roadmap — and
does not duplicate the existing dossier.

## Acceptance criteria (runway accepted when)

- Actual internet research was conducted across multiple source types.
- Important findings carry source links; source quality was evaluated.
- Claims are classified; contradictory findings documented.
- Philippine relevance analyzed; existing project features verified against repo.
- Research memory concise and deduplicated.
- No legal corpus downloaded; no bulk downloads; no production DB populated; no D1 research tables; no documents ingested; no vector index; no deployment; no authorization change.
- Recommendations actionable; prioritized backlog and roadmap exist; research isolation documented; future sessions can repeat the process; independent review performed; no fabricated findings; all limitations disclosed.
