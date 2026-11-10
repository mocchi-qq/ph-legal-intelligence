import { describe, expect, it } from "vitest";
import type { AcquisitionRecord } from "../../packages/legal-ingestion/src/index";
import {
  linkAcquisitionToSnapshot,
  SnapshotStore,
} from "../../packages/legal-ingestion/src/index";

const base = {
  sourceId: "sc_elibrary",
  requestedUrl: "https://example.gov.ph/ra.html",
  finalUrl: "https://example.gov.ph/ra.html",
  redirectChain: [],
  retrievedAt: "2026-11-10T00:00:00Z",
  httpStatus: 200,
  mimeType: "text/html",
  declaredContentLength: null,
  etag: null,
  lastModified: null,
  softwareVersion: "gate3.0.0",
  authorizationState: "UNKNOWN",
  outcome: "ACQUIRED" as const,
};

const encoder = new TextEncoder();

describe("Gate 3 — immutable acquisition snapshots", () => {
  it("stores each retrieval as a distinct event and preserves earlier bytes", () => {
    const store = new SnapshotStore();
    const first = store.record({
      ...base,
      bytes: encoder.encode("first version"),
    });
    const second = store.record({
      ...base,
      retrievedAt: "2026-11-11T00:00:00Z",
      bytes: encoder.encode("second version"),
    });
    expect(store.events).toHaveLength(2);
    expect(first.sha256).not.toBe(second.sha256);
    expect(Buffer.from(store.get(first.sha256)!).toString()).toBe(
      "first version",
    );
    expect(Buffer.from(store.get(second.sha256)!).toString()).toBe(
      "second version",
    );
  });

  it("classifies identical bytes without requiring legal review", () => {
    const store = new SnapshotStore();
    const bytes = encoder.encode("same");
    store.record({ ...base, bytes });
    const comparison = store.compareLatest(
      base.sourceId,
      base.requestedUrl,
      bytes,
    );
    expect(comparison?.changeClass).toBe("IDENTICAL_BYTES");
    expect(comparison?.requiresLegalReview).toBe(false);
  });

  it("classifies whitespace-only differences as text-equivalent", () => {
    const store = new SnapshotStore();
    store.record({
      ...base,
      bytes: encoder.encode("<p>A  law</p>"),
      text: "A law",
    });
    const comparison = store.compareLatest(
      base.sourceId,
      base.requestedUrl,
      encoder.encode("<div>A\n law</div>"),
      "A   law",
    );
    expect(comparison?.changeClass).toBe("TEXT_EQUIVALENT");
    expect(comparison?.requiresLegalReview).toBe(false);
  });

  it("requires legal review when normalized text changes", () => {
    const store = new SnapshotStore();
    store.record({
      ...base,
      bytes: encoder.encode("old text"),
      text: "Section 1. Old.",
    });
    const comparison = store.compareLatest(
      base.sourceId,
      base.requestedUrl,
      encoder.encode("new text"),
      "Section 1. New.",
    );
    expect(comparison?.changeClass).toBe("CONTENT_CHANGED");
    expect(comparison?.requiresLegalReview).toBe(true);
  });

  it("never creates a legal version from a hash change", () => {
    const store = new SnapshotStore();
    const event = store.record({ ...base, bytes: encoder.encode("content") });
    expect(store.toManifestEntry(event).legal_version_created).toBe(false);
  });

  it("returns null when there is no previous snapshot", () => {
    const store = new SnapshotStore();
    expect(
      store.compareLatest(
        "other",
        "https://example.gov.ph/x",
        encoder.encode("x"),
      ),
    ).toBeNull();
  });

  it("links an acquisition record to its snapshot only when hashes match", () => {
    const store = new SnapshotStore();
    const bytes = encoder.encode("content");
    const event = store.record({ ...base, bytes });
    const record = {
      internalDocumentId: "doc-1",
      sha256: event.sha256,
    } as AcquisitionRecord;
    expect(linkAcquisitionToSnapshot(record, event).hashMatches).toBe(true);
    expect(
      linkAcquisitionToSnapshot(
        { ...record, sha256: "0".repeat(64) } as AcquisitionRecord,
        event,
      ).hashMatches,
    ).toBe(false);
  });
});
