# Test Strategy — Philippine Legal Intelligence Platform

## Test Pyramid

The test pyramid defines the distribution of test types across the project, ensuring adequate coverage at each level while maintaining fast feedback loops.

| Level | Purpose | Scope | Target Ratio |
|-------|---------|-------|--------------|
| **Unit** | Verify individual functions, utilities, and pure modules in isolation | Each function, enum, type guard, utility | 70% of all tests |
| **Integration** | Verify interactions between modules, services, and D1 database operations | API routes, database migrations, ingestion pipelines, citation verification pipeline | 20% of all tests |
| **Contract** | Verify API contracts between packages, schema compatibility, and type safety | Package exports, shared interfaces, Zod/Avalon schemas | 5% of all tests |
| **Security** | Verify authentication, authorization, data protection, and threat mitigation | Auth flow, RBAC/ABAC enforcement, PII handling, header validation | 3% of all tests |
| **regression** | Verify that recent changes have not broken existing functionality | Full test suite re-run on PR merge, snapshot comparisons | 2% of all tests |
| **E2E** | Verify critical user journeys from UI through to database | Onboarding flow, document upload and parsing, search and retrieval, citation validation | ≤1% of all tests (run on every merge) |

## Benchmarking Approach

Benchmarking evaluates the platform's legal accuracy, retrieval effectiveness, and AI model performance using structured fixturing.

- **Fixture-driven benchmarks**: 500+ question fixture structure in `legal-data/benchmark-fixtures/` covering Philippine legal topics, document types, and citation patterns.
- **Retrieval precision/recall**: Measure against gold-standard relevance judgments for statute, case law, and regulation queries.
- **Citation verification accuracy**: Compare automated verification against manual attorney review for a stratified sample.
- **AI model response quality**: LLM-as-judge evaluation of answer correctness, citation fidelity, and legal reasoning quality.
- **Performance benchmarks**: Response time targets (search < 200ms, ingestion < 5s per document, drafting < 3s per document).

Benchmarks are run via `pnpm bench` and results are stored in `docs/benchmarks/` with timestamped comparison reports.

## CI Pipeline

The CI pipeline is configured via GitHub Actions and local `pnpm` scripts:

| Stage | Command | Purpose |
|-------|---------|---------|
| **Lint** | `pnpm lint` | Code style and format checking (Biome) |
| **Type Check** | `pnpm typecheck` | TypeScript compilation across all packages |
| **Unit Tests** | `pnpm test` | Run vitest unit + integration test suite |
| **Contract Tests** | `pnpm contract:test` | Verify package API contracts |
| **Security Scan** | `pnpm security:scan` | Dependency vulnerability scanning |
| **Build** | `pnpm build` | Build all packages and apps |
| **E2E Tests** | `pnpm e2e:test` | Run end-to-end test suite (Playwright) |

CI fails on any lint, type, or test error. All gates must pass their respective acceptance tests before a PR can be merged.

*Continuous integration runs on every pull request. Reviewers must come from a different provider lane than the author (Lane A = nvidia, Lane B = opencode).*