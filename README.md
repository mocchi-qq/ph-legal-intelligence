# Philippine Legal Intelligence Platform

A nationwide Philippine legal intelligence platform combining a comprehensive legal knowledge base, AI-powered legal research with verified citations, case analysis, document intelligence, legal drafting, and case management.

## Architecture

- **Frontend:** React 18 + Vite + TypeScript
- **API:** Cloudflare Workers + TypeScript
- **Database:** Cloudflare D1 (SQLite) for metadata, R2 for document storage
- **Search:** Cloudflare Vectorize / AI Search for hybrid retrieval
- **Async:** Cloudflare Queues for ingestion and embedding pipelines
- **Package Manager:** pnpm workspaces (monorepo)

## Project Structure

```
ph-legal-intelligence/
├── apps/
│   ├── web/          # Public & professional web application
│   ├── api/          # Cloudflare Workers API
│   ├── ingestion/    # Legal document ingestion worker
│   ├── admin/        # Administrative console
│   └── benchmark/    # Legal accuracy benchmark runner
├── packages/
│   ├── contracts/          # Shared TypeScript interfaces
│   ├── domain/             # Legal domain models
│   ├── database/           # D1 repository abstractions
│   ├── auth/               # Authentication primitives
│   ├── legal-schema/       # Canonical legal document schemas
│   ├── legal-ingestion/    # Ingestion pipeline types
│   ├── legal-search/       # Search interfaces
│   ├── legal-graph/        # Knowledge graph types
│   ├── ai-orchestrator/    # AI orchestration types
│   ├── model-gateway/      # Model provider interfaces
│   ├── citation-engine/    # Citation verification types
│   ├── document-engine/    # Document processing types
│   ├── document-parser/    # Parser interfaces
│   ├── permissions/        # RBAC/ABAC types
│   ├── observability/      # Logging/metrics types
│   └── shared/             # Utilities
├── migrations/
│   ├── d1/           # D1 SQL migrations
│   └── seed/         # Seed data
├── legal-data/
│   ├── source-registry/  # Legal source registry
│   ├── taxonomy/         # Document type taxonomy
│   ├── schemas/          # JSON schemas
│   └── benchmark-fixtures/ # Test fixtures
├── docs/                 # Documentation
└── tests/                # Test suites
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (via corepack)
- Wrangler CLI for Cloudflare development

### Installation

```bash
# Enable corepack and pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Install dependencies
pnpm install

# Verify environment
bash scripts/verify-env.sh
```

### Development

```bash
# Start all development servers
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build all packages
pnpm build
```

### Database (Local D1)

```bash
# Generate migrations
pnpm db:generate

# Run migrations locally
pnpm db:migrate

# Seed development data
pnpm db:seed
```

## Status

This repository is at **Gate 11: maintenance and ingest idempotence**. Gates 0–10
are complete; the authoritative record of each is its `DECISION.md` under
`docs/gates/`.

What exists is a **synthetic-only** engineering system: deterministic retrieval, a
four-layer citation verifier, an append-only legal-effects ledger with a
temporal projection, and a D1 adapter validated against a SQLite shim. Supported
claims are labelled in each gate decision as implemented, tested, independently
verified, and legally authorised — those are four different things and the
repository does not conflate them.

What does not exist: any real Philippine legal document. **Zero** counsel
determinations have been made, all **350** source-authorisation cells are
`UNKNOWN`, and the four pilot documents remain `BLOCKED_AUTHORIZATION`. Nothing
here is a legal authority, a legal opinion, or a deployed service.

| Gate | Subject                                                     | Verdict record                            |
| ---- | ----------------------------------------------------------- | ----------------------------------------- |
| 0    | Foundation                                                  | `GATE0_REPORT.md` (repository root)       |
| 1–4  | Ingestion, retrieval, citation engine, authorisation matrix | `GATE*_REPORT.md` in `docs/gates/gate-N/` |
| 5    | Counsel registry and determinations                         | ACCEPTED WITH LIMITATIONS                 |
| 6    | Corpus readiness and execution plan                         | ACCEPTED WITH LIMITATIONS                 |
| 7    | D1 runtime, migrations, API surface                         | ACCEPTED WITH LIMITATIONS                 |
| 8    | Authority core: assertions, reviews, projection             | ACCEPTED WITH LIMITATIONS                 |
| 9    | Passage-level retrieval contract                            | ACCEPTED                                  |
| 10   | Authority-aware verification and D1 ledger store            | ACCEPTED WITH LIMITATIONS                 |
| 11   | Maintenance and ingest idempotence                          | in progress — see `docs/gates/gate-11/`   |

Each verdict is a `DECISION.md` in the gate directory, except Gate 0, which
records it in `GATE0_REPORT.md` at the repository root, and Gates 1–4, which
record it in their `GATE*_REPORT.md` inside `docs/gates/gate-N/`.

## Documentation

- [Architecture Decisions](docs/decisions/)
- [Product Requirements](docs/product/)
- [Data Governance](docs/data-governance/)
- [Retrieval Specification](docs/retrieval/)
- [API Specification](docs/api/)
- [Security](docs/security/)
- [Privacy](docs/privacy/)
- [Implementation Roadmap](docs/architecture/IMPLEMENTATION_ROADMAP.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, commit conventions, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

Proprietary — All rights reserved.
