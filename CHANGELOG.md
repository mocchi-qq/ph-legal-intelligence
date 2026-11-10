# Changelog

All notable changes to the Philippine Legal Intelligence Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Repository initialization with pnpm monorepo workspace
- All app scaffolds: web, api, ingestion, admin, benchmark
- All package scaffolds: contracts, domain, database, auth, legal-schema, legal-ingestion, legal-search, legal-graph, ai-orchestrator, model-gateway, citation-engine, document-engine, document-parser, permissions, observability, shared
- TypeScript base configuration, Biome linting, Vitest testing
- Root configuration files: package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, .gitignore, .editorconfig, .env.example

### Documentation

- COMPETITOR_RESEARCH.md — Competitor analysis with clear separation of observed vs planned scope
- DATA_SOURCE_REGISTER.md — Philippine legal source inventory (Tiers 1–4)
- SOURCE_ACQUISITION_POLICY.md — Five-status acquisition policy
- LEGAL_DATA_MODEL.md — Four-object canonical document model
- LEGAL_TEMPORAL_MODEL.md — Multi-date temporal model with statuses
- SEARCH_SPECIFICATION.md — Hybrid retrieval architecture
- AI_RESEARCH_SPECIFICATION.md — AI orchestration and structured answer schemas
- CITATION_VERIFICATION.md — Four-layer citation verification
- THREAT_MODEL.md — STRIDE-based threat model
- SECURITY_ARCHITECTURE.md — Zero-trust application design
- PRIVACY_SPECIFICATION.md — DPA 2012 and NPC AI guidance compliance
- AI_GOVERNANCE.md — SC Judiciary AI Governance Framework mapping
- IMPLEMENTATION_ROADMAP.md — Gates 0–10 phased plan
- TEST_STRATEGY.md — Test pyramid and benchmarking approach
- KNOWN_LIMITATIONS.md — Research gaps and unresolved questions
- DEPLOYMENT_GUIDE.md — Local-only deployment instructions
- OPERATIONS_RUNBOOK.md — Operational procedures stub
- LEGAL_BENCHMARK.md — Benchmark design, metrics, launch gates
- ADR-0001 through ADR-0012 — Architecture decision record stubs

### Infrastructure

- D1 migration 0001_legal_documents.sql — Legal documents schema
- Cloudflare infrastructure configuration stubs
- CI/CD workflow template

## [0.0.0-gate0] — Gate 0 Acceptance

Initial Gate 0 release: repository initialized, all specifications documented, architecture decision records created, test suite passes, environment verified.
