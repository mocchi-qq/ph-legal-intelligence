import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  it("competitor matrix has all required competitors", () => {
    const matrix = JSON.parse(
      readFileSync(
        join(process.cwd(), "docs/research/COMPETITOR_MATRIX.json"),
        "utf-8",
      ),
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
    for (const c of required) expect(matrix.comparison).toHaveProperty(c);
  });
  it("competitor matrix has required dimensions", () => {
    const matrix = JSON.parse(
      readFileSync(
        join(process.cwd(), "docs/research/COMPETITOR_MATRIX.json"),
        "utf-8",
      ),
    );
    for (const c of Object.values(matrix.comparison)) {
      expect(c).toHaveProperty("coverage");
      expect(c).toHaveProperty("ai_features");
      expect(c).toHaveProperty("pricing");
      expect(c).toHaveProperty("api_availability");
      expect(c).toHaveProperty("philippines_focus");
    }
  });
});
