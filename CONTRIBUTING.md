# Contributing to Philippine Legal Intelligence Platform

Thank you for contributing. This document outlines the development workflow, conventions, and review process.

## Development Workflow

### Branches

- `main` — Protected, production-ready code
- `develop` — Integration branch for ongoing work
- Feature branches: `feat/<short-description>` (e.g., `feat/legal-source-registry`)
- Fix branches: `fix/<short-description>` (e.g., `fix/citation-verification-typo`)
- Chore branches: `chore/<short-description>` (e.g., `chore/update-dependencies`)

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `style` — Formatting, no code change
- `refactor` — Code restructure, no behavior change
- `perf` — Performance improvement
- `test` — Adding or fixing tests
- `chore` — Maintenance, build, deps
- `ci` — CI/CD changes

Examples:
```
feat(legal-schema): add DocumentType enum for all PH legal document categories
fix(citation-engine): correct temporal validity check for repealed laws
docs(architecture): add SEARCH_SPECIFICATION.md with hybrid retrieval design
```

### Pull Requests

1. Branch from `develop`
2. Make small, focused commits
3. Ensure all checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
4. Update documentation if behavior changes
5. Open PR against `develop`
6. Require at least one review from a different lane (NVIDIA ↔ OpenCode)
7. Squash and merge to `develop`
8. `main` is updated via release tags only

### Code Review

Every PR requires:
- Tests added/updated for new behavior
- Type checking passes
- Linting passes
- Documentation updated
- Migration review if schema changes
- Security review if auth/permissions change

## Testing

- Write tests first (TDD)
- Unit tests for pure logic: `tests/unit/`
- Integration tests for cross-package: `tests/integration/`
- Contract tests for interfaces: `tests/contract/`
- Security tests: `tests/security/`
- E2E tests: `tests/end-to-end/`
- Run: `pnpm test`

## Legal Accuracy Requirements

This platform serves legal information. Special requirements apply:

- **No fabricated citations** — Every citation must trace to a source document
- **Original sources preserved** — Never overwrite original legal documents
- **Version immutability** — Legal versions are append-only
- **Citation verification** — Four-layer verification (identity, location, support, temporal)
- **Uncertainty disclosure** — AI must abstain when evidence is insufficient

## Environment

- Node.js >= 20.0.0 (LTS)
- pnpm >= 9.0.0 (managed via corepack)
- Cloudflare Wrangler for local development

## Questions?

Open an issue or ask in the PR discussion.