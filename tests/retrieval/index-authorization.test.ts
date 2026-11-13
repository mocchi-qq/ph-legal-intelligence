import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "../../packages/legal-search/src/index";
import { allowSyntheticIndex, buildFixtureCorpus } from "../benchmark/helpers";

describe("Gate 6 — reindex authorization boundary", () => {
  it("requires an authorization callback", () => {
    const store = buildFixtureCorpus();
    expect(() =>
      buildSearchIndex(store.state, {} as { authorize: never }),
    ).toThrow(/index_authorization_required/);
  });

  it("indexes when the callback allows", () => {
    const store = buildFixtureCorpus();
    const index = buildSearchIndex(store.state, {
      authorize: allowSyntheticIndex,
    });
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it("excludes every document when the callback denies", () => {
    const store = buildFixtureCorpus();
    const index = buildSearchIndex(store.state, {
      authorize: () => ({ allowed: false, reason: "NO_REINDEX_DECISION" }),
    });
    expect(index.entries).toHaveLength(0);
    expect(index.total).toBe(0);
  });

  it("authorizes each document independently", () => {
    const store = buildFixtureCorpus();
    let calls = 0;
    const index = buildSearchIndex(store.state, {
      authorize: (request) => {
        calls += 1;
        return {
          allowed: request.sourceId === store.state.documents[0]?.sourceId,
          reason: "test",
        };
      },
    });
    expect(calls).toBeGreaterThan(0);
    expect(
      index.entries.every(
        (entry) => entry.sourceId === store.state.documents[0]?.sourceId,
      ),
    ).toBe(true);
  });
});
