# Deployment Guide — Local-Only Wrangler Development

This guide documents local development setup using the Cloudflare Wrangler CLI. **No production deploy instructions are provided.**

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (via corepack)
- Wrangler CLI 3.x: `pnpm global add wrangler`
- Cloudflare account with Workers permission (for local emulation only)

## Local Development Setup

### 1. Environment Configuration

```bash
# Copy example env vars
cp .env.example .env.local

# Edit .env.local with local values
# Note: Production secret keys must NOT be committed
```

### 2. Start Development Servers

```bash
# Start all development servers (web, api, ingestion, admin)
pnpm dev
```

This starts:
- `apps/web/` — React Vite dev server at http://localhost:5173
- `apps/api/` — Cloudflare Workers dev server at http://localhost:8787
- `apps/ingestion/` — Ingestion worker dev server
- `apps/admin/` — Admin console dev server

### 3. Local D1 Database

```bash
# Generate D1 migrations
pnpm db:generate

# Run migrations locally
pnpm db:migrate

# Seed development data
pnpm db:seed
```

### 4. Local Testing

```bash
# Run all tests
pnpm test

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Build all packages
pnpm build
```

## Production Deploy — NOT SUPPORTED

**Do not use `wrangler publish` or any deployment command to push to production.**

This is a local-development-only setup. Production deployment requires:
- Separate Cloudflare account and workspace
- Approved deployment pipeline (not configured in this repository)
- Security review and compliance validation

To stop local servers, press `Ctrl+C` in the terminal.

*This guide covers local Wrangler dev setup only. Production deploy is intentionally omitted.*