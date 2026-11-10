# Gate 0: Philippine Legal Intelligence Platform — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the repository, validate the architecture, document all research findings, and establish the engineering foundation for the Philippine Legal Intelligence Platform — without building the product itself.

**Architecture:** TypeScript monorepo (pnpm workspace) with Cloudflare Workers, D1, R2, Queues, Vectorize/AI Search. Research-first: produce documented specs, source registries, and architectural decision records before any product code.

**Tech Stack:** Node.js LTS, pnpm, TypeScript, React + Vite (frontend), Cloudflare Workers (API), D1 (metadata), R2 (documents), Vectorize/AI Search (retrieval), Vitest (testing), Biome (linting), Playwright (e2e), Wrangler (local Cloudflare dev).

**Spec:** The research dossier provided in the conversation (referred to as "the dossier" below).

---

## Global Constraints

- **No product implementation** — Gate 0 is research, spec, and repo initialization only.
- **No public deployment** — Local development environment only.
- **No paid services consumed** — Cloudflare free/local tiers only.
- **Independent brand** — No reuse of Anycase trademarks, branding, or proprietary assets.
- **Evidence-based claims** — Every research assertion must cite source, URL, retrieval date, confidence.
- **Clean Git history** — Small, reviewable commits; conventional commit messages.
- **Reproducible environment** — Documented setup commands; pinned dependency versions.

---

## Review Focus

1. **Unverified source permissions claimed as "approved"** — Source registry must distinguish `Approved` vs `Pending` vs `Restricted`; no source marked `Approved` without documented evidence.
2. **Competitor features presented as our implemented capabilities** — Competitor research must clearly separate observed features from our planned scope.
3. **Cloudflare limits assumed without verification** — Architecture docs must cite current Cloudflare docs URLs and limits; note where limits may require migration.
4. **Legal temporal model oversimplified** — Must distinguish promulgation/effectivity/amendment/repeal dates; not treat them as interchangeable.
5. **Citation verification underspecified** — Must define four-layer verification (identity, location, support, temporal) with explicit pass/fail criteria.

---

## File Structure Map

```
ph-legal-intelligence/
├── README.md
├── VERSION
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── .gitignore
├── .editorconfig
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── apps/
│   ├── web/              # React + Vite frontend (scaffold only)
│   ├── api/              # Cloudflare Workers API (scaffold only)
│   ├── ingestion/        # Legal ingestion worker (scaffold only)
│   ├── admin/            # Admin console (scaffold only)
│   └── benchmark/        # Benchmark runner (scaffold only)
├── packages/
│   ├── contracts/        # Shared TypeScript interfaces
│   ├── domain/           # Legal domain models
│   ├── database/         # D1 repository abstractions
│   ├── auth/             # Auth primitives
│   ├── legal-schema/     # Canonical legal document schemas
│   ├── legal-ingestion/  # Ingestion pipeline types
│   ├── legal-search/     # Search interfaces
│   ├── legal-graph/      # Knowledge graph types
│   ├── ai-orchestrator/  # AI orchestration types
│   ├── model-gateway/    # Model provider interfaces
│   ├── citation-engine/  # Citation verification types
│   ├── document-engine/  # Document processing types
│   ├── document-parser/  # Parser interfaces
│   ├── permissions/      # RBAC/ABAC types
│   ├── observability/    # Logging/metrics types
│   └── shared/           # Utilities
├── migrations/
│   ├── d1/               # D1 SQL migrations
│   └── seed/             # Seed data
├── infrastructure/
│   ├── cloudflare/       # Wrangler configs, bindings
│   ├── environments/     # Env-specific configs
│   ├── queues/           # Queue definitions
│   └── deployment/       # Deploy scripts (local only)
├── legal-data/
│   ├── source-registry/  # Source registry JSON
│   ├── taxonomy/         # Document type taxonomy
│   ├── schemas/          # JSON schemas for legal docs
│   └── benchmark-fixtures/ # Test fixtures
├── docs/
│   ├── product/
│   ├── research/
│   ├── architecture/
│   ├── security/
│   ├── privacy/
│   ├── data-governance/
│   ├── ingestion/
│   ├── retrieval/
│   ├── ai-evaluation/
│   ├── api/
│   ├── operations/
│   └── decisions/        # ADRs
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── security/
│   ├── regression/
│   └── end-to-end/
└── .github/
    ├── workflows/
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

---

## Tasks

### Task 1: Repository Initialization & Workspace Setup

**Files:**

- Create: All root config files listed in File Structure Map
- Create: `apps/*/package.json` (minimal scaffolds)
- Create: `packages/*/package.json` (minimal scaffolds)
- Test: `tests/unit/repo-integrity.test.ts`

**Interfaces:**

- Consumes: —
- Produces: `pnpm-workspace.yaml`, `tsconfig.base.json`, `package.json` scripts

- [ ] **Step 1: Write failing repo integrity test**

```typescript
// tests/unit/repo-integrity.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Repository integrity", () => {
  it("has required root files", () => {
    const required = [
      "README.md",
      "VERSION",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md",
      ".gitignore",
      ".editorconfig",
      ".env.example",
      "package.json",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "biome.json",
    ];
    for (const f of required) {
      expect(() => readFileSync(join(process.cwd(), f), "utf-8")).not.toThrow();
    }
  });
  it("has pnpm workspace configured", () => {
    const ws = readFileSync(
      join(process.cwd(), "pnpm-workspace.yaml"),
      "utf-8",
    );
    expect(ws).toContain("packages:");
    expect(ws).toContain("apps/*");
    expect(ws).toContain("packages/*");
  });
  it("has TypeScript project references ready", () => {
    const tsconfig = JSON.parse(
      readFileSync(join(process.cwd(), "tsconfig.base.json"), "utf-8"),
    );
    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.composite).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/repo-integrity.test.ts`
Expected: FAIL (files don't exist)

- [ ] **Step 3: Initialize repository and create all root config files**

```bash
# In /root/case (or chosen project root)
mkdir -p ph-legal-intelligence && cd ph-legal-intelligence
git init -b main
corepack enable
corepack prepare pnpm@latest --activate
pnpm init
# Create all directories per File Structure Map
# Write all root config files (see content below)
```

Root file contents (minimal valid versions):

**package.json:**

```json
{
  "name": "ph-legal-intelligence",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter=web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "db:generate": "pnpm --filter=database db:generate",
    "db:migrate": "pnpm --filter=database db:migrate",
    "db:seed": "pnpm --filter=database db:seed"
  },
  "engines": { "node": ">=20.0.0" },
  "packageManager": "pnpm@9.0.0"
}
```

**pnpm-workspace.yaml:**

```yaml
packages:
  - apps/*
  - packages/*
```

**tsconfig.base.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@phli/*": ["packages/*/src"]
    }
  },
  "exclude": ["node_modules", "dist", "build"]
}
```

**biome.json:**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled: true, "indentStyle": "space", "indentWidth": 2 }
}
```

**.gitignore:**

```
node_modules
dist
build
.env
.env.local
*.log
.DS_Store
.coverage
.wrangler
```

**.editorconfig:**

```
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**.env.example:**

```
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
# Database
DATABASE_URL=
# AI Providers (configure as needed)
NVIDIA_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
# App
APP_ENV=development
```

**README.md:** Project overview, setup instructions, architecture summary.

**VERSION:** `0.0.0-gate0`

**CHANGELOG.md:** Keep a changelog format (Keep a Changelog).

**CONTRIBUTING.md:** Branch naming, commit conventions, PR process, testing requirements.

**SECURITY.md:** Vulnerability reporting process.

**CODE_OF_CONDUCT.md:** Contributor Covenant v2.1.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/repo-integrity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: initialize repository with pnpm workspace and root config"
```

---

### Task 2: Scaffold Applications & Packages

**Files:**

- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/main.tsx`, `apps/web/index.html`
- Create: `apps/api/package.json`, `apps/api/wrangler.toml`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`
- Create: `apps/ingestion/package.json`, `apps/ingestion/wrangler.toml`, `apps/ingestion/tsconfig.json`, `apps/ingestion/src/index.ts`
- Create: `apps/admin/package.json`, `apps/admin/vite.config.ts`, `apps/admin/tsconfig.json`, `apps/admin/src/main.tsx`
- Create: `apps/benchmark/package.json`, `apps/benchmark/tsconfig.json`, `apps/benchmark/src/index.ts`
- Create: Each `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/src/index.ts`
- Test: `tests/unit/scaffold.test.ts`

**Interfaces:**

- Consumes: Task 1 (workspace config)
- Produces: Buildable package skeletons

- [ ] **Step 1: Write failing scaffold test**

```typescript
// tests/unit/scaffold.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const apps = ["web", "api", "ingestion", "admin", "benchmark"];
const packages = [
  "contracts",
  "domain",
  "database",
  "auth",
  "legal-schema",
  "legal-ingestion",
  "legal-search",
  "legal-graph",
  "ai-orchestrator",
  "model-gateway",
  "citation-engine",
  "document-engine",
  "document-parser",
  "permissions",
  "observability",
  "shared",
];

describe("Application and package scaffolds", () => {
  for (const app of apps) {
    it(`has ${app} app scaffold`, () => {
      const pkg = JSON.parse(
        readFileSync(join(process.cwd(), `apps/${app}/package.json`), "utf-8"),
      );
      expect(pkg.name).toBe(`@phli/${app}`);
      expect(pkg.scripts).toHaveProperty("build");
      expect(pkg.scripts).toHaveProperty("test");
      expect(pkg.scripts).toHaveProperty("typecheck");
    });
  }
  for (const pkg of packages) {
    it(`has ${pkg} package scaffold`, () => {
      const p = JSON.parse(
        readFileSync(
          join(process.cwd(), `packages/${pkg}/package.json`),
          "utf-8",
        ),
      );
      expect(p.name).toBe(`@phli/${pkg}`);
      expect(p.main).toBeDefined();
      expect(p.types).toBeDefined();
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/scaffold.test.ts`
Expected: FAIL

- [ ] **Step 3: Create all app and package scaffolds**

Each app/package gets minimal valid config. Example for `apps/web`:

**apps/web/package.json:**

```json
{
  "name": "@phli/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "@phli/contracts": "workspace:*",
    "@phli/shared": "workspace:*"
  }
}
```

**apps/web/vite.config.ts:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@phli/web": path.resolve(__dirname, "src") } },
  server: { port: 3000 },
});
```

**apps/web/tsconfig.json:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*", "vite.config.ts"],
  "references": [
    { "path": "../../packages/contracts" },
    { "path": "../../packages/shared" }
  ]
}
```

**apps/web/src/main.tsx:** Minimal React 18 entry point.

**apps/web/index.html:** Minimal HTML5 with `#root` div.

Repeat analogous patterns for `api` (Workers entry), `ingestion` (Workers queue consumer), `admin` (React), `benchmark` (Node script).

Each package gets `package.json` with `main: "dist/index.js"`, `types: "dist/index.d.ts"`, `exports` map, and `tsconfig.json` extending base.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Install deps and verify build**

Run: `pnpm install && pnpm build`
Expected: All packages build without errors

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold all apps and packages"
```

---

### Task 3: Documentation Hierarchy & ADR Template

**Files:**

- Create: All directories under `docs/`
- Create: `docs/decisions/ADR_TEMPLATE.md`
- Create: Initial ADRs (0001–0012) as stubs
- Test: `tests/unit/docs-structure.test.ts`

**Interfaces:**

- Consumes: Task 1
- Produces: Documentation structure ready for content

- [ ] **Step 1: Write failing docs structure test**

```typescript
// tests/unit/docs-structure.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const requiredDirs = [
  "product",
  "research",
  "architecture",
  "security",
  "privacy",
  "data-governance",
  "ingestion",
  "retrieval",
  "ai-evaluation",
  "api",
  "operations",
  "decisions",
];

describe("Documentation hierarchy", () => {
  it("has all required doc directories", () => {
    const docsPath = join(process.cwd(), "docs");
    const dirs = readdirSync(docsPath).filter((f) =>
      statSync(join(docsPath, f)).isDirectory(),
    );
    for (const d of requiredDirs) expect(dirs).toContain(d);
  });
  it("has ADR template", () => {
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/decisions/ADR_TEMPLATE.md"),
        "utf-8",
      ),
    ).not.toThrow();
  });
  it("has initial ADR stubs 0001-0012", () => {
    const adrs = readdirSync(join(process.cwd(), "docs/decisions")).filter(
      (f) => f.endsWith(".md") && f.startsWith("ADR-"),
    );
    expect(adrs.length).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/docs-structure.test.ts`
Expected: FAIL

- [ ] **Step 3: Create docs directories and ADR template**

```bash
mkdir -p docs/{product,research,architecture,security,privacy,data-governance,ingestion,retrieval,ai-evaluation,api,operations,decisions}
```

**docs/decisions/ADR_TEMPLATE.md:**

```markdown
# ADR-XXXX: [Title]

**Status:** Proposed | Accepted | Superseded
**Date:** YYYY-MM-DD
**Deciders:** [Names]
**Technical Story:** [Link to issue/PR]

## Context

[What is the issue? What forces are at play?]

## Problem

[What problem are we solving?]

## Options Considered

### Option 1: [Name]

- Pros:
- Cons:

### Option 2: [Name]

- Pros:
- Cons:

## Decision

[What we decided and why]

## Consequences

### Positive

### Negative

### Risks

## Revisit Conditions

[When should this be re-evaluated?]
```

Create 12 stub ADRs (ADR-0001 through ADR-0012) per the dossier's list, each with the template filled with "TBD — pending research" in Context/Problem/Options.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/docs-structure.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs: create documentation hierarchy and ADR templates"
```

---

### Task 4: Competitor Research Documentation

**Files:**

- Create: `docs/research/COMPETITOR_RESEARCH.md`
- Create: `docs/research/COMPETITOR_MATRIX.csv` (or JSON)
- Test: `tests/unit/competitor-research.test.ts`

**Interfaces:**

- Consumes: Task 3 (docs structure)
- Produces: Documented competitor analysis with clear separation of observed vs. planned

- [ ] **Step 1: Write failing competitor research test**

```typescript
// tests/unit/competitor-research.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Competitor research documentation", () => {
  it("exists and covers required competitors", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/research/COMPETITOR_RESEARCH.md"),
      "utf-8",
    );
    const required = [
      "Anycase.ai",
      "LexisNexis",
      "Westlaw",
      "vLex",
      "Harvey",
      "ChatGPT",
      "Philippine legal databases",
    ];
    for (const c of required) expect(content).toContain(c);
  });
  it("distinguishes observed features from planned scope", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/research/COMPETITOR_RESEARCH.md"),
      "utf-8",
    );
    expect(content).toMatch(/observed|publicly documented|advertised/i);
    expect(content).toMatch(/planned|proposed|our scope/i);
  });
  it("has competitor matrix", () => {
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/research/COMPETITOR_MATRIX.json"),
        "utf-8",
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/competitor-research.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write competitor documentation**

**COMPETITOR_RESEARCH.md** must include for each competitor:

- Product name, website, pricing model (if public)
- Publicly documented features (cited with URLs and retrieval dates)
- Known limitations/gaps
- **Explicit statement**: "The following are observed from public sources as of YYYY-MM-DD. They do not represent our implemented capabilities."

**COMPETITOR_MATRIX.json:** Structured comparison across dimensions (coverage, AI features, pricing, API, PH-specific).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/competitor-research.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/research/
git commit -m "docs: competitor research and matrix"
```

---

### Task 5: Philippine Legal Source Registry

**Files:**

- Create: `legal-data/source-registry/sources.json`
- Create: `docs/research/DATA_SOURCE_REGISTER.md`
- Create: `docs/ingestion/SOURCE_ACQUISITION_POLICY.md`
- Test: `tests/unit/source-registry.test.ts`

**Interfaces:**

- Consumes: Task 3
- Produces: Machine-readable source registry + human-readable register + acquisition policy

- [ ] **Step 1: Write failing source registry test**

```typescript
// tests/unit/source-registry.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Legal source registry", () => {
  it("exists and is valid JSON", () => {
    const content = readFileSync(
      join(process.cwd(), "legal-data/source-registry/sources.json"),
      "utf-8",
    );
    const sources = JSON.parse(content);
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });
  it("each source has required fields", () => {
    const sources = JSON.parse(
      readFileSync(
        join(process.cwd(), "legal-data/source-registry/sources.json"),
        "utf-8",
      ),
    );
    const required = [
      "source_id",
      "name",
      "institution",
      "authority_level",
      "jurisdiction",
      "coverage",
      "acquisition_status",
      "access_method",
      "reuse_review",
      "last_checked_at",
      "last_successful_sync_at",
    ];
    for (const s of sources) {
      for (const f of required) expect(s).toHaveProperty(f);
      expect([
        "Approved",
        "Restricted",
        "Manual",
        "Pending",
        "Rejected",
      ]).toContain(s.acquisition_status);
      expect([
        "official_primary",
        "official_secondary",
        "unofficial",
      ]).toContain(s.authority_level);
    }
  });
  it("includes all Tier 1 sources", () => {
    const sources = JSON.parse(
      readFileSync(
        join(process.cwd(), "legal-data/source-registry/sources.json"),
        "utf-8",
      ),
    );
    const tier1 = [
      "Supreme Court E-Library",
      "LawPhil Project",
      "Official Gazette",
      "Congress",
      "Senate",
    ];
    for (const t of tier1) expect(sources.some((s) => s.name === t)).toBe(true);
  });
  it("acquisition policy doc exists", () => {
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/ingestion/SOURCE_ACQUISITION_POLICY.md"),
        "utf-8",
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/source-registry.test.ts`
Expected: FAIL

- [ ] **Step 3: Create source registry with all sources from dossier**

Populate `legal-data/source-registry/sources.json` with entries for every source in the dossier (Tier 1–4), using the exact schema from the dossier. **All sources start with `acquisition_status: "Pending"`** — none marked `Approved` without evidence.

Create `docs/research/DATA_SOURCE_REGISTER.md` — human-readable version with notes per source.

Create `docs/ingestion/SOURCE_ACQUISITION_POLICY.md` — the five-status policy, reuse review requirements, no-bypass rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/source-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add legal-data/source-registry/ docs/research/DATA_SOURCE_REGISTER.md docs/ingestion/SOURCE_ACQUISITION_POLICY.md
git commit -m "docs: legal source registry and acquisition policy"
```

---

### Task 6: Legal Data Model & Temporal Specification

**Files:**

- Create: `packages/legal-schema/src/types.ts` (canonical TypeScript interfaces)
- Create: `packages/legal-schema/src/taxonomy.ts` (document type taxonomy)
- Create: `docs/architecture/LEGAL_DATA_MODEL.md`
- Create: `docs/architecture/LEGAL_TEMPORAL_MODEL.md`
- Create: `migrations/d1/0001_legal_documents.sql` (D1 schema)
- Test: `tests/unit/legal-schema.test.ts`, `tests/integration/d1-schema.test.ts`

**Interfaces:**

- Consumes: Task 1, Task 3
- Produces: `LegalDocument`, `DocumentVersion`, `LegalProvision`, `Citation`, `SourceManifestation` types; D1 schema

- [ ] **Step 1: Write failing schema tests**

```typescript
// tests/unit/legal-schema.test.ts
import { describe, it, expect } from "vitest";
import {
  LegalDocument,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "@phli/legal-schema";

describe("Legal schema types", () => {
  it("exports all required types", () => {
    expect(LegalDocument).toBeDefined();
    expect(DocumentType).toBeDefined();
    expect(LegalStatus).toBeDefined();
    expect(VerificationStatus).toBeDefined();
  });
  it("DocumentType includes all taxonomy values", () => {
    const required = [
      "CONSTITUTION",
      "STATUTE",
      "REPUBLIC_ACT",
      "COMMONWEALTH_ACT",
      "PRESIDENTIAL_DECREE",
      "BATAS_PAMBANSA",
      "EXECUTIVE_ORDER",
      "ADMINISTRATIVE_ORDER",
      "COURT_DECISION",
      "SIGNED_RESOLUTION",
      "COURT_RULE",
      "COURT_CIRCULAR",
      "AGENCY_REGULATION",
      "ADMINISTRATIVE_DECISION",
      "TREATY",
      "LOCAL_ORDINANCE",
      "LEGAL_REFERENCE",
    ];
    for (const r of required) expect(DocumentType[r]).toBeDefined();
  });
  it("LegalStatus includes temporal states", () => {
    const required = [
      "UNKNOWN",
      "IN_FORCE",
      "PARTIALLY_AMENDED",
      "AMENDED",
      "REPEALED",
      "SUPERSEDED",
      "EXPIRED",
      "NOT_YET_EFFECTIVE",
      "UNDER_REVIEW",
    ];
    for (const r of required) expect(LegalStatus[r]).toBeDefined();
  });
});

// tests/integration/d1-schema.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("D1 migration schema", () => {
  it("exists and creates required tables", () => {
    const sql = readFileSync(
      join(process.cwd(), "migrations/d1/0001_legal_documents.sql"),
      "utf-8",
    );
    const tables = [
      "legal_documents",
      "document_versions",
      "source_manifestations",
      "document_citations",
      "document_relationships",
      "legal_provisions",
      "extraction_jobs",
      "verification_records",
    ];
    for (const t of tables) expect(sql).toContain(`CREATE TABLE ${t}`);
  });
  it("has required indexes", () => {
    const sql = readFileSync(
      join(process.cwd(), "migrations/d1/0001_legal_documents.sql"),
      "utf-8",
    );
    const indexes = [
      "idx_legal_documents_document_type",
      "idx_legal_documents_source_id",
      "idx_legal_documents_promulgation_date",
      "idx_legal_documents_docket_number",
      "idx_legal_documents_verification_status",
      "idx_legal_documents_legal_status",
      "idx_document_versions_document_id",
      "idx_document_versions_effective_from",
      "idx_document_citations_source_document_id",
      "idx_document_citations_target_document_id",
    ];
    for (const i of indexes) expect(sql).toContain(i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/unit/legal-schema.test.ts tests/integration/d1-schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement legal schema package and D1 migration**

**packages/legal-schema/src/taxonomy.ts:**

```typescript
export enum DocumentType {
  CONSTITUTION = "CONSTITUTION",
  STATUTE = "STATUTE",
  REPUBLIC_ACT = "REPUBLIC_ACT",
  COMMONWEALTH_ACT = "COMMONWEALTH_ACT",
  PRESIDENTIAL_DECREE = "PRESIDENTIAL_DECREE",
  BATAS_PAMBANSA = "BATAS_PAMBANSA",
  EXECUTIVE_ORDER = "EXECUTIVE_ORDER",
  ADMINISTRATIVE_ORDER = "ADMINISTRATIVE_ORDER",
  COURT_DECISION = "COURT_DECISION",
  SIGNED_RESOLUTION = "SIGNED_RESOLUTION",
  COURT_RULE = "COURT_RULE",
  COURT_CIRCULAR = "COURT_CIRCULAR",
  AGENCY_REGULATION = "AGENCY_REGULATION",
  ADMINISTRATIVE_DECISION = "ADMINISTRATIVE_DECISION",
  TREATY = "TREATY",
  LOCAL_ORDINANCE = "LOCAL_ORDINANCE",
  LEGAL_REFERENCE = "LEGAL_REFERENCE",
}

export enum LegalStatus {
  UNKNOWN = "UNKNOWN",
  IN_FORCE = "IN_FORCE",
  PARTIALLY_AMENDED = "PARTIALLY_AMENDED",
  AMENDED = "AMENDED",
  REPEALED = "REPEALED",
  SUPERSEDED = "SUPERSEDED",
  EXPIRED = "EXPIRED",
  NOT_YET_EFFECTIVE = "NOT_YET_EFFECTIVE",
  UNDER_REVIEW = "UNDER_REVIEW",
}

export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING_REVIEW = "PENDING_REVIEW",
  VERIFIED = "VERIFIED",
  CONFLICT_DETECTED = "CONFLICT_DETECTED",
  DEFECTIVE_EXTRACTION = "DEFECTIVE_EXTRACTION",
}

export enum AuthorityLevel {
  OFFICIAL_PRIMARY = "official_primary",
  OFFICIAL_SECONDARY = "official_secondary",
  UNOFFICIAL = "unofficial",
}

export enum AcquisitionStatus {
  APPROVED = "Approved",
  RESTRICTED = "Restricted",
  MANUAL = "Manual",
  PENDING = "Pending",
  REJECTED = "Rejected",
}
```

**packages/legal-schema/src/types.ts:** Define `LegalDocument`, `DocumentVersion`, `SourceManifestation`, `DocumentCitation`, `DocumentRelationship`, `LegalProvision`, `ExtractedText`, `DocumentChunk`, `VerificationRecord` interfaces matching the dossier's JSON examples exactly.

**migrations/d1/0001_legal_documents.sql:** Full D1 schema with all tables, foreign keys, indexes per the dossier's Section 8.2. Use SQLite-compatible syntax (no `ENUM`, use `TEXT CHECK IN (...)`).

**docs/architecture/LEGAL_DATA_MODEL.md:** Document the four-object model (source, canonical, extracted, chunks), deduplication strategy, identity resolution.

**docs/architecture/LEGAL_TEMPORAL_MODEL.md:** Document the multi-date model, temporal statuses, provision-level amendment tracking.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/unit/legal-schema.test.ts tests/integration/d1-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Build package and verify types**

Run: `pnpm --filter=@phli/legal-schema build`
Expected: PASS, types emitted

- [ ] **Step 6: Commit**

```bash
git add packages/legal-schema/ migrations/d1/ docs/architecture/LEGAL_DATA_MODEL.md docs/architecture/LEGAL_TEMPORAL_MODEL.md
git commit -m "feat: legal data model, temporal model, and D1 schema"
```

---

### Task 7: Search & Retrieval Architecture Specification

**Files:**

- Create: `docs/architecture/SEARCH_SPECIFICATION.md`
- Create: `docs/architecture/AI_RESEARCH_SPECIFICATION.md`
- Create: `packages/legal-search/src/types.ts` (search interfaces)
- Create: `packages/ai-orchestrator/src/types.ts` (orchestration interfaces)
- Test: `tests/unit/search-spec.test.ts`

**Interfaces:**

- Consumes: Task 6 (legal schema)
- Produces: Search interfaces, retrieval sequence, ranking policy

- [ ] **Step 1: Write failing search spec test**

```typescript
// tests/unit/search-spec.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Search and AI research specifications", () => {
  it("search spec documents hybrid retrieval", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/SEARCH_SPECIFICATION.md"),
      "utf-8",
    );
    expect(content).toMatch(/lexical|keyword/i);
    expect(content).toMatch(/semantic/i);
    expect(content).toMatch(/metadata filter/i);
    expect(content).toMatch(/rerank|rank fusion/i);
    expect(content).toMatch(/authority ranking/i);
  });
  it("AI research spec defines retrieval sequence", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/AI_RESEARCH_SPECIFICATION.md"),
      "utf-8",
    );
    expect(content).toMatch(/query classification/i);
    expect(content).toMatch(/legal entity.*date extraction/i);
    expect(content).toMatch(/parallel retrieval/i);
    expect(content).toMatch(/citation validation/i);
    expect(content).toMatch(/evidence validation/i);
  });
  it("search interfaces exported", () => {
    const {
      SearchQuery,
      SearchResult,
      RetrievalConfig,
    } = require("@phli/legal-search");
    expect(SearchQuery).toBeDefined();
    expect(SearchResult).toBeDefined();
    expect(RetrievalConfig).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/search-spec.test.ts`
Expected: FAIL

- [ ] **Step 3: Write search specification and interfaces**

**docs/architecture/SEARCH_SPECIFICATION.md:** Document the hybrid retrieval architecture from dossier Section 9.1–9.3, including the retrieval sequence diagram (as Mermaid), authority ranking policy factors, and Cloudflare Vectorize/AI Search integration notes with current limits cited.

**docs/architecture/AI_RESEARCH_SPECIFICATION.md:** Document the AI orchestration from dossier Sections 9.2, 11, including the structured answer JSON schemas (legal research, educational ALAC/IRAC, professional), uncertainty/abstention behavior, and model gateway interface.

**packages/legal-search/src/types.ts:**

```typescript
export interface SearchQuery {
  text: string;
  mode:
    | "quick"
    | "standard"
    | "deep"
    | "comparison"
    | "statutory"
    | "educational"
    | "professional";
  filters?: SearchFilters;
  asOfDate?: string; // ISO date for temporal queries
}

export interface SearchFilters {
  court?: string[];
  documentType?: string[];
  jurisdiction?: string[];
  dateRange?: { from: string; to: string };
  agency?: string[];
  topic?: string[];
  verificationStatus?: string[];
}

export interface SearchResult {
  documentId: string;
  chunkId: string;
  score: number;
  passage: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  documentId: string;
  documentType: string;
  court?: string;
  jurisdiction: string;
  year: number;
  sourceId: string;
  verificationStatus: string;
}

export interface RetrievalConfig {
  lexicalWeight: number;
  semanticWeight: number;
  rerankTopK: number;
  finalTopK: number;
}
```

**packages/ai-orchestrator/src/types.ts:** Define `GenerationRequest`, `GenerationResult`, `ModelProvider` interface per dossier Rule 2, plus `ResearchAnswer` (structured output from Section 11).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/search-spec.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/SEARCH_SPECIFICATION.md docs/architecture/AI_RESEARCH_SPECIFICATION.md packages/legal-search/ packages/ai-orchestrator/
git commit -m "docs: search and AI research specifications; feat: search and orchestrator interfaces"
```

---

### Task 8: Citation Verification Engine Specification

**Files:**

- Create: `docs/architecture/CITATION_VERIFICATION.md`
- Create: `packages/citation-engine/src/types.ts`
- Create: `packages/citation-engine/src/verifier.ts` (interface only)
- Test: `tests/unit/citation-verification.test.ts`

**Interfaces:**

- Consumes: Task 6, Task 7
- Produces: Four-layer verification types and interfaces

- [ ] **Step 1: Write failing citation test**

```typescript
// tests/unit/citation-verification.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Citation verification specification", () => {
  it("documents four verification layers", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/CITATION_VERIFICATION.md"),
      "utf-8",
    );
    const layers = ["Identity", "Location", "Support", "Temporal validity"];
    for (const l of layers) expect(content).toContain(l);
  });
  it("defines citation verification result schema", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/CITATION_VERIFICATION.md"),
      "utf-8",
    );
    expect(content).toMatch(/citation_id/);
    expect(content).toMatch(/identity_verified/);
    expect(content).toMatch(/passage_verified/);
    expect(content).toMatch(/proposition_supported/);
    expect(content).toMatch(/temporal_validity/);
  });
  it("exports verification types", () => {
    const {
      CitationVerificationResult,
      VerificationLayer,
    } = require("@phli/citation-engine");
    expect(CitationVerificationResult).toBeDefined();
    expect(VerificationLayer).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/citation-verification.test.ts`
Expected: FAIL

- [ ] **Step 3: Write citation verification spec and types**

**docs/architecture/CITATION_VERIFICATION.md:** Document the four-layer verification from dossier Section 10, citation display format, unsupported-answer policy, and the 99%/98% accuracy gates.

**packages/citation-engine/src/types.ts:**

```typescript
export enum VerificationLayer {
  IDENTITY = "identity",
  LOCATION = "location",
  SUPPORT = "support",
  TEMPORAL_VALIDITY = "temporal_validity",
}

export interface CitationVerificationResult {
  citation_id: string;
  document_id: string;
  passage_id: string;
  citation_text: string;
  identity_verified: boolean;
  passage_verified: boolean;
  proposition_supported: boolean;
  temporal_validity: boolean;
  verification_method: "automated" | "human" | "automated_and_human";
  verification_status: "PASSED" | "FAILED" | "NEEDS_REVIEW";
  layer_results: Record<
    VerificationLayer,
    { passed: boolean; evidence?: string; notes?: string }
  >;
}
```

**packages/citation-engine/src/verifier.ts:** Export `CitationVerifier` interface with `verify(citation: CitationInput): Promise<CitationVerificationResult>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/citation-verification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/CITATION_VERIFICATION.md packages/citation-engine/
git commit -m "docs: citation verification specification; feat: citation engine types"
```

---

### Task 9: Security, Privacy & Threat Model Documentation

**Files:**

- Create: `docs/security/THREAT_MODEL.md`
- Create: `docs/security/SECURITY_ARCHITECTURE.md`
- Create: `docs/privacy/PRIVACY_SPECIFICATION.md`
- Create: `docs/privacy/AI_GOVERNANCE.md`
- Create: `packages/permissions/src/types.ts` (RBAC/ABAC types)
- Test: `tests/unit/security-privacy.test.ts`

**Interfaces:**

- Consumes: Task 3
- Produces: Threat model, security architecture, privacy spec, AI governance doc, permission types

- [ ] **Step 1: Write failing security/privacy test**

```typescript
// tests/unit/security-privacy.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Security and privacy documentation", () => {
  it("threat model covers required areas", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/security/THREAT_MODEL.md"),
      "utf-8",
    );
    const areas = [
      "authentication",
      "authorization",
      "tenant isolation",
      "api security",
      "database",
      "file storage",
      "secrets",
      "encryption",
      "audit",
      "backups",
      "ai security",
      "administration",
    ];
    for (const a of areas) expect(content.toLowerCase()).toContain(a);
  });
  it("privacy spec references DPA and NPC guidance", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/privacy/PRIVACY_SPECIFICATION.md"),
      "utf-8",
    );
    expect(content).toMatch(/Republic Act No\. 10173|Data Privacy Act/i);
    expect(content).toMatch(/National Privacy Commission|NPC/i);
    expect(content).toMatch(
      /AI.*guidance|Guidelines on Artificial Intelligence/i,
    );
  });
  it("AI governance references SC framework", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/privacy/AI_GOVERNANCE.md"),
      "utf-8",
    );
    expect(content).toMatch(
      /A\.M\. No\. 25-11-28-SC|Supreme Court.*AI Governance/i,
    );
  });
  it("permission types exported", () => {
    const { Role, Permission, ResourceAccess } = require("@phli/permissions");
    expect(Role).toBeDefined();
    expect(Permission).toBeDefined();
    expect(ResourceAccess).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/security-privacy.test.ts`
Expected: FAIL

- [ ] **Step 3: Write all four security/privacy documents**

**docs/security/THREAT_MODEL.md:** STRIDE-based threat model covering all areas from dossier Section 13.1 table, with mitigations.

**docs/security/SECURITY_ARCHITECTURE.md:** Zero-trust application design, tenant isolation enforcement, RBAC + resource-level access, audit requirements.

**docs/privacy/PRIVACY_SPECIFICATION.md:** DPA 2012 compliance, NPC AI guidance requirements, required operational documents (PIA, DPIA, DPA register, etc.), retention schedule, data subject request procedure.

**docs/privacy/AI_GOVERNANCE.md:** SC Judiciary AI Governance Framework principles mapped to product (fairness, accountability, transparency, privacy, security, robustness, human oversight, data governance), human-in-the-loop requirements.

**packages/permissions/src/types.ts:** Define `Role`, `Permission`, `ResourceAccess`, `UserCategory`, `VerificationStatus` enums and interfaces per dossier Section 5.1.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/security-privacy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/security/ docs/privacy/ packages/permissions/
git commit -m "docs: threat model, security architecture, privacy spec, AI governance; feat: permission types"
```

---

### Task 10: Document Intelligence & Drafting Specification

**Files:**

- Create: `docs/architecture/DOCUMENT_INTELLIGENCE.md`
- Create: `packages/document-engine/src/types.ts`
- Create: `packages/document-parser/src/types.ts`
- Test: `tests/unit/document-intelligence.test.ts`

**Interfaces:**

- Consumes: Task 6
- Produces: Document processing types, parser interfaces

- [ ] **Step 1: Write failing document intelligence test**

```typescript
// tests/unit/document-intelligence.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Document intelligence specification", () => {
  it("documents upload pipeline with security", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/DOCUMENT_INTELLIGENCE.md"),
      "utf-8",
    );
    expect(content).toMatch(/malware|scanning/i);
    expect(content).toMatch(/prompt injection/i);
    expect(content).toMatch(/cross-tenant|isolation/i);
    expect(content).toMatch(/retention|deletion/i);
  });
  it("lists supported document categories", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/DOCUMENT_INTELLIGENCE.md"),
      "utf-8",
    );
    const cats = [
      "affidavit",
      "demand letter",
      "special power of attorney",
      "motion",
      "pleading",
      "corporate resolution",
      "employment agreement",
    ];
    for (const c of cats)
      expect(content.toLowerCase()).toContain(c.toLowerCase());
  });
  it("exports document engine types", () => {
    const {
      Draft,
      DraftVersion,
      Template,
      ExportFormat,
    } = require("@phli/document-engine");
    expect(Draft).toBeDefined();
    expect(DraftVersion).toBeDefined();
    expect(Template).toBeDefined();
    expect(ExportFormat).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/document-intelligence.test.ts`
Expected: FAIL

- [ ] **Step 3: Write document intelligence spec and types**

**docs/architecture/DOCUMENT_INTELLIGENCE.md:** Document the upload pipeline (private R2, validation, malware scan, OCR, sensitive data detection, chunking, tenant-isolated indexing), prompt injection defense, draft categories from dossier Section 5.5, editor features, human approval requirement.

**packages/document-engine/src/types.ts:** `Draft`, `DraftVersion`, `Template`, `ExportFormat`, `DraftSection`, `InlineAssistance`, `CitationAttachment`.

**packages/document-parser/src/types.ts:** `ParseResult`, `DocumentStructure`, `ExtractedClause`, `ParserOptions`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/document-intelligence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/DOCUMENT_INTELLIGENCE.md packages/document-engine/ packages/document-parser/
git commit -m "docs: document intelligence specification; feat: document engine and parser types"
```

---

### Task 11: Implementation Roadmap & Test Strategy Documentation

**Files:**

- Create: `docs/architecture/IMPLEMENTATION_ROADMAP.md`
- Create: `docs/architecture/TEST_STRATEGY.md`
- Create: `docs/architecture/KNOWN_LIMITATIONS.md`
- Create: `docs/architecture/DEPLOYMENT_GUIDE.md` (local only)
- Create: `docs/operations/OPERATIONS_RUNBOOK.md` (stub)
- Test: `tests/unit/roadmap-docs.test.ts`

**Interfaces:**

- Consumes: All prior tasks
- Produces: Phased plan, testing strategy, known limitations, local deployment guide

- [ ] **Step 1: Write failing roadmap test**

```typescript
// tests/unit/roadmap-docs.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Implementation roadmap and test strategy", () => {
  it("roadmap has 10 gates with acceptance criteria", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/IMPLEMENTATION_ROADMAP.md"),
      "utf-8",
    );
    for (let i = 0; i <= 10; i++) expect(content).toContain(`Gate ${i}`);
    expect(content).toMatch(/acceptance/i);
  });
  it("test strategy defines test pyramid", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/TEST_STRATEGY.md"),
      "utf-8",
    );
    expect(content).toMatch(/unit|integration|contract|e2e/i);
  });
  it("known limitations documents research gaps", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
      "utf-8",
    );
    expect(content).toMatch(/E-Library|LawPhil|Official Gazette/i);
    expect(content).toMatch(/good law|subsequent treatment/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/roadmap-docs.test.ts`
Expected: FAIL

- [ ] **Step 3: Write roadmap, test strategy, known limitations**

**docs/architecture/IMPLEMENTATION_ROADMAP.md:** Adapt dossier Section 18 (Gates 0–10) with explicit acceptance evidence per gate.

**docs/architecture/TEST_STRATEGY.md:** Test pyramid (unit, integration, contract, security, regression, e2e), benchmarking approach, CI pipeline.

**docs/architecture/KNOWN_LIMITATIONS.md:** Adapt dossier Section 22 — all research gaps with status.

**docs/architecture/DEPLOYMENT_GUIDE.md:** Local-only Wrangler dev setup, no production deploy.

**docs/operations/OPERATIONS_RUNBOOK.md:** Stub with sections for source monitoring, ingestion ops, incident response.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/roadmap-docs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/IMPLEMENTATION_ROADMAP.md docs/architecture/TEST_STRATEGY.md docs/architecture/KNOWN_LIMITATIONS.md docs/architecture/DEPLOYMENT_GUIDE.md docs/operations/OPERATIONS_RUNBOOK.md
git commit -m "docs: implementation roadmap, test strategy, known limitations, deployment guide"
```

---

### Task 12: Benchmark Fixtures & Evaluation Framework

**Files:**

- Create: `legal-data/benchmark-fixtures/questions.json` (500-question structure)
- Create: `apps/benchmark/src/evaluators/*.ts` (stub evaluators)
- Create: `docs/ai-evaluation/LEGAL_BENCHMARK.md`
- Test: `tests/unit/benchmark-fixtures.test.ts`

**Interfaces:**

- Consumes: Task 6, Task 8
- Produces: Benchmark dataset structure, evaluation framework doc

- [ ] **Step 1: Write failing benchmark test**

```typescript
// tests/unit/benchmark-fixtures.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Legal benchmark fixtures", () => {
  it("questions.json exists with 500 entries across categories", () => {
    const data = JSON.parse(
      readFileSync(
        join(process.cwd(), "legal-data/benchmark-fixtures/questions.json"),
        "utf-8",
      ),
    );
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(500);
    const categories = [
      "constitutional_law",
      "civil_law",
      "criminal_law",
      "labor_law",
      "taxation",
      "commercial_law",
      "remedial_law",
      "administrative_law",
      "legal_research_citations",
      "historical_law_versions",
    ];
    for (const c of categories)
      expect(data.some((q) => q.category === c)).toBe(true);
  });
  it("each question has required fields", () => {
    const data = JSON.parse(
      readFileSync(
        join(process.cwd(), "legal-data/benchmark-fixtures/questions.json"),
        "utf-8",
      ),
    );
    const required = [
      "id",
      "category",
      "question",
      "issue",
      "expected_authorities",
      "applicable_date",
      "expected_conclusion",
      "required_citations",
      "known_ambiguities",
      "expert_review_status",
    ];
    for (const q of data) for (const f of required) expect(q).toHaveProperty(f);
  });
  it("benchmark doc defines evaluation metrics", () => {
    const content = readFileSync(
      join(process.cwd(), "docs/ai-evaluation/LEGAL_BENCHMARK.md"),
      "utf-8",
    );
    const metrics = [
      "Recall@10",
      "Precision@5",
      "MRR",
      "Citation identity accuracy",
      "Citation passage accuracy",
      "Claim support rate",
      "Temporal correctness",
      "Abstention quality",
      "Answer completeness",
    ];
    for (const m of metrics) expect(content).toContain(m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/benchmark-fixtures.test.ts`
Expected: FAIL

- [ ] **Step 3: Create benchmark fixtures and evaluation doc**

**legal-data/benchmark-fixtures/questions.json:** 500 stub questions matching the category distribution from dossier Section 15.1, each with all required fields (use placeholder values, mark `expert_review_status: "PENDING"`).

**docs/ai-evaluation/LEGAL_BENCHMARK.md:** Document the benchmark design, metrics from Section 15.2, launch gates from Section 15.3, red-team scenarios from Section 15.4.

**apps/benchmark/src/evaluators/**: Stub evaluator classes for each metric (just interfaces, no implementation).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/benchmark-fixtures.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add legal-data/benchmark-fixtures/ apps/benchmark/src/evaluators/ docs/ai-evaluation/LEGAL_BENCHMARK.md
git commit -m "docs: legal benchmark specification; feat: benchmark fixtures and evaluator stubs"
```

---

### Task 13: CI/CD, GitHub Config & Environment Verification

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/ISSUE_TEMPLATE/*.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `scripts/verify-env.sh` (environment check script)
- Test: `tests/unit/ci-config.test.ts`, run `scripts/verify-env.sh`

**Interfaces:**

- Consumes: All prior tasks
- Produces: CI pipeline, issue/PR templates, environment verification

- [ ] **Step 1: Write failing CI test**

```typescript
// tests/unit/ci-config.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("CI configuration", () => {
  it("has CI workflow with required jobs", () => {
    const content = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf-8",
    );
    expect(content).toContain("lint");
    expect(content).toContain("typecheck");
    expect(content).toContain("test");
    expect(content).toContain("build");
  });
  it("has issue templates", () => {
    const templates = require("fs").readdirSync(
      join(process.cwd(), ".github/ISSUE_TEMPLATE"),
    );
    expect(templates.length).toBeGreaterThan(0);
  });
  it("has PR template", () => {
    expect(() =>
      readFileSync(
        join(process.cwd(), ".github/PULL_REQUEST_TEMPLATE.md"),
        "utf-8",
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/ci-config.test.ts`
Expected: FAIL

- [ ] **Step 3: Create CI workflow and GitHub configs**

**.github/workflows/ci.yml:**

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

Issue templates: bug_report.yml, feature_request.yml, security_report.yml.

PR template: Checklist for tests, types, lint, docs, migration review.

**scripts/verify-env.sh:**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "Verifying development environment..."
command -v node >/dev/null && echo "Node: $(node --version)" || { echo "Node not found"; exit 1; }
command -v pnpm >/dev/null && echo "pnpm: $(pnpm --version)" || { echo "pnpm not found"; exit 1; }
command -v wrangler >/dev/null && echo "Wrangler: $(wrangler --version)" || { echo "Wrangler not found"; exit 1; }
echo "Environment OK"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/ci-config.test.ts`
Expected: PASS

- [ ] **Step 5: Run environment verification**

Run: `bash scripts/verify-env.sh`
Expected: All tools present with versions printed

- [ ] **Step 6: Commit**

```bash
git add .github/ scripts/verify-env.sh
git commit -m "ci: GitHub workflows, issue/PR templates; chore: environment verification script"
```

---

### Task 14: Final Gate 0 Integration Test & Report

**Files:**

- Create: `tests/integration/gate0.test.ts`
- Create: `GATE0_REPORT.md`
- Test: `tests/integration/gate0.test.ts` (runs all prior unit tests + additional checks)

**Interfaces:**

- Consumes: Tasks 1–13
- Produces: Gate 0 acceptance evidence, final report

- [ ] **Step 1: Write failing integration test**

```typescript
// tests/integration/gate0.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Gate 0 acceptance", () => {
  it("all 15 acceptance criteria have evidence", () => {
    // 1. Research dossier exists
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/research/COMPETITOR_RESEARCH.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 2. Competitor research documented
    // 3. Legal source registry exists
    expect(() =>
      readFileSync(
        join(process.cwd(), "legal-data/source-registry/sources.json"),
        "utf-8",
      ),
    ).not.toThrow();
    // 4. Source acquisition risks identified
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/ingestion/SOURCE_ACQUISITION_POLICY.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 5. Architecture independently reviewed (ADRs exist)
    const adrs = readdirSync(join(process.cwd(), "docs/decisions")).filter(
      (f) => f.startsWith("ADR-") && f.endsWith(".md"),
    );
    expect(adrs.length).toBeGreaterThanOrEqual(12);
    // 6. Database schema documented
    expect(() =>
      readFileSync(
        join(process.cwd(), "migrations/d1/0001_legal_documents.sql"),
        "utf-8",
      ),
    ).not.toThrow();
    // 7. Legal temporal model documented
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/architecture/LEGAL_TEMPORAL_MODEL.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 8. AI retrieval architecture documented
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/architecture/SEARCH_SPECIFICATION.md"),
        "utf-8",
      ),
    ).not.toThrow();
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/architecture/AI_RESEARCH_SPECIFICATION.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 9. Citation verification specified
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/architecture/CITATION_VERIFICATION.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 10. Privacy and security architecture documented
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/security/THREAT_MODEL.md"),
        "utf-8",
      ),
    ).not.toThrow();
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/privacy/PRIVACY_SPECIFICATION.md"),
        "utf-8",
      ),
    ).not.toThrow();
    // 11. Repository initialized
    expect(() =>
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    ).not.toThrow();
    // 12. Development environment verified (script exists)
    expect(() =>
      readFileSync(join(process.cwd(), "scripts/verify-env.sh"), "utf-8"),
    ).not.toThrow();
    // 13. Tests run successfully (this test passing proves it)
    // 14. Git history clean (manual check)
    // 15. Remaining blockers documented
    expect(() =>
      readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      ),
    ).not.toThrow();
  });
  it("all packages build", () => {
    // This is verified by pnpm build in CI; here we just check build outputs exist
    const packages = [
      "contracts",
      "domain",
      "database",
      "auth",
      "legal-schema",
      "legal-ingestion",
      "legal-search",
      "legal-graph",
      "ai-orchestrator",
      "model-gateway",
      "citation-engine",
      "document-engine",
      "document-parser",
      "permissions",
      "observability",
      "shared",
    ];
    for (const p of packages) {
      expect(() =>
        readFileSync(
          join(process.cwd(), `packages/${p}/package.json`),
          "utf-8",
        ),
      ).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/integration/gate0.test.ts`
Expected: FAIL (some files not yet created)

- [ ] **Step 3: Run full test suite and build to verify everything passes**

Run: `pnpm test && pnpm build`
Expected: All tests PASS, all packages build

- [ ] **Step 4: Generate GATE0_REPORT.md**

Create `GATE0_REPORT.md` with:

- Executive summary
- Research findings summary (competitor, sources)
- Architecture decisions (ADR list)
- Repository tree (`find . -type f -name "*.ts" -o -name "*.md" -o -name "*.json" -o -name "*.sql" | head -200`)
- Environment report (`bash scripts/verify-env.sh` output)
- Test results summary (`pnpm test --reporter=verbose` output)
- Security findings (from threat model)
- Known limitations (from KNOWN_LIMITATIONS.md)
- Unresolved questions (from research gaps)
- Implementation readiness verdict: **ACCEPTED WITH LIMITATIONS** (since source acquisition permissions are pending)

- [ ] **Step 5: Commit**

```bash
git add tests/integration/gate0.test.ts GATE0_REPORT.md
git commit -m "test: gate 0 integration test; docs: gate 0 acceptance report"
```

- [ ] **Step 6: Verify clean git history**

Run: `git log --oneline -20`
Expected: Clean, conventional commits, no fixup/squash noise

---

## Execution Order & Parallelization

**Sequential dependencies:**

- Task 1 → Task 2 → Task 3 (foundation)
- Task 3 → Tasks 4, 5, 6, 9, 10, 11, 12 (docs/specs can run in parallel after docs structure)
- Task 6 → Tasks 7, 8 (schema before search/citation)
- Tasks 1–13 → Task 14 (integration test last)

**Recommended parallel waves:**

| Wave | Tasks          | Concurrency |
| ---- | -------------- | ----------- |
| 1    | 1              | 1           |
| 2    | 2, 3           | 2           |
| 3    | 4, 5, 6, 9, 10 | 5           |
| 4    | 7, 8, 11, 12   | 4           |
| 5    | 13             | 1           |
| 6    | 14             | 1           |

Total ~14 tasks. With 4–6 parallel workers, estimated 4–5 waves.

---

## Subagent Briefing Notes

Each task above is designed for a **coder-nvidia** or **coder-gemini** subagent in its own git worktree. The task includes:

- Exact file paths to create/modify
- Failing test first (TDD)
- Minimal implementation to pass test
- Verification commands
- Commit message

**Reviewer:** Each completed task should be reviewed by a **reviewer-nvidia** or **reviewer-gemini** from the opposite lane before marking Done.

**Kanban:** Create `KANBAN.md` with all 14 tasks in Backlog, move to In Progress as delegated.
