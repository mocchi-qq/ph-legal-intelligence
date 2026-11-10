import { describe, expect, it } from "vitest";
import { segmentProvisions } from "../../packages/legal-ingestion/src/index";

describe("Gate 2 — statutory segmentation variants", () => {
  it("segments SEC. headings used by the E-Library source", () => {
    const seeds = segmentProvisions(
      "SEC. 1. First duty applies.\nSEC. 2. Second duty applies.",
      "REPUBLIC_ACT",
    );
    expect(seeds.map((seed) => seed.label)).toEqual(["SEC. 1", "SEC. 2"]);
    expect(seeds[1]?.text).toBe("Second duty applies.");
  });

  it("still segments SECTION and Article headings", () => {
    const seeds = segmentProvisions(
      "ARTICLE I\nSection 1. First duty.\nSECTION 2. Second duty.",
      "REPUBLIC_ACT",
    );
    expect(seeds.map((seed) => seed.label)).toEqual([
      "ARTICLE I",
      "Section 1",
      "SECTION 2",
    ]);
  });
});
