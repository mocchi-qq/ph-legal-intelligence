import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ArtifactInput,
  CorpusStore,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";
import { buildSearchIndex } from "../../packages/legal-search/src/index";
import { buildFixtureCorpus } from "../benchmark/helpers";

const OPTS = {
  pipelineVersion: "gate1.0.0",
  extractorVersion: "extract.1",
  normalizerVersion: "norm.1",
  allowLegacySourceGate: true,
};

function artifact(overrides: Partial<ArtifactInput> = {}): ArtifactInput {
  return {
    artifactId: "private-1",
    sourceId: "private_upload",
    sourceUrl: "private://tenant-a/doc-1",
    mimeType: "text/plain",
    retrievedAt: "2026-11-10T00:00:00Z",
    synthetic: false,
    documentType: "LEGAL_REFERENCE",
    identityKey: "PRIVATE:TENANT-A:1",
    title: "Private client document",
    content:
      "Private client facts that must never enter the public legal index.",
    ...overrides,
  };
}

describe("Gate 1 — security and privacy controls", () => {
  it("refuses real material from an unauthorized source and persists no artifact", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact(), OPTS);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("source_not_authorized");
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.manifestations).toHaveLength(0);
  });

  it("records an audit run for every attempt, including refusals", () => {
    const store = CorpusStore.memory();
    ingestArtifact(store, artifact(), OPTS);
    ingestArtifact(
      store,
      artifact({ synthetic: true, sourceId: "synthetic_fixture" }),
      OPTS,
    );
    expect(store.state.runs).toHaveLength(2);
    expect(
      store.state.runs.every((run) => run.pipelineVersion === "gate1.0.0"),
    ).toBe(true);
    expect(store.state.runs[0]!.status).toBe("FAILED");
  });

  it("keeps the public index free of private documents by construction", () => {
    const store = buildFixtureCorpus();
    const index = buildSearchIndex(store.state);
    expect(index.entries.length).toBeGreaterThan(0);
    expect(
      index.entries.some((entry) => entry.sourceId === "private_upload"),
    ).toBe(false);
    const results = buildSearchIndex({
      ...store.state,
      documents: store.state.documents.filter(
        (d) => d.sourceId === "private_upload",
      ),
    }).entries;
    expect(results).toHaveLength(0);
  });

  it("rejects a synthetic flag without a synthetic locator", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact({ synthetic: true }), OPTS);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("synthetic_flag_without_synthetic_locator");
    expect(store.state.documents).toHaveLength(0);
  });

  it("does not accept unsupported file types", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      artifact({
        synthetic: true,
        sourceUrl: "synthetic://fixture/pdf",
        mimeType: "application/pdf",
      }),
      OPTS,
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("unsupported_mime");
  });

  it("commits no secrets or real legal source material", () => {
    const root = process.cwd();
    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    expect(envExample).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
    expect(envExample).not.toMatch(/AKIA[0-9A-Z]{16}/);
    const manifest = JSON.parse(
      readFileSync(
        join(root, "legal-data/benchmark/synthetic-fixtures/manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.synthetic).toBe(true);
    for (const fixture of manifest.fixtures)
      expect(fixture.synthetic).toBe(true);
  });

  it("labels every synthetic fixture as synthetic", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "legal-data/benchmark/synthetic-fixtures/manifest.json",
        ),
        "utf8",
      ),
    );
    expect(manifest.notice).toMatch(/SYNTHETIC/);
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    for (const fixture of manifest.fixtures) {
      expect(fixture.sourceId).toBe("synthetic_fixture");
      expect(fixture.sourceUrl.startsWith("synthetic://")).toBe(true);
    }
  });
});
