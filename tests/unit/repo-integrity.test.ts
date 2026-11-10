import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
