# 13 — Architecture Lessons

**Research date:** 2026-11-14
**Constraint:** the project runs on Cloudflare (Workers, D1, queues). Nothing here
justifies replacing that stack. These are patterns, not vendor mandates.

## 1. Patterns worth adopting

| #   | Pattern                                            | Problem solved                                 | Demonstrated by                             | Publicly documented? | Feasible here?            | Prerequisites              | Failure mode                             |
| --- | -------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- | -------------------- | ------------------------- | -------------------------- | ---------------------------------------- |
| A1  | Immutable document registry + append-only versions | correcting/history without losing the original | legislation.gov.uk (S08); project Gates 1–7 | Yes / partially      | Yes (D1)                  | authority class, hashes    | version sprawl; unclear "current"        |
| A2  | Stable provision IDs                               | citation stability, diffs                      | legislation.gov.uk `IdURI` (S08)            | Yes                  | Yes                       | ID scheme + migration      | ID churn                                 |
| A3  | Effects ledger (edges with status/dates)           | amendment/repeal/commencement                  | legislation.gov.uk effects (S08)            | Yes                  | Yes (relational edges)    | instrument identity, dates | incomplete effects presented as complete |
| A4  | Explicit status buckets                            | current vs repealed vs uncommenced             | SSO (S14)                                   | Observed             | Yes                       | status derivation rules    | bucket drift                             |
| A5  | Citation graph                                     | related authority, citator base                | CourtListener (S07)                         | Yes (APIs)           | Yes (edge table)          | parser + resolver          | false edges                              |
| A6  | Citation lookup as an API                          | anti-hallucination guardrail                   | CourtListener (S07)                         | Yes                  | Yes                       | resolver                   | ambiguous citations                      |
| A7  | Passage-level retrieval                            | verifiable support                             | project Gate 1; vendor claims (S01–S06)     | Partial              | Yes                       | chunker + offsets          | misalignment                             |
| A8  | Hybrid retrieval + rerank                          | recall on natural language                     | Vincent (S03); CoCounsel/Harvey (S05, S06)  | Partial              | Yes (Vectorize + lexical) | evaluation set             | cost/drift; exact-citation regressions   |
| A9  | Provenance per field                               | auditability                                   | legislation.gov.uk; CourtListener           | Yes                  | Yes                       | schema discipline          | empty fields                             |
| A10 | Explicit `unknown`/`unapplied` states              | honesty                                        | legislation.gov.uk (S08)                    | Yes                  | Yes                       | product policy             | pressure to hide gaps                    |
| A11 | Human review workflow for treatment                | safe citator                                   | Westlaw/Lexis editorial (S01, S02)          | Partial              | Yes                       | reviewers, liability cover | unreviewed labels                        |
| A12 | Answer audit record                                | reproducibility                                | project Gates 4–7                           | Internal             | Yes                       | logging                    | sensitive data in logs                   |

## 2. Architectural comparisons

### Relational registry vs graph

- **Relational (D1)** is right for documents, versions, provisions, citations as
  edges, and audit. It gives constraints, transactions and simple ops.
- **Graph** is better for multi-hop traversal (cited-by-of-cited-by, amendment
  chains). It can be layered later as derived edges, not as a second source of
  truth.
- **Lesson:** keep the registry relational; expose graph queries as views/edges.
  Do not introduce a graph database before traversal is a measured need.

### Search index vs vector index

- **Lexical/metadata search** is mandatory: exact citations, section numbers,
  names. It is deterministic and cheap.
- **Vector search** helps paraphrase recall but is unproven on Philippine legal
  text and can bury exact matches. Use it as a recall booster behind a reranker.
- **Lesson:** hybrid with an exact-match bypass, not vector-first.

### Separate metadata from document storage

- **Why:** versions, provenance and hashes change independently of bytes.
- **Evidence:** legislation.gov.uk separates document metadata from representations
  (XML/AKN/PDF); CourtListener separates opinions from citations.
- **Lesson:** metadata row + immutable blob reference + hash; never store law text
  only inside a blob.

### Event-based source updates

- **Why:** sources change silently; users need diffs.
- **Evidence:** SSO new-legislation feed; legislation.gov.uk version chain.
- **Lesson:** ingestion emits `source_changed` events; downstream recomputes
  versions, effects and alerts. This matches the project's audit-first design.

### Versioned content model

- **Why:** point-in-time queries.
- **Evidence:** legislation.gov.uk; Westlaw version compare.
- **Lesson:** version is a first-class row with validity interval; "current" is a
  query, not a column.

## 3. AI orchestration pattern

Observed (documented) pattern across CoCounsel, Vincent, Harvey:

1. plan the task (visible steps);
2. retrieve from named sources;
3. generate with citations;
4. verify citations;
5. present work product with links;
6. keep the matter context.

The project should implement the same loop but with a stricter step 4: **verify
before display**, and abstain on failure. That is a small architectural difference
with a large trust consequence.

## 4. What not to copy

- A single opaque relevance score.
- A monolithic "ask anything" endpoint with no retrieval trace.
- Vector-only retrieval.
- Editorial labels without editorial process.
- A separate graph database before it is needed.
- Any architecture that requires holding unlicensed content.

## 5. Cloudflare-specific fit

| Need                  | Existing/available capability   | Note                                     |
| --------------------- | ------------------------------- | ---------------------------------------- |
| Registry + versions   | D1 (already used)               | append-only + commit markers from Gate 7 |
| Document blobs        | R2 (not yet used)               | hash + immutable key                     |
| Queue-based ingestion | Queues (config exists)          | event-driven updates                     |
| Vector recall         | Vectorize (roadmap mentions it) | add only with evaluation                 |
| Workers API           | existing apps                   | verify timeout/size limits               |
| Audit                 | D1 + append-only tables         | already proven in Gate 7                 |

No stack replacement is justified by this research.

## 6. The one architectural bet

If the project builds only one **new** thing from this section, build **A3 (the
effects ledger)**. A1 (immutable registry), A2 (provision IDs) and A10 (explicit
unknown states) are substantially implemented in Gates 1–7 and need production
hardening, not reinvention. Everything else (search, AI, analytics) can be added
on top; none of it can compensate for missing authority state.
