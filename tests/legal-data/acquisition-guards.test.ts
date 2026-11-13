import { describe, expect, it } from "vitest";
import {
  type AcquisitionInput,
  type AuthorizationRef,
  assertFetchableUrl,
  assertSafeStorageKey,
  buildAcquisitionRecord,
  safeFilename,
} from "../../packages/legal-ingestion/src/index";

const bytes = new TextEncoder().encode("%PDF-1.4 synthetic bytes");
const authorized: AuthorizationRef = {
  sourceId: "authorized_source",
  state: "AUTHORIZED",
  evidenceRef: "docs/legal/source-approval.md#authorized_source",
  reviewedAt: "2026-11-10",
  reviewer: "counsel",
};

function input(overrides: Partial<AcquisitionInput> = {}): AcquisitionInput {
  return {
    artifactId: "art-1",
    sourceId: "authorized_source",
    sourceUrl: "https://example.gov.ph/document.pdf",
    officialTitle: "Synthetic Instrument",
    legalIdentifier: "Republic Act No. 1001",
    documentType: "REPUBLIC_ACT",
    retrievedAt: "2026-11-10T00:00:00Z",
    originalFilename: "instrument.pdf",
    mimeType: "application/pdf",
    bytes,
    acquisitionMethod: "manual_download",
    authorization: authorized,
    allowLegacySourceGate: true,
    ...overrides,
  };
}

describe("Gate 2 — acquisition manifest authorization gate", () => {
  it("refuses an unauthorized source", () => {
    const result = buildAcquisitionRecord(
      input({
        authorization: { sourceId: "authorized_source", state: "UNKNOWN" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("source_not_authorized:UNKNOWN");
  });

  it("refuses AUTHORIZED without a written evidence reference", () => {
    const result = buildAcquisitionRecord(
      input({
        authorization: { sourceId: "authorized_source", state: "AUTHORIZED" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("authorization_evidence_missing");
  });

  it("refuses an authorization bound to a different source", () => {
    const result = buildAcquisitionRecord(input({ sourceId: "other_source" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("authorization_source_mismatch");
  });

  it("refuses empty artifacts", () => {
    const result = buildAcquisitionRecord(input({ bytes: new Uint8Array() }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("empty_artifact");
  });

  it("accepts an authorized source and records hash and size", () => {
    const result = buildAcquisitionRecord(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.record.fileSizeBytes).toBe(bytes.length);
    expect(result.record.authorizationRecordRef).toContain("source-approval");
    expect(result.record.acquisitionOutcome).toBe("ACQUIRED");
  });

  it("refuses an authorized source whose URL is private or local", () => {
    for (const url of [
      "http://localhost/doc.pdf",
      "http://169.254.169.254/doc.pdf",
      "http://10.0.0.5/doc.pdf",
    ]) {
      const result = buildAcquisitionRecord(input({ sourceUrl: url }));
      expect(result.ok, url).toBe(false);
      expect(!result.ok && result.reason).toContain("unsafe_url");
    }
  });

  it("keeps unknown dates null rather than inventing them", () => {
    const result = buildAcquisitionRecord(input());
    expect(result.ok && result.record.publicationDate).toBeNull();
    expect(result.ok && result.record.effectivityDate).toBeNull();
  });

  it("allows a synthetic manifest only with a synthetic locator", () => {
    const good = buildAcquisitionRecord(
      input({
        synthetic: true,
        sourceUrl: "synthetic://fixture/1",
        authorization: { sourceId: "authorized_source", state: "UNKNOWN" },
      }),
    );
    expect(good.ok).toBe(true);
    const bad = buildAcquisitionRecord(
      input({
        synthetic: true,
        sourceUrl: "https://example.gov.ph/doc.pdf",
        authorization: { sourceId: "authorized_source", state: "UNKNOWN" },
      }),
    );
    expect(bad.ok).toBe(false);
  });
});

describe("Gate 2 — URL and path guards", () => {
  it("accepts ordinary public https URLs", () => {
    expect(
      assertFetchableUrl("https://elibrary.judiciary.gov.ph/document/1").ok,
    ).toBe(true);
    expect(assertFetchableUrl("http://example.gov.ph/doc.pdf").ok).toBe(true);
  });

  it("rejects non-http schemes and credentials", () => {
    expect(assertFetchableUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertFetchableUrl("ftp://example.gov.ph/doc").ok).toBe(false);
    expect(assertFetchableUrl("https://user:pass@example.gov.ph/doc").ok).toBe(
      false,
    );
  });

  it("rejects local and private hosts (SSRF guard)", () => {
    for (const url of [
      "http://localhost/admin",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://service.local/",
    ]) {
      expect(assertFetchableUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects non-standard ports", () => {
    expect(assertFetchableUrl("https://example.gov.ph:8080/doc").ok).toBe(
      false,
    );
  });

  it("reduces untrusted filenames to a safe leaf name", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Windows\\system.ini")).toBe("system.ini");
    expect(safeFilename("....")).toBe("document.pdf");
    expect(safeFilename("nor\u0000mal.pdf")).toBe("normal.pdf");
  });

  it("rejects path traversal in storage keys", () => {
    expect(assertSafeStorageKey("artifacts/abc.pdf").ok).toBe(true);
    expect(assertSafeStorageKey("../state.json").ok).toBe(false);
    expect(assertSafeStorageKey("/etc/passwd").ok).toBe(false);
    expect(assertSafeStorageKey("artifacts/../../x").ok).toBe(false);
  });
});
