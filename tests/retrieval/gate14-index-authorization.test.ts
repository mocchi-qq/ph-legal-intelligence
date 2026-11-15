// Gate 14 — index build authorization, against the real activity registry.
// Every fixture is fictional. No Philippine law is represented or implied.
//
// The index build fixes the activity to `search_indexing` and the role to
// `TARGET`. These tests prove that the fixed activity is the one decided, that a
// decision recorded for a different activity cannot index, and that the refusal
// is reported per document rather than silently skipped.
import { describe, expect, it } from "vitest";
import {
  ActivityAuthorizationRegistry,
  type CorpusState,
  createRegistryAuthorization,
  type DecisionInput,
  type DocumentActivityDecision,
  type DocumentActivityRequest,
} from "../../packages/legal-ingestion/src/index";
import { buildSearchIndex } from "../../packages/legal-search/src/index";
import { allowSyntheticIndex, buildFixtureCorpus } from "../benchmark/helpers";

const SOURCE_ID = "synthetic_fixture";
const ALTERNATE_SOURCE_ID = "synthetic_fixture_alternate";

const FIXTURE = {
  evidenceRef: "synthetic://gate14/evidence-1",
  reviewer: "synthetic-reviewer",
  decisionDate: "2026-11-15",
};

function fixture(
  activity: DecisionInput["activity"],
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId: SOURCE_ID,
    activity,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    ...FIXTURE,
    ...overrides,
  };
}

function registryWith(
  ...inputs: DecisionInput[]
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const input of inputs)
    registry.record(input, "synthetic-author", "synthetic fixture");
  return registry;
}

/** Every document id that actually carries chunks, sorted. */
function indexedDocumentIds(state: CorpusState): string[] {
  return [...new Set(state.chunks.map((chunk) => chunk.documentId))].sort();
}

/** A registry-backed resolver over this corpus, as a caller would wire it. */
function authorizationOver(
  registry: ActivityAuthorizationRegistry,
  state: CorpusState,
) {
  return createRegistryAuthorization({
    registry,
    sourceOfDocument: (documentId) =>
      state.documents.find((document) => document.id === documentId)
        ?.sourceId ?? null,
  });
}

function build(registry: ActivityAuthorizationRegistry) {
  const store = buildFixtureCorpus();
  const authorization = authorizationOver(registry, store.state);
  return {
    store,
    index: buildSearchIndex(store.state, { authorization }),
  };
}

describe("Gate 14 — index build authorization", () => {
  it("indexes nothing and reports every document when no decision is recorded", () => {
    const { store, index } = build(new ActivityAuthorizationRegistry());
    const expected = indexedDocumentIds(store.state);

    expect(expected.length).toBeGreaterThan(0);
    expect(index.entries).toHaveLength(0);
    expect(index.total).toBe(0);
    expect(index.docFreq.size).toBe(0);

    expect(index.excludedDocuments).toHaveLength(expected.length);
    expect(index.excludedDocuments.map((d) => d.documentId)).toEqual(expected);
    for (const decision of index.excludedDocuments) {
      expect(decision).toMatchObject({
        activity: "search_indexing",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: SOURCE_ID,
        reason: "no_decision_recorded",
      });
    }
  });

  it("indexes exactly the source whose search_indexing decision is recorded", () => {
    const base = buildFixtureCorpus();
    // A second synthetic source, so one decision can authorize one source and
    // leave the other unrecorded. Document ids and content are the fixtures'.
    const alternate = new Set(
      base.state.documents
        .filter((_, position) => position % 2 === 1)
        .map((document) => document.id),
    );
    const state: CorpusState = {
      ...base.state,
      documents: base.state.documents.map((document) =>
        alternate.has(document.id)
          ? { ...document, sourceId: ALTERNATE_SOURCE_ID }
          : document,
      ),
    };
    const authorization = authorizationOver(
      registryWith(fixture("search_indexing")),
      state,
    );

    const index = buildSearchIndex(state, { authorization });
    const authorized = indexedDocumentIds(state).filter(
      (documentId) => !alternate.has(documentId),
    );
    const excluded = indexedDocumentIds(state).filter((documentId) =>
      alternate.has(documentId),
    );

    expect(authorized.length).toBeGreaterThan(0);
    expect(excluded.length).toBeGreaterThan(0);
    expect(index.entries.length).toBeGreaterThan(0);
    expect(new Set(index.entries.map((entry) => entry.documentId))).toEqual(
      new Set(authorized),
    );
    expect(index.entries.every((entry) => entry.sourceId === SOURCE_ID)).toBe(
      true,
    );

    expect(index.excludedDocuments.map((d) => d.documentId)).toEqual(excluded);
    for (const decision of index.excludedDocuments) {
      expect(decision).toMatchObject({
        activity: "search_indexing",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: ALTERNATE_SOURCE_ID,
        reason: "no_decision_recorded",
      });
    }
  });

  it("cannot index a document authorized only for viewing", () => {
    const { store, index } = build(registryWith(fixture("viewing")));

    expect(index.entries).toHaveLength(0);
    expect(index.excludedDocuments).toHaveLength(
      indexedDocumentIds(store.state).length,
    );
    for (const decision of index.excludedDocuments) {
      // A decision exists for the source, but not for `search_indexing`.
      expect(decision).toMatchObject({
        documentId: expect.any(String),
        activity: "search_indexing",
        role: "TARGET",
        decision: "NOT_CHECKED",
        reason: "no_decision_recorded",
      });
    }
  });

  it("excludes a document prohibited for search_indexing and keeps the reason", () => {
    const { store, index } = build(
      registryWith(fixture("search_indexing", { status: "PROHIBITED" })),
    );

    expect(index.entries).toHaveLength(0);
    expect(index.excludedDocuments).toHaveLength(
      indexedDocumentIds(store.state).length,
    );
    for (const decision of index.excludedDocuments) {
      expect(decision).toMatchObject({
        activity: "search_indexing",
        role: "TARGET",
        decision: "UNAUTHORIZED",
        sourceId: SOURCE_ID,
        status: "PROHIBITED",
        reason: "prohibited",
      });
      expect(decision.decisionRef).not.toBeNull();
    }
  });

  it("asks once per document even when a document has several chunks", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);
    const calls = new Map<string, number>();
    const authorization = authorizationOver(
      registryWith(fixture("search_indexing")),
      store.state,
    );

    const index = buildSearchIndex(store.state, {
      authorization: (request) => {
        calls.set(request.documentId, (calls.get(request.documentId) ?? 0) + 1);
        return authorization(request);
      },
    });

    // Non-vacuous: there are more chunks than documents, so per-chunk counting
    // would be visible here.
    expect(store.state.chunks.length).toBeGreaterThan(expected.length);
    expect(index.entries.length).toBeGreaterThan(expected.length);
    expect([...calls.keys()].sort()).toEqual(expected);
    for (const count of calls.values()) expect(count).toBe(1);
    expect(index.excludedDocuments).toEqual([]);
  });

  it("rejects the removed authorize option", () => {
    const store = buildFixtureCorpus();
    expect(() =>
      buildSearchIndex(store.state, {
        authorize: allowSyntheticIndex,
      } as never),
    ).toThrow(/index_authorization_required/);
  });
});

// Gate 13 removed the bare decision from the authority projection, so the index
// boundary must not accept it either. A JavaScript caller — or a TypeScript
// caller using a cast — can otherwise answer `{ decision: "AUTHORIZED" }` with
// nothing checked, and every document is indexed. These tests pin the fail-closed
// reading of each malformed answer.
describe("Gate 14 — malformed authorization answers fail closed", () => {
  it("excludes every document when the resolver answers with a bare decision", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);

    const index = buildSearchIndex(store.state, {
      authorization: (() => ({ decision: "AUTHORIZED" })) as never,
    });

    expect(expected.length).toBeGreaterThan(0);
    expect(index.entries).toHaveLength(0);
    expect(index.total).toBe(0);
    expect(index.docFreq.size).toBe(0);
    expect(index.excludedDocuments).toHaveLength(expected.length);
    expect(index.excludedDocuments.map((d) => d.documentId)).toEqual(expected);
    for (const decision of index.excludedDocuments) {
      expect(decision.decision).toBe("NOT_CHECKED");
      // No activity was claimed, so it is unknown, not merely different.
      expect(decision.reason).toBe("unknown_activity");
      // The build's question, never the resolver's claim.
      expect(decision.activity).toBe("search_indexing");
      expect(decision.role).toBe("TARGET");
      expect(decision.sourceId).toBeNull();
      expect(decision.status).toBeNull();
      expect(decision.decisionRef).toBeNull();
    }
  });

  it("excludes a document that was decided for a different activity", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);

    const index = buildSearchIndex(store.state, {
      authorization: ((request: DocumentActivityRequest) => ({
        decision: "AUTHORIZED",
        activity: "viewing",
        documentId: request.documentId,
      })) as never,
    });

    expect(index.entries).toHaveLength(0);
    expect(index.excludedDocuments).toHaveLength(expected.length);
    expect(index.excludedDocuments.map((d) => d.documentId)).toEqual(expected);
    for (const decision of index.excludedDocuments) {
      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("activity_mismatch");
      expect(decision.activity).toBe("search_indexing");
    }
  });

  it("excludes a document when the answer names another document", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);

    const index = buildSearchIndex(store.state, {
      authorization: (() => ({
        decision: "AUTHORIZED",
        activity: "search_indexing",
        documentId: "SOME-OTHER-DOC",
      })) as never,
    });

    expect(index.entries).toHaveLength(0);
    expect(index.excludedDocuments).toHaveLength(expected.length);
    expect(index.excludedDocuments.map((d) => d.documentId)).toEqual(expected);
    for (const decision of index.excludedDocuments) {
      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("document_mismatch");
    }
  });

  it("excludes a document whose decision is not a canonical literal", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);

    const index = buildSearchIndex(store.state, {
      authorization: ((request: DocumentActivityRequest) => ({
        decision: "yes",
        activity: "search_indexing",
        documentId: request.documentId,
      })) as never,
    });

    expect(index.entries).toHaveLength(0);
    expect(index.excludedDocuments).toHaveLength(expected.length);
    for (const decision of index.excludedDocuments) {
      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("invalid_decision");
    }
  });

  it("indexes when the resolver answers with a complete matching decision", () => {
    const store = buildFixtureCorpus();
    const expected = indexedDocumentIds(store.state);

    const authorization = (
      request: DocumentActivityRequest,
    ): DocumentActivityDecision => ({
      documentId: request.documentId,
      activity: "search_indexing",
      role: "TARGET",
      decision: "AUTHORIZED",
      sourceId: SOURCE_ID,
      status: "AUTHORIZED",
      reason: "authorized",
      decisionRef: "synthetic-decision-1",
    });

    const index = buildSearchIndex(store.state, { authorization });

    expect(expected.length).toBeGreaterThan(0);
    expect(index.entries.length).toBeGreaterThan(expected.length);
    expect(index.total).toBe(index.entries.length);
    expect(index.excludedDocuments).toEqual([]);
    expect(new Set(index.entries.map((entry) => entry.documentId))).toEqual(
      new Set(expected),
    );
  });
});
