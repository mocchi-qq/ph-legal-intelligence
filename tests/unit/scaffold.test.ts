import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
