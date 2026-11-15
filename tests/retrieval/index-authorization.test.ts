import { describe, expect, it } from "vitest";
import type { DocumentActivityAuthorization } from "../../packages/legal-ingestion/src/index";
import { buildSearchIndex } from "../../packages/legal-search/src/index";
import { allowSyntheticIndex, buildFixtureCorpus } from "../benchmark/helpers";

describe("Gate 6 — reindex authorization boundary", () => {
  it("requires an authorization callback", () => {
    const store = buildFixtureCorpus();
    expect(() =>
      buildSearchIndex(store.state, {} as { authorization: never }),
    ).toThrow(/index_authorization_required/);
  });

  it("indexes when the callback allows", () => {
    const store = buildFixtureCorpus();
    const index = buildSearchIndex(store.state, {
      authorization: allowSyntheticIndex,
    });
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it("excludes every document when the callback denies", () => {
    const store = buildFixtureCorpus();
    const denyAll: DocumentActivityAuthorization = (request) => ({
      documentId: request.documentId,
      activity: request.activity,
      role: request.role,
      decision: "UNAUTHORIZED",
      sourceId: null,
      status: null,
      reason: "NO_REINDEX_DECISION",
      decisionRef: null,
    });
    const index = buildSearchIndex(store.state, { authorization: denyAll });
    expect(index.entries).toHaveLength(0);
    expect(index.total).toBe(0);
    expect(index.excludedDocuments.length).toBeGreaterThan(0);
    expect(
      index.excludedDocuments.every(
        (decision) =>
          decision.decision === "UNAUTHORIZED" &&
          decision.reason === "NO_REINDEX_DECISION",
      ),
    ).toBe(true);
  });

  it("authorizes each document independently", () => {
    const store = buildFixtureCorpus();
    const firstSourceId = store.state.documents[0]?.sourceId;
    let calls = 0;
    const index = buildSearchIndex(store.state, {
      // One call per document, not per chunk.
      authorization: (request) => {
        calls += 1;
        const sourceId =
          store.state.documents.find((d) => d.id === request.documentId)
            ?.sourceId ?? null;
        return {
          documentId: request.documentId,
          activity: request.activity,
          role: request.role,
          decision:
            sourceId === firstSourceId
              ? ("AUTHORIZED" as const)
              : ("UNAUTHORIZED" as const),
          sourceId,
          status: null,
          reason: "test",
          decisionRef: null,
        };
      },
    });
    expect(calls).toBeGreaterThan(0);
    expect(
      index.entries.every((entry) => entry.sourceId === firstSourceId),
    ).toBe(true);
  });
});
