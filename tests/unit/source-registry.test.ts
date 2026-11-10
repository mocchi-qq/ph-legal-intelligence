import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  it("all sources start with acquisition_status Pending", () => {
    const sources = JSON.parse(
      readFileSync(
        join(process.cwd(), "legal-data/source-registry/sources.json"),
        "utf-8",
      ),
    );
    for (const s of sources) expect(s.acquisition_status).toBe("Pending");
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
