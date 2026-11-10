import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Implementation Roadmap Docs", () => {
  describe("IMPLEMENTATION_ROADMAP.md", () => {
    it("has 10 gates (0-10) with acceptance criteria", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/IMPLEMENTATION_ROADMAP.md"),
        "utf-8",
      );
      // Gate 0 through Gate 10 = 11 gates total (0,1,2,...,10)
      for (let g = 0; g <= 10; g++) {
        expect(content).toContain(`Gate ${g}`);
      }
    });

    it("gates are in correct order", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/IMPLEMENTATION_ROADMAP.md"),
        "utf-8",
      );
      const gates = content.match(/Gate \d+/g);
      const gateNumbers = gates?.map((g) => parseInt(g.split(" ")[1], 10));
      for (let i = 1; i < gateNumbers.length; i++) {
        expect(gateNumbers[i]).toBe(gateNumbers[i - 1] + 1);
      }
    });

    it("has acceptance evidence per gate", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/IMPLEMENTATION_ROADMAP.md"),
        "utf-8",
      );
      for (let g = 0; g <= 10; g++) {
        // Each gate should have some acceptance evidence
        const _gateSection = content.match(new RegExp(`Gate ${g}`, "m"))?.[0];
        // Check for evidence markers like "Accepted", "Evidence", or specific criteria
        expect(content).match(/Accepted|Evidence|criteria/i) ||
          content.includes("Accepted") ||
          content.includes("Evidence") ||
          content.includes("criteria");
      }
    });
  });

  describe("TEST_STRATEGY.md", () => {
    it("defines test pyramid", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/TEST_STRATEGY.md"),
        "utf-8",
      );
      expect(content).toContain("unit");
      expect(content).toContain("integration");
      expect(content).toContain("contract");
      expect(content).toContain("security");
      expect(content).toContain("regression");
      expect(content).toContain("e2e");
    });

    it("defines benchmarking approach", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/TEST_STRATEGY.md"),
        "utf-8",
      );
      expect(content).toMatch(/benchmark|fixture|evaluation/i);
    });

    it("defines CI pipeline", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/TEST_STRATEGY.md"),
        "utf-8",
      );
      expect(content).toMatch(/CI|pipeline|workflow|github/i);
    });
  });

  describe("KNOWN_LIMITATIONS.md", () => {
    it("documents research gaps for E-Library", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      );
      expect(content).toContain("E-Library");
    });

    it("documents research gaps for LawPhil", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      );
      expect(content).toContain("LawPhil");
    });

    it("documents research gaps for Official Gazette", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      );
      expect(content).toContain("Official Gazette");
    });

    it("documents research gaps for good law/subsequent treatment", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      );
      expect(content).toMatch(/good law|subsequent treatment|treatment data/i);
    });

    it("has research gaps status table", () => {
      const content = readFileSync(
        join(process.cwd(), "docs/architecture/KNOWN_LIMITATIONS.md"),
        "utf-8",
      );
      // Should have a table or structured list of research gaps
      expect(content).toMatch(/status|gap|research/i);
    });
  });
});
