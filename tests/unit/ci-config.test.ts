import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

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
    const templates = readdirSync(
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
  it("has environment verification script", () => {
    expect(existsSync(join(process.cwd(), "scripts/verify-env.sh"))).toBe(true);
  });
  it("CI workflow does not deploy or push", () => {
    const content = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf-8",
    );
    expect(content).not.toMatch(/wrangler deploy/);
    expect(content).not.toMatch(/deploy/);
  });
});
