import { describe, expect, it } from "vitest";
import {
  ActivityAuthorizationRegistry,
  AuthorizationAuditService,
  authorizeIndexing,
  authorizeTemporaryLocalStorage,
  buildAcquisitionRecord,
  CorpusStore,
  type CounselActivity,
  type CounselDetermination,
  CounselDeterminationRepository,
  InMemoryAuthorizationAuditSink,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";

const SOURCE = "synthetic_audit_source";
const COUNSEL_ID = "c_audit";
const DET_ID = "d_audit";

function repo(): CounselDeterminationRepository {
  const r = new CounselDeterminationRepository();
  r.registerCounsel(
    {
      id: COUNSEL_ID,
      name: "Synthetic Audit Counsel",
      firm: null,
      jurisdiction: "PH",
      capacity: "Legal counsel",
      verificationStatus: "VERIFIED",
      verificationEvidenceRef: "synthetic://audit/verification",
      verifiedBy: "synthetic-registrar",
      verifiedAt: "2026-11-13",
    },
    "synthetic-registrar",
    "setup",
  );
  return r;
}

function determination(activities: CounselActivity[]): CounselDetermination {
  return {
    id: DET_ID,
    sourceId: SOURCE,
    documentIds: [],
    counselId: COUNSEL_ID,
    dateReceived: "2026-11-13",
    dateIssued: "2026-11-13",
    effectiveDate: "2026-11-13",
    expiryDate: "2027-11-13",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic audit determination",
    activityDecisions: activities.map((activity) => ({
      activity,
      status: "APPROVED",
      scope: null,
      conditions: [],
      limitations: [],
      permittedUsers: [],
      effectiveDate: null,
      expiryDate: null,
      evidenceRef: "synthetic://audit/evidence",
    })),
    evidenceRefs: ["synthetic://audit/evidence"],
    decisionDocumentRef: "synthetic://audit/decision",
    decisionDocumentHash: "b".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: null,
  };
}

function service(): {
  service: AuthorizationAuditService;
  sink: InMemoryAuthorizationAuditSink;
} {
  const sink = new InMemoryAuthorizationAuditSink();
  return { service: new AuthorizationAuditService(sink), sink };
}

describe("Gate 7 — centralized authorization audit", () => {
  it("records a temporary-storage denial before any write", () => {
    const r = repo();
    const { service: audit, sink } = service();
    const check = authorizeTemporaryLocalStorage(
      r,
      { sourceId: SOURCE, documentId: "doc-1" },
      {},
      { service: audit, correlationId: "corr-temp" },
    );
    expect(check().allowed).toBe(false);
    const events = sink.list();
    expect(events).toHaveLength(1);
    expect(events[0]?.activity).toBe("temporary_local_storage");
    expect(events[0]?.outcome).toBe("DENIED");
    expect(events[0]?.reasonCode).toBe("no_verified_determination");
    expect(JSON.stringify(events[0]?.context)).not.toContain("SECTION");
  });

  it("records a temporary-storage grant when a decision is valid", () => {
    const r = repo();
    r.record(
      determination(["temporary_local_storage"]),
      "synthetic-registrar",
      "temp",
    );
    const { service: audit, sink } = service();
    const check = authorizeTemporaryLocalStorage(
      r,
      { sourceId: SOURCE, documentId: "doc-1" },
      {},
      { service: audit },
    );
    expect(check().allowed).toBe(true);
    expect(sink.list()[0]?.outcome).toBe("GRANTED");
  });

  it("records reindex denial and grant", () => {
    const r = repo();
    const { service: audit, sink } = service();
    expect(
      authorizeIndexing(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        {},
        { service: audit },
      ).allowed,
    ).toBe(false);
    expect(sink.list()[0]?.operation).toBe("reindex");
    expect(sink.list()[0]?.outcome).toBe("DENIED");

    r.record(
      determination([
        "temporary_processing",
        "text_extraction",
        "search_indexing",
      ]),
      "synthetic-registrar",
      "index",
    );
    expect(
      authorizeIndexing(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        {},
        { service: audit },
      ).allowed,
    ).toBe(true);
    expect(sink.list().at(-1)?.outcome).toBe("GRANTED");
  });

  it("audits a registry-unavailable ingestion before content access", () => {
    const store = CorpusStore.memory();
    const { service: audit, sink } = service();
    const result = ingestArtifact(
      store,
      {
        artifactId: "audit-ingest",
        sourceId: SOURCE,
        sourceUrl: "https://example.gov.ph/audit",
        mimeType: "text/html",
        retrievedAt: "2026-11-13T00:00:00Z",
        synthetic: false,
        content:
          "<html><body>SECTION 1. Synthetic audit content.</body></html>",
        documentType: "REPUBLIC_ACT",
        identityKey: "REPUBLIC_ACT:99901",
        title: "Republic Act No. 99901",
      },
      {
        pipelineVersion: "gate7.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
        enforceActivityAuthorization: true,
        authorizationAudit: audit,
      },
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("activity_authorization_registry_missing");
    expect(sink.list()[0]?.eventType).toBe("REGISTRY_UNAVAILABLE");
    expect(store.state.documents).toHaveLength(0);
  });

  it("audits acquisition denial", () => {
    const { service: audit, sink } = service();
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      {
        sourceId: SOURCE,
        activity: "downloading",
        status: "PROHIBITED",
        basis: "COUNSEL_DETERMINATION",
        evidenceRef: "synthetic://audit/decision",
        reviewer: "Synthetic Audit Counsel",
        decisionDate: "2026-11-13",
      },
      "synthetic-counsel",
      "prohibited",
    );
    const result = buildAcquisitionRecord({
      artifactId: "audit-acq",
      sourceId: SOURCE,
      sourceUrl: "https://example.gov.ph/audit",
      officialTitle: "Synthetic",
      documentType: "REPUBLIC_ACT",
      retrievedAt: "2026-11-13T00:00:00Z",
      originalFilename: "a.html",
      mimeType: "text/html",
      bytes: new TextEncoder().encode("x"),
      acquisitionMethod: "manual",
      authorization: {
        sourceId: SOURCE,
        state: "AUTHORIZED",
        evidenceRef: "synthetic://audit/decision",
      },
      enforceActivityAuthorization: true,
      activityAuthorization: registry,
      authorizationAudit: audit,
    });
    expect(result.ok).toBe(false);
    expect(sink.list()[0]?.operation).toBe("acquisition");
    expect(sink.list()[0]?.outcome).toBe("DENIED");
  });

  it("fails closed for temp storage and reindex when audit persistence fails", () => {
    const r = repo();
    r.record(
      determination([
        "temporary_local_storage",
        "temporary_processing",
        "text_extraction",
        "search_indexing",
      ]),
      "synthetic-registrar",
      "all needed",
    );
    const failing = new AuthorizationAuditService({
      append() {
        throw new Error("audit down");
      },
    });
    expect(
      authorizeTemporaryLocalStorage(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        {},
        { service: failing },
      )().reason,
    ).toBe("authorization_audit_unavailable");
    expect(
      authorizeIndexing(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        {},
        { service: failing },
      ).allowed,
    ).toBe(false);
  });

  it("fails closed when the audit sink fails", () => {
    const store = CorpusStore.memory();
    const failing = new AuthorizationAuditService({
      append() {
        throw new Error("audit down");
      },
    });
    const registry = new ActivityAuthorizationRegistry();
    for (const activity of [
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
      "search_indexing",
    ] as const) {
      registry.record(
        {
          sourceId: SOURCE,
          activity,
          status: "AUTHORIZED",
          basis: "COUNSEL_DETERMINATION",
          evidenceRef: "synthetic://audit/decision",
          counselDecisionRef: "det-audit",
          reviewer: "Synthetic Audit Counsel",
          decisionDate: "2026-11-13",
        },
        "synthetic-counsel",
        "authorized",
      );
    }
    const result = ingestArtifact(
      store,
      {
        artifactId: "audit-fail",
        sourceId: SOURCE,
        sourceUrl: "https://example.gov.ph/audit",
        mimeType: "text/html",
        retrievedAt: "2026-11-13T00:00:00Z",
        synthetic: false,
        content:
          "<html><body>SECTION 1. Synthetic audit content.</body></html>",
        documentType: "REPUBLIC_ACT",
        identityKey: "REPUBLIC_ACT:99902",
        title: "Republic Act No. 99902",
      },
      {
        pipelineVersion: "gate7.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
        enforceActivityAuthorization: true,
        activityAuthorization: registry,
        authorizationAudit: failing,
      },
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("authorization_audit_unavailable");
  });
});
