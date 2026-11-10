import { describe, expect, it } from "vitest";
import {
  type ArtifactInput,
  CorpusStore,
  emptyCorpusState,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";

const OPTS = {
  pipelineVersion: "gate1.0.0",
  extractorVersion: "extract.1",
  normalizerVersion: "norm.1",
};

function lawArtifact(overrides: Partial<ArtifactInput> = {}): ArtifactInput {
  return {
    artifactId: "a1",
    sourceId: "synthetic_fixture",
    sourceUrl: "synthetic://RA-1001",
    mimeType: "text/plain",
    retrievedAt: "2026-11-10T00:00:00Z",
    synthetic: true,
    documentType: "REPUBLIC_ACT",
    identityKey: "REPUBLIC_ACT:1001",
    title: "Synthetic Republic Act No. 1001",
    officialNumber: "Synthetic Republic Act No. 1001",
    issuingBody: "Synthetic Congress",
    jurisdiction: "PH",
    approvalDate: "2019-01-01",
    effectivityDate: "2019-02-01",
    legalStatus: "IN_FORCE",
    content: [
      "Synthetic Republic Act No. 1001",
      "",
      "Section 1. This Act establishes a synthetic legal-research obligation.",
      "",
      "Section 2. A covered entity must register with the synthetic authority.",
      "",
      "Section 3. The synthetic authority may issue implementing rules.",
      "",
      "Section 4. A violation is subject to a synthetic administrative penalty.",
    ].join("\n"),
    ...overrides,
  };
}

describe("Gate 1 — bounded ingestion", () => {
  it("ingests a synthetic statute and preserves provenance", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, lawArtifact(), OPTS);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.documentId).toBeTruthy();
    expect(result.versionId).toBeTruthy();
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.provisionCount).toBe(4);
    expect(result.chunkCount).toBeGreaterThanOrEqual(4);

    const doc = store.state.documents[0]!;
    expect(doc.identityKey).toBe("REPUBLIC_ACT:1001");
    expect(doc.legalStatus).toBe("IN_FORCE");
    const manifest = store.state.manifestations[0]!;
    expect(manifest.contentHash).toBe(result.contentHash);
    expect(manifest.storageKey).toContain(result.contentHash);
    expect(store.state.runs[0]!.status).toBe("SUCCEEDED");
  });

  it("refuses non-synthetic material from an unauthorized source", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      lawArtifact({ synthetic: false, sourceId: "sc_elibrary" }),
      OPTS,
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("source_not_authorized");
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.manifestations).toHaveLength(0);
    expect(store.state.runs).toHaveLength(1);
    expect(store.state.runs[0]!.status).toBe("FAILED");
  });

  it("accepts non-synthetic material only when the source is explicitly authorized", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      lawArtifact({ synthetic: false, sourceId: "authorized_test_source" }),
      { ...OPTS, authorizedSourceIds: ["authorized_test_source"] },
    );
    expect(result.status).toBe("SUCCEEDED");
  });

  it("is idempotent for identical bytes from the same source", () => {
    const store = CorpusStore.memory();
    const first = ingestArtifact(store, lawArtifact(), OPTS);
    const second = ingestArtifact(store, lawArtifact(), OPTS);

    expect(first.status).toBe("SUCCEEDED");
    expect(second.status).toBe("DUPLICATE");
    expect(second.duplicate).toBe(true);
    expect(store.state.documents).toHaveLength(1);
    expect(store.state.versions).toHaveLength(1);
    expect(store.state.manifestations).toHaveLength(1);
  });

  it("treats identical normalized text as a duplicate, not a new version", () => {
    const store = CorpusStore.memory();
    ingestArtifact(store, lawArtifact(), OPTS);
    const second = ingestArtifact(
      store,
      lawArtifact({
        // same text, different source URL and artifact id => same normalized content
        artifactId: "a2",
        sourceUrl: "synthetic://RA-1001-copy",
      }),
      OPTS,
    );
    expect(second.status).toBe("DUPLICATE");
    expect(store.state.documents).toHaveLength(1);
    expect(store.state.versions).toHaveLength(1);
  });

  it("creates a new immutable version when source content changes", () => {
    const store = CorpusStore.memory();
    const first = ingestArtifact(store, lawArtifact(), OPTS);
    const second = ingestArtifact(
      store,
      lawArtifact({
        content: lawArtifact()
          .content?.toString()
          .replace(
            "synthetic administrative penalty",
            "synthetic civil penalty",
          ),
        effectivityDate: "2020-03-01",
      }),
      OPTS,
    );

    expect(second.status).toBe("SUCCEEDED");
    expect(second.documentId).toBe(first.documentId);
    expect(store.state.documents).toHaveLength(1);
    expect(store.state.versions).toHaveLength(2);

    const versions = store.state.versions;
    const prior = versions.find((v) => v.versionNumber === 1)!;
    const current = versions.find((v) => v.versionNumber === 2)!;
    expect(prior.isCurrent).toBe(false);
    expect(prior.effectiveTo).toBe("2020-03-01");
    expect(current.isCurrent).toBe(true);
    expect(current.effectiveFrom).toBe("2020-03-01");
    expect(current.changeSummary).toContain("content changed");
    // provisions of version 1 remain intact
    expect(
      store.state.provisions.filter((p) => p.versionId === prior.id).length,
    ).toBe(4);
  });

  it("fails an empty extraction without mutating the corpus, then recovers", () => {
    const store = CorpusStore.memory();
    const failed = ingestArtifact(
      store,
      lawArtifact({
        mimeType: "text/html",
        content: "<html><script>var x=1;</script><style>p{}</style></html>",
      }),
      OPTS,
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.reason).toBe("empty_extraction");
    expect(store.state.documents).toHaveLength(0);

    const recovered = ingestArtifact(store, lawArtifact(), OPTS);
    expect(recovered.status).toBe("SUCCEEDED");
    expect(store.state.documents).toHaveLength(1);
  });

  it("flags an identity collision with a different document type", () => {
    const store = CorpusStore.memory();
    ingestArtifact(store, lawArtifact(), OPTS);
    const clash = ingestArtifact(
      store,
      lawArtifact({ documentType: "EXECUTIVE_ORDER" }),
      OPTS,
    );
    expect(clash.status).toBe("IDENTITY_AMBIGUOUS");
    expect(store.state.documents).toHaveLength(1);
  });

  it("rejects unsupported MIME types", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      lawArtifact({ mimeType: "application/pdf" }),
      OPTS,
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("unsupported_mime");
  });

  it("strips HTML but keeps the legal text", () => {
    const store = CorpusStore.memory();
    const html = `<html><head><style>p{color:red}</style><script>alert(1)</script></head><body>
      <h1>Synthetic Act</h1>
      <p>Section 1.&nbsp;A synthetic duty applies.</p>
      <p>Section 2. A synthetic remedy exists.</p>
    </body></html>`;
    const result = ingestArtifact(
      store,
      lawArtifact({ mimeType: "text/html", content: html }),
      OPTS,
    );
    expect(result.status).toBe("SUCCEEDED");
    const text = store.state.chunks.map((c) => c.content).join(" ");
    expect(text).toContain("synthetic duty applies");
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain("color:red");
  });
});

describe("Gate 1 — legal versioning and relationships", () => {
  it("applies an evidenced amendment to the named provision only", () => {
    const store = CorpusStore.memory();
    ingestArtifact(store, lawArtifact(), OPTS);
    const amend = ingestArtifact(
      store,
      lawArtifact({
        artifactId: "amend",
        identityKey: "REPUBLIC_ACT:1002",
        documentType: "REPUBLIC_ACT",
        title: "Synthetic Republic Act No. 1002",
        officialNumber: "Synthetic Republic Act No. 1002",
        content:
          "Section 1. Section 2 of Synthetic Republic Act No. 1001 is hereby amended.",
        effectivityDate: "2020-01-01",
        relationships: [
          {
            toIdentityKey: "REPUBLIC_ACT:1001",
            type: "AMENDS",
            scope: "Section 2",
            effectiveDate: "2020-01-01",
            evidencePassage:
              "Section 2 of Synthetic Republic Act No. 1001 is hereby amended.",
          },
        ],
      }),
      OPTS,
    );

    expect(amend.status).toBe("SUCCEEDED");
    const rel = store.state.relationships[0]!;
    expect(rel.relationshipType).toBe("AMENDS");
    expect(rel.verificationStatus).toBe("VERIFIED");

    const target = store.state.documents.find(
      (d) => d.identityKey === "REPUBLIC_ACT:1001",
    )!;
    const sections = store.state.provisions.filter(
      (p) => p.documentId === target.id,
    );
    const s2 = sections.find((p) => p.label === "Section 2")!;
    const s3 = sections.find((p) => p.label === "Section 3")!;
    expect(s2.legalStatus).toBe("AMENDED");
    expect(s2.amendedByDocumentId).toBe(amend.documentId);
    expect(s3.legalStatus).toBe("IN_FORCE");
    expect(target.legalStatus).toBe("PARTIALLY_AMENDED");
  });

  it("does not apply a relationship that has no evidence passage", () => {
    const store = CorpusStore.memory();
    ingestArtifact(store, lawArtifact(), OPTS);
    ingestArtifact(
      store,
      lawArtifact({
        identityKey: "REPUBLIC_ACT:1003",
        title: "Synthetic Republic Act No. 1003",
        content: "Section 1. A synthetic repeal is asserted without quotation.",
        relationships: [
          { toIdentityKey: "REPUBLIC_ACT:1001", type: "REPEALS" },
        ],
      }),
      OPTS,
    );

    const rel = store.state.relationships[0]!;
    expect(rel.verificationStatus).toBe("UNVERIFIED");
    const target = store.state.documents.find(
      (d) => d.identityKey === "REPUBLIC_ACT:1001",
    )!;
    expect(target.legalStatus).toBe("IN_FORCE");
  });

  it("resolves a pending relationship when the target is ingested later", () => {
    const store = CorpusStore.memory();
    ingestArtifact(
      store,
      lawArtifact({
        identityKey: "REPUBLIC_ACT:2002",
        title: "Synthetic Amending Act",
        content: "Section 1. Synthetic Republic Act No. 2001 is amended.",
        relationships: [
          {
            toIdentityKey: "REPUBLIC_ACT:2001",
            type: "PARTIALLY_AMENDS",
            evidencePassage: "Synthetic Republic Act No. 2001 is amended.",
          },
        ],
      }),
      OPTS,
    );
    expect(store.state.relationships).toHaveLength(0);
    expect(store.state.pendingRelationships).toHaveLength(1);

    ingestArtifact(
      store,
      lawArtifact({
        identityKey: "REPUBLIC_ACT:2001",
        title: "Synthetic Target Act",
        content: "Section 1. A target provision.",
      }),
      OPTS,
    );
    expect(store.state.pendingRelationships).toHaveLength(0);
    expect(store.state.relationships).toHaveLength(1);
    expect(store.state.relationships[0]!.verificationStatus).toBe("VERIFIED");
  });
});
