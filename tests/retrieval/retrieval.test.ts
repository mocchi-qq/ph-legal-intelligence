import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
import {
  allowSyntheticIndex,
  buildFixtureCorpus,
  currentVersion,
  docByKey,
  provision,
} from "../benchmark/helpers";

const store = buildFixtureCorpus();
const index = buildSearchIndex(store.state, {
  authorization: allowSyntheticIndex,
});

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

describe("Gate 1 — retrieval", () => {
  it("retrieves by exact G.R. number", () => {
    const results = topIdentity("G.R. No. 999001");
    expect(results[0]?.key).toBe("COURT_DECISION:G.R. No. 999001");
  });

  it("retrieves by the RA alias form", () => {
    const results = topIdentity("RA 1001");
    expect(results[0]?.key).toBe("REPUBLIC_ACT:1001");
  });

  it("retrieves by exact statute citation", () => {
    const results = topIdentity("Synthetic Republic Act No. 1001");
    expect(results[0]?.key).toBe("REPUBLIC_ACT:1001");
  });

  it("retrieves by exact executive order title", () => {
    const results = topIdentity("Synthetic Executive Order No. 101");
    expect(results[0]?.key).toBe("EXECUTIVE_ORDER:101");
  });

  it("retrieves by exact agency regulation title", () => {
    const results = topIdentity(
      "Synthetic Implementing Rules and Regulations of EO 101",
    );
    expect(results[0]?.key).toBe("AGENCY_REGULATION:IRR-101");
  });

  it("retrieves a relevant passage for a natural-language question", () => {
    const results = retrieve(index, {
      text: "annual renewal of registration",
      mode: "standard",
      limit: 5,
    });
    const passages = results.map((r) => r.passage.toLowerCase());
    expect(
      passages.some((p) => p.includes("renew its registration every year")),
    ).toBe(true);
  });

  it("filters by document type", () => {
    const results = retrieve(index, {
      text: "registration",
      mode: "standard",
      filters: { documentType: ["COURT_DECISION"] },
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results)
      expect(result.metadata.documentType).toBe("COURT_DECISION");
  });

  it("selects the version in force at the as-of date (old text)", () => {
    const results = topIdentity(
      "renew its registration every year",
      "2019-06-01",
    );
    expect(
      results.some((r) =>
        r.passage.includes("renew its registration every year"),
      ),
    ).toBe(false);
  });

  it("selects the version in force at the as-of date (new text)", () => {
    const results = topIdentity(
      "renew its registration every year",
      "2021-01-01",
    );
    expect(
      results.some((r) =>
        r.passage.includes("renew its registration every year"),
      ),
    ).toBe(true);
  });

  it("returns nothing for a nonexistent G.R. number", () => {
    const results = topIdentity("G.R. No. 000000");
    expect(results).toHaveLength(0);
  });

  it("returns nothing for a plausible nonexistent statute", () => {
    const results = topIdentity("Synthetic Republic Act No. 9999");
    expect(results).toHaveLength(0);
  });

  it("does not rely on semantic retrieval (unimplemented)", () => {
    // A paraphrase with no shared content terms must not be retrieved.
    const results = topIdentity(
      "photosynthesis chlorophyll taxonomy",
      "2021-01-01",
    );
    expect(results).toHaveLength(0);
  });

  it("separates document relevance from passage relevance", () => {
    const doc = docByKey(store, "REPUBLIC_ACT:1001");
    const version = currentVersion(store, doc.id);
    const s1 = provision(store, doc.id, "Section 1", version.id);
    const results = retrieve(index, {
      text: "administrative penalty for a violation",
      mode: "standard",
      limit: 10,
    });
    // Document is retrieved; the top passage should be the penalty provision, not Section 1.
    expect(results.length).toBeGreaterThan(0);
    const top = results[0]!;
    const topProvisionId = store.state.chunks.find(
      (c) => c.id === top.chunkId,
    )?.provisionId;
    expect(topProvisionId).not.toBe(s1.id);
  });
});
