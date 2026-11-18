# Capability Matrix — Living Product Capability Matrix

**Purpose:** Compare each product capability against the verified repository (not research alone). A feature is marked implemented only when verified against code/tests/gate decisions; research findings inform the recommended direction.
**Verified against:** `/root/ph-legal-intelligence` at HEAD `1a61e2c`, KANBAN.md, gate decisions, GATE0_REPORT.md.
**Status:** initial.

| Capability | Current implementation | Verification status | Evidence | Competitor / reference | Research findings | Current gap | Recommended direction | Priority | Dependencies | Status |
|------------|----------------------|---------------------|----------|------------------------|-------------------|-------------|----------------------|----------|--------------|--------|
| Document identity | Canonical IDs (pi/pm/...) via content-addressed hashing | Implemented on synthetic fixtures | Gate 8 `authority-ids.ts`; tests | legislation.gov.uk `IdURI` (S08) | Stable IDs are a verified PH gap (F-A-6) | Real-data validation blocked | Extend to authorized sources | P1 | Counsel determination (QP-01) | Implemented (synthetic) |
| Provision identity | Stable provision IDs, version mappings | Implemented on synthetic fixtures | Gate 8 authority-ledger/mappings | legislation.gov.uk (S08) | Same as above | Real-data validation blocked | Same | P1 | Counsel determination | Implemented (synthetic) |
| Versioning | Immutable document versions + append-only triggers | Implemented | Gates 1, 7–9; migration 0009 | legislation.gov.uk versions (S08) | Version model is Tier 1 (F3) | Effectivity rules need counsel (QP-02) | Harden + counsel validation | P1 | Counsel | Implemented (synthetic) |
| Authority state | Assertion/review/projection; six outcomes; fail-closed | Implemented | Gate 8 authority-projection; Gate 12 NOT_CHECKED→UNKNOWN | legislation.gov.uk status buckets (S14) | Authority tracking is core moat | Read-time auth missing (B-3) | Add read-time auth | P1 | Gate 13/14 | Implemented (synthetic) |
| Amendment tracking | Relationship model (Gate 1) | Partially implemented | Gate 1 migration 0002 | legislation.gov.uk effects (S08) | Effects ledger is Tier 2 (F9) | Real effects data unavailable | Build on synthetic; counsel for real | P2 | Counsel | Partial |
| Legal effects | Effects ledger; append-only | Implemented (structure) | Gate 8/10 authority-ledger | legislation.gov.uk unapplied effects (S08) | Unapplied effects are a differentiator | Not populated with real data | R2 phase | P2 | Counsel | Partial |
| Citation resolution | Parser + resolver (citation-resolver) | Implemented | Gate 8 citation-resolver | CourtListener citation lookup (S07) | PH citation formats inconsistent (hypothesis) | Needs labelled PH citation set | F4; ≥95% precision target | P1 | Synthetic corpus | Implemented (synthetic) |
| Exact citation search | Exact-match routing; identifier safeguards | Implemented | Gate 3 exact-identifier-safeguards; Gate 9 | CourtListener (S07) | Exact search is Tier 1 (F5) | None on synthetic | Keep exact-bypass before ranking | P1 | None | Implemented |
| Search | Lexical + metadata; retrieval contract | Implemented (contract) | Gate 9 retrieve.ts; legal-search | Westlaw/Lexis (S01–S02) | Hybrid only if benchmarked (F16) | No semantic reranker yet | Vectorize only with eval set | P2 | Evaluation set | Contract only |
| Reranking | Not implemented | Not implemented | — | Vincent/CoCounsel (S03, S05–S06) | Vector as recall booster behind reranker | No evaluation set | Defer until benchmarked | P2 | Eval set | Not implemented |
| Citation verification | Four-layer verifier (identity/location/support/temporal) | Implemented | Gate 9/10 citation-engine | Lexis Shepard's Verify (S02) | Core differentiator; 17–33% hallucination in rivals (S09) | Real-data validation blocked | Complete support layer | P1 | Counsel | Implemented (synthetic) |
| Temporal research | as-of `[from,to)` interval semantics | Implemented | Gate 9 asOf; Gate 8 | legislation.gov.uk point-in-time (S08) | Tier 1 (F3) | Effectivity dates need counsel | Counsel validation | P1 | Counsel | Implemented (synthetic) |
| Historical research | Version queries by date | Implemented | Gate 8/9 | legislation.gov.uk (S08) | Tier 2 (F10) | Unknown dates | `INSUFFICIENT_TEMPORAL_DATA` | P2 | None | Implemented |
| Answer generation | Specified, not built | Not implemented | AI_RESEARCH_SPECIFICATION.md | CoCounsel/Harvey loop (architecture lessons) | AI only where citations pass verification | No implementation | Gated layer (R4) | P2 | Verifier + eval | Spec only |
| Abstention | Specified | Implemented (policy) | Gate 7/9 fail-closed | S09 | Explicit uncertainty is Tier 1 (F7) | Real-data validation | Keep abstain-on-failure | P1 | None | Policy only |
| Provenance | Per-record source + hash + authority class | Implemented | Gate 1/8 | legislation.gov.uk provenance (S08) | 100% of records carry provenance | Real-data validation | Maintain | P1 | None | Implemented |
| Research trails | Append-only audit | Implemented | Gate 4/7 audit trail | Project gates 4–7 | Audit is core | Sensitive data in logs | Mask secrets | P1 | None | Implemented |
| Evidence | Chunk bytes at span + contentHash | Implemented | Gate 16 effect-intake | — | Evidence-linked answers | Real-data validation | Maintain | P1 | None | Implemented |
| Authorization | ActivityAuthorizationRegistry; strict default | Implemented | Gate 4/12/13/14 | — | Fail-closed is a strength | Read-time auth missing (B-3) | Close B-3 | P1 | None | Implemented |
| Security | STRIDE threat model; append-only audit | Design-level | docs/security/ | OWASP LLM Top 10 (S-01) | LLM01 prompt injection is top risk | AI/retrieval threat model not updated; LLM01–LLM08 review not yet run | Review threat model vs LLM01–LLM08 (B-06) | P1 | None | Design only |
| Audit | Append-only audit + commit markers | Implemented | Gate 7 | — | Proven on shim; real-D1 partial | Binding batch untested | Real-D1 failure injection | P2 | Real D1 | Partial |
| User accounts | Not implemented | Not implemented | — | — | — | — | Later | P3 | — | Not implemented |
| Workspaces | Not implemented | Not implemented | — | Publishers (S01–S06) | Tier 3 (F18) | — | Gate 13 | P3 | — | Not implemented |
| Saved research | Not implemented | Not implemented | — | — | Tier 3 | — | Gate 13 | P3 | — | Not implemented |
| Notes | Not implemented | Not implemented | — | — | Tier 3 | — | Gate 13 | P3 | — | Not implemented |
| Export | Not implemented | Not implemented | — | — | Export with provenance (R3) | — | Gate 13 | P3 | — | Not implemented |
| Mobile UX | Not implemented | Not implemented | — | — | Web first; mobile later (Tier 4) | — | Defer | P3 | — | Not implemented |
| Institutional features | Not implemented | Not implemented | — | — | Tier 2/3 (F15 API) | — | Post-R3 | P2 | Counsel | Not implemented |
| API | Not implemented | Not implemented | — | CourtListener API (S07) | Verification API later (F15) | Stable verifier needed | Gate 12 | P2 | Verifier stable | Not implemented |
| Evaluation | Benchmark fixtures (placeholders) | Placeholder | 500 questions, expert_review_status PENDING | — | Published benchmark with denominators (R3) | Content requires PH legal expert | Complete fixtures | P1 | PH legal expert | Placeholder |
| Operations | Monitoring/logging/tracing stubs | Design-level | docs/operations/ | — | D1 overload is a known risk | Not load-tested | Monitoring + overload handling | P2 | None | Design only |

## How to read "Verification status"

- **Implemented** — exists in code and is covered by tests/gate evidence, on synthetic fixtures only.
- **Partial** — structure exists but real-data or production behavior is not proven.
- **Contract only** — interfaces/specs exist; no implementation.
- **Spec only** — documented but not built.
- **Placeholder** — structure exists; content/expected values require expert authorship.
- **Design only** — documented, not implemented/tested.

**Rule:** Do not mark features implemented based on research alone. Verify against the repository.
