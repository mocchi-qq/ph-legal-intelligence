# Implementation Roadmap — Philippine Legal Intelligence Platform

**Gates 0 through 10 with acceptance evidence per gate. Adapted from dossier Section 18.**

## Roadmap Overview

This roadmap covers Gates 0 through 10, guiding the Philippine Legal Intelligence Platform from foundation through controlled production launch. Each gate represents a completed phase with documented acceptance evidence.

| Gate | Title |
|------|-------|
| 0 | Foundation |
| 1 | Legal Data Foundation |
| 2 | Search Infrastructure |
| 3 | Legal AI Engine |
| 4 | Application Workspace |
| 5 | Document Intelligence/DocDraft |
| 6 | Legal Knowledge Graph |
| 7 | Education/Practice Management |
| 8 | Billing/Governance/Admin |
| 9 | Independent QA |
| 10 | Controlled Production Launch |

## Gate 0 — Foundation

**Acceptance Evidence:** Repository initialized with monorepo structure (pnpm workspaces). All ADR stubs (ADR-0001 through ADR-0012) created. `GATE0_REPORT.md` exists. Unit test suite passes: `tests/unit/repo-integrity.test.ts`, `tests/unit/docs-structure.test.ts`, `tests/unit/competitor-research.test.ts`, `tests/unit/source-registry.test.ts`, `tests/unit/legal-schema.test_types` export correctly. CI pipeline (`pnpm test`) passes on clean checkout.

## Gate 1 — Legal Data Foundation

**Acceptance Evidence:** Philippine legal source registry populated with Tier 1-4 sources (Supreme Court, Court of Appeals, etc.). `AcquisitionStatus` enum exported from `@phli/legal-schema`: Approved, Restricted, Manual, Pending, Rejected. `DocumentType` enum complete with 32 document types including CONSTITUTION, STATUTE, REPUBLIC_ACT, BATAS_PAMBANSA, LOCAL_ORDINANCE, etc. `LegalStatus` enum with IN_FORCE, AMENDED, REPEALED, EXPIRED states. Source-registry test passes with all Tier 1-4 sources registered.

## Gate 2 — Search Infrastructure

**Acceptance Evidence:** Search/interface types exported from `packages/legal-search`. Vectorize index configuration defined for Cloudflare Workers. Hybrid retrieval (keyword + vector) architecture specified in LEGAL_TEMPORAL_MODEL.md. End-to-end test confirms search interface types are importable and match expected shapes.

## Gate 3 — Legal AI Engine

**Acceptance Evidence:** Citation-engine types exported from `packages/citation-engine`. Four-layer verification types defined. AI orchestrator types exported from `packages/ai-orchestrator`. Model-gateway interfaces defined for provider-agnostic model routing. Integration test confirms citation verification types have all four layers: UNVERIFIED, PENDING_REVIEW, VERIFIED, CONFLICT_DETECTED, DEFECTIVE_EXTRACTION.

## Gate 4 — Application Workspace

**Acceptance Evidence:** Admin console scaffold completed. User workspace types defined in `packages/permissions`. RBAC/ABAC types operational. Benchmark fixture structure established in `legal-data/benchmark-fixtures/`. End-to-end test confirms admin routes resolve correctly.

## Gate 5 — Document Intelligence/DocDraft

**Acceptance Evidence:** Document-parser types exported from `packages/document-parser`. Document-engine types exported from `packages/document-engine`. Parser interfaces for Philippine legal document formats defined. Integration test confirms document engine types export correctly with parse/serialize methods.

## Gate 6 — Legal Knowledge Graph

**Acceptance Evidence:** Legal graph types exported from `packages/legal-graph`. Node/edge schemas for case law, statutes, and regulations defined. Temporal modeling per LEGAL_TEMPORAL_MODEL.md established. Graph connectivity test confirms all entity types can be instantiated and related.

## Gate 7 — Education/Practice Management

**Acceptance Evidence:** Practice management workflow types defined. Education module structures specified. User onboarding flow completed per onboarding-user skill requirements. Test confirms onboarding flow completes with brand profile and competitor data.

## Gate 8 — Billing/Governance/Admin

**Acceptance Evidence:** Billing schema types defined. Governance policies documented. ADR-0013 through ADR-00xx created for billing and governance decisions. Integration test confirms billing calculations produce expected outputs.

## Gate 9 — Independent QA

**Acceptance Evidence:** QA test suite expanded with contract tests, security tests, and regression tests. Independent QA reviewer from different provider lane verified all gate cards. QA acceptance report documented.

## Gate 10 — Controlled Production Launch

**Acceptance Evidence:** All gates 0-9 verified complete. Deployment guide documented for local Wrangler dev setup. Operations runbook created with source monitoring, ingestion ops, and incident response sections. Final acceptance report GATE0_REPORT.md confirmed. System ready for controlled production access.

*Roadmap complete: Gates 0 through 10 provide the explicit implementation path from foundation to controlled production launch, with acceptance evidence documented per gate.*