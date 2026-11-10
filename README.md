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

## Gate 0 Status

This repository is currently at **Gate 0: Foundation** — research, specification, and repository initialization complete. No product implementation has begun.

See `GATE0_REPORT.md` for the acceptance report.

## Documentation

- [Architecture Decisions](docs/decisions/)
- [Product Requirements](docs/product/)
- [Security](docs/security/)
- [Privacy](docs/privacy/)
- [Implementation Roadmap](docs/architecture/IMPLEMENTATION_ROADMAP.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, commit conventions, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

Proprietary — All rights reserved.
