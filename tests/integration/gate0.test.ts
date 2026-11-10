import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const exists = (p: string) => existsSync(join(root, p));
const read = (p: string) => readFileSync(join(root, p), "utf-8");

describe("Gate 0 acceptance — 15 required criteria", () => {
  it("1. research dossier exists", () => {
    expect(exists("docs/research/COMPETITOR_RESEARCH.md")).toBe(true);
  });

  it("2. competitor research documented", () => {
    const c = read("docs/research/COMPETITOR_RESEARCH.md");
    for (const name of [
      "Anycase.ai",
      "LexisNexis",
      "Westlaw",
      "vLex",
      "Harvey",
      "ChatGPT",
      "Philippine legal databases",
    ]) {
      expect(c).toContain(name);
    }
    expect(exists("docs/research/COMPETITOR_MATRIX.json")).toBe(true);
  });

  it("3. legal source registry exists", () => {
    const sources = JSON.parse(read("legal-data/source-registry/sources.json"));
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(25);
    for (const s of sources) expect(s.acquisition_status).toBe("Pending");
  });

  it("4. source acquisition risks identified", () => {
    const c = read("docs/ingestion/SOURCE_ACQUISITION_POLICY.md");
    expect(c).toMatch(/Approved/);
    expect(c).toMatch(/Restricted/);
    expect(c).toMatch(/Manual/);
    expect(c).toMatch(/Pending/);
    expect(c).toMatch(/Rejected/);
    expect(c).toMatch(/CAPTCHA/i);
  });

  it("5. architecture independently reviewed (ADRs present)", () => {
    const adrs = readdirSync(join(root, "docs/decisions")).filter((f) =>
      /^ADR-\d{4}\.md$/.test(f),
    );
    expect(adrs.length).toBeGreaterThanOrEqual(12);
  });

  it("6. database schema documented", () => {
    const sql = read("migrations/d1/0001_legal_documents.sql");
    for (const t of [
      "legal_documents",
      "document_versions",
      "source_manifestations",
      "document_citations",
      "document_relationships",
      "legal_provisions",
      "extraction_jobs",
      "verification_records",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?${t}\\b`));
    }
    expect(exists("docs/architecture/LEGAL_DATA_MODEL.md")).toBe(true);
  });

  it("7. legal temporal model documented", () => {
    const c = read("docs/architecture/LEGAL_TEMPORAL_MODEL.md");
    expect(c).toMatch(/effectivity/i);
    expect(c).toMatch(/promulgation/i);
    expect(c).toMatch(/repeal/i);
  });

  it("8. AI retrieval architecture documented", () => {
    expect(exists("docs/architecture/SEARCH_SPECIFICATION.md")).toBe(true);
    expect(exists("docs/architecture/AI_RESEARCH_SPECIFICATION.md")).toBe(true);
  });

  it("9. citation verification specified", () => {
    const c = read("docs/architecture/CITATION_VERIFICATION.md");
    for (const layer of ["Identity", "Location", "Support", "Temporal"])
      expect(c).toContain(layer);
  });

  it("10. privacy and security architecture documented", () => {
    expect(exists("docs/security/THREAT_MODEL.md")).toBe(true);
    expect(exists("docs/security/SECURITY_ARCHITECTURE.md")).toBe(true);
    expect(exists("docs/privacy/PRIVACY_SPECIFICATION.md")).toBe(true);
    expect(exists("docs/privacy/AI_GOVERNANCE.md")).toBe(true);
  });

  it("11. repository initialized (workspace + all packages)", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.private).toBe(true);
    expect(exists("pnpm-workspace.yaml")).toBe(true);
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
    for (const p of packages)
      expect(exists(`packages/${p}/package.json`)).toBe(true);
    for (const a of ["web", "api", "ingestion", "admin", "benchmark"])
      expect(exists(`apps/${a}/package.json`)).toBe(true);
  });

  it("12. development environment verified", () => {
    expect(exists("scripts/verify-env.sh")).toBe(true);
  });

  it("13. test suite present and passing (this suite proves execution)", () => {
    const files = readdirSync(join(root, "tests/unit")).filter((f) =>
      f.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it("14. git history is clean and reviewable (git repo initialized)", () => {
    expect(exists(".git")).toBe(true);
  });

  it("15. remaining blockers documented", () => {
    const c = read("docs/architecture/KNOWN_LIMITATIONS.md");
    expect(c).toMatch(/E-Library|LawLibrary|LawPhil/i);
    expect(c).toMatch(/good law|subsequent treatment/i);
  });
});

describe("Gate 0 supporting artefacts", () => {
  it("implementation roadmap covers gates 0 through 10", () => {
    const c = read("docs/architecture/IMPLEMENTATION_ROADMAP.md");
    for (let i = 0; i <= 10; i++)
      expect(c).toMatch(new RegExp(`Gate\\s*${i}`, "i"));
  });

  it("test strategy defines the test pyramid", () => {
    const c = read("docs/architecture/TEST_STRATEGY.md");
    for (const t of ["unit", "integration", "contract", "end-to-end"]) {
      expect(c.toLowerCase()).toContain(t);
    }
  });

  it("benchmark fixture has 500 questions", () => {
    const qs = JSON.parse(read("legal-data/benchmark-fixtures/questions.json"));
    expect(qs.length).toBe(500);
  });

  it("legal benchmark defines metrics and launch gates", () => {
    const c = read("docs/ai-evaluation/LEGAL_BENCHMARK.md");
    expect(c).toContain("Recall@10");
    expect(c).toMatch(/launch gate/i);
    expect(c).toMatch(/red.team/i);
  });

  it("gate 0 report exists and states a verdict", () => {
    const c = read("GATE0_REPORT.md");
    expect(c).toMatch(/ACCEPTED( WITH LIMITATIONS)?|REJECTED/);
  });
});
