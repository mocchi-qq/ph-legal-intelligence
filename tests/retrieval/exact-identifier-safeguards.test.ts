import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
import { buildFixtureCorpus } from "../benchmark/helpers";

const store = buildFixtureCorpus();
const index = buildSearchIndex(store.state);

function topIdentity(query: string, asOfDate?: string) {
  const results = retrieve(index, {
    text: query,
    mode: "standard",
    asOfDate,
    limit: 5,
  });
  return results.map((result) => {
    const doc = store.state.documents.find((d) => d.id === result.documentId);
    return {
      key: doc?.identityKey,
      passage: result.passage,
      label: result.metadata.provisionLabel,
    };
  });
}

describe("exact identifier safeguards", () => {
  it("resolves the Executive Order alias and its abbreviation to one key", () => {
    expect(topIdentity("Executive Order No. 101")[0]?.key).toBe(
      "EXECUTIVE_ORDER:101",
    );
    expect(topIdentity("EO 101")[0]?.key).toBe("EXECUTIVE_ORDER:101");
  });

  it("resolves both G.R. forms to the same decision", () => {
    expect(topIdentity("G.R. 999001")[0]?.key).toBe(
      "COURT_DECISION:G.R. No. 999001",
    );
    expect(topIdentity("G.R. No. 999001")[0]?.key).toBe(
      "COURT_DECISION:G.R. No. 999001",
    );
  });

  it("returns nothing for nonexistent identifiers that resemble real ones", () => {
    expect(topIdentity("RA 1004")).toHaveLength(0);
    expect(topIdentity("Republic Act No. 1010")).toHaveLength(0);
    expect(topIdentity("G.R. No. 999004")).toHaveLength(0);
    expect(topIdentity("Act No. 1001")).toHaveLength(0);
    expect(topIdentity("Commonwealth Act No. 1001")).toHaveLength(0);
  });

  it("still resolves a real RA alias to its canonical key", () => {
    expect(topIdentity("RA 1001")[0]?.key).toBe("REPUBLIC_ACT:1001");
  });

  it("does not force an embedded identifier question to exact-only", () => {
    const results = topIdentity("which law amended Republic Act No. 1001");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.key !== "REPUBLIC_ACT:1001")).toBe(
      true,
    );
  });
});
