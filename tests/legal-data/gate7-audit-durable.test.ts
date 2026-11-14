// Gate 7 — centralized authorization audit: durable sink, fail-closed behaviour,
// and registry-failure handling. Synthetic fixtures only.
import { describe, expect, it } from "vitest";
import {
  AuthorizationAuditService,
  AuthorizationAuditUnavailableError,
  authorizeTemporaryLocalStorage,
  CounselAuthorizationService,
  type CounselDetermination,
  CounselDeterminationRepository,
  D1AuthorizationAuditSink,
  D1CounselRegistry,
  InMemoryAuthorizationAuditSink,
  InMemoryCounselRegistry,
  UnavailableEvidenceStore,
} from "../../packages/legal-ingestion/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const SOURCE = "synthetic_durable_audit_source";
const NOW = "2026-11-14T12:00:00Z";

function professional() {
  return {
    id: "c_audit",
    name: "Synthetic Audit Counsel",
    firm: null,
    jurisdiction: "PH",
    capacity: "Legal counsel",
    verificationStatus: "VERIFIED" as const,
    verificationEvidenceRef: "synthetic://audit/verification",
    verifiedBy: "synthetic-registrar",
    verifiedAt: "2026-11-14",
  };
}

function determination(): CounselDetermination {
  return {
    id: "det_audit",
    sourceId: SOURCE,
    documentIds: [],
    counselId: "c_audit",
    dateReceived: "2026-11-14",
    dateIssued: "2026-11-14",
    effectiveDate: "2026-11-01",
    expiryDate: "2027-11-01",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic durable audit determination",
    activityDecisions: [
      {
        activity: "downloading",
        status: "APPROVED",
        scope: null,
        conditions: [],
        limitations: [],
        permittedUsers: [],
        effectiveDate: null,
        expiryDate: null,
        evidenceRef: "synthetic://audit/evidence",
      },
    ],
    evidenceRefs: ["synthetic://audit/evidence"],
    decisionDocumentRef: "synthetic://audit/decision",
    decisionDocumentHash: "d".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: null,
  };
}

async function durable() {
  const database = new SqliteD1Database();
  database.applyMigrations();
  const registry = new D1CounselRegistry(database);
  await registry.registerProfessional(
    professional(),
    "synthetic-registrar",
    "setup",
  );
  await registry.recordDetermination(
    determination(),
    "synthetic-registrar",
    "record",
  );
  const sink = new D1AuthorizationAuditSink(database);
  let sequence = 0;
  const service = new AuthorizationAuditService(sink, {
    idFactory: () => {
      sequence += 1;
      return `aa_${sequence}`;
    },
    now: () => NOW,
  });
  return { database, registry, service };
}

describe("Gate 7 — durable centralized audit", () => {
  it("persists grant and denial events through the D1 sink", async () => {
    const { database, registry, service } = await durable();
    const authorization = new CounselAuthorizationService(registry, service, {
      runtimeMode: "PRODUCTION_D1",
    });
    const granted = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
      correlationId: "corr_grant",
    });
    expect(granted.allowed).toBe(true);
    expect(granted.auditRecorded).toBe(true);

    await registry.revoke("det_audit", "synthetic-registrar", "revoked", NOW);
    const denied = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    expect(denied.allowed).toBe(false);

    const events = await registry.listAuthorizationAudit(SOURCE);
    expect(events).toHaveLength(2);
    expect(events[0]?.eventType).toBe("AUTHORIZATION_GRANTED");
    expect(events[0]?.correlationId).toBe("corr_grant");
    expect(events[1]?.eventType).toBe("AUTHORIZATION_DENIED");
    expect(events[1]?.outcome).toBe("DENIED");
    expect(new Set(events.map((event) => event.id)).size).toBe(2);
    database.close();
  });

  it("denies when the audit write fails and reports it", async () => {
    const { database, registry } = await durable();
    const failing = new AuthorizationAuditService({
      kind: "async",
      async append() {
        throw new Error("audit store down");
      },
    });
    const authorization = new CounselAuthorizationService(registry, failing, {
      runtimeMode: "PRODUCTION_D1",
    });
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("authorization_audit_unavailable");
    expect(decision.auditRecorded).toBe(false);
    database.close();
  });

  it("denies when the registry is unavailable and records the failure", async () => {
    const sink = new InMemoryAuthorizationAuditSink();
    const service = new AuthorizationAuditService(sink, { now: () => NOW });
    const unavailable = {
      mode: "d1" as const,
      async loadState() {
        throw new Error("d1 down");
      },
    } as unknown as D1CounselRegistry;
    const authorization = new CounselAuthorizationService(
      unavailable,
      service,
      {
        runtimeMode: "PRODUCTION_D1",
      },
    );
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("registry_unavailable");
    expect(sink.list()[0]?.eventType).toBe("REGISTRY_UNAVAILABLE");
    expect(sink.list()[0]?.outcome).toBe("ERROR");
  });

  it("refuses an in-memory registry in production mode", () => {
    const repo = new CounselDeterminationRepository();
    const registry = new InMemoryCounselRegistry(repo);
    const service = new AuthorizationAuditService(
      new InMemoryAuthorizationAuditSink(),
    );
    expect(
      () =>
        new CounselAuthorizationService(registry, service, {
          runtimeMode: "PRODUCTION_D1",
        }),
    ).toThrow("production_requires_durable_registry");
    expect(
      () =>
        new CounselAuthorizationService(registry, service, {
          runtimeMode: "TEST_IN_MEMORY",
        }),
    ).not.toThrow();
  });

  it("refuses to drop an async sink from a synchronous content path", () => {
    const repo = new CounselDeterminationRepository();
    repo.registerCounsel(professional(), "synthetic-registrar", "setup");
    repo.record(determination(), "synthetic-registrar", "record");
    const async = new AuthorizationAuditService({
      kind: "async",
      async append() {
        throw new Error("should never be called");
      },
    });
    const check = authorizeTemporaryLocalStorage(
      repo,
      { sourceId: SOURCE, documentId: "doc_1" },
      {},
      { service: async },
    );
    expect(check()).toEqual({
      allowed: false,
      reason: "authorization_audit_unavailable",
    });
    expect(() =>
      async.record({
        eventType: "AUTHORIZATION_DENIED",
        outcome: "DENIED",
        sourceId: SOURCE,
        activity: "viewing",
        operation: "test",
        reasonCode: "test",
      }),
    ).toThrow(AuthorizationAuditUnavailableError);
  });

  it("rejects sensitive or oversized audit context", () => {
    const service = new AuthorizationAuditService(
      new InMemoryAuthorizationAuditSink(),
    );
    expect(() =>
      service.record({
        eventType: "AUTHORIZATION_DENIED",
        outcome: "DENIED",
        sourceId: SOURCE,
        activity: "viewing",
        operation: "test",
        reasonCode: "test",
        context: { content: "SECTION 1. Confidential text" },
      }),
    ).toThrow(/forbidden_audit_context/);
    expect(() =>
      service.record({
        eventType: "AUTHORIZATION_DENIED",
        outcome: "DENIED",
        sourceId: SOURCE,
        activity: "viewing",
        operation: "test",
        reasonCode: "test",
        context: { note: "x".repeat(600) },
      }),
    ).toThrow(/unsafe_audit_context/);
    expect(() =>
      service.record({
        eventType: "AUTHORIZATION_DENIED",
        outcome: "DENIED",
        sourceId: SOURCE,
        activity: "viewing",
        operation: "test",
        reasonCode: "test",
        context: { excerpt: "SECTION 2 something" },
      }),
    ).toThrow();
  });

  it("denies reindex/temp-storage authorization when no audit service is supplied", () => {
    const repo = new CounselDeterminationRepository();
    repo.registerCounsel(professional(), "synthetic-registrar", "setup");
    repo.record(determination(), "synthetic-registrar", "record");
    const temp = authorizeTemporaryLocalStorage(repo, {
      sourceId: SOURCE,
      documentId: "doc_1",
    });
    expect(temp()).toEqual({
      allowed: false,
      reason: "authorization_audit_unavailable",
    });
  });

  it("denies when a revocation lands between two authorizations", async () => {
    const { database, registry, service } = await durable();
    const authorization = new CounselAuthorizationService(registry, service, {
      runtimeMode: "PRODUCTION_D1",
    });
    const first = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    await registry.revoke(
      "det_audit",
      "synthetic-registrar",
      "mid-flight",
      NOW,
    );
    const second = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.registryRevision).not.toBe(first.registryRevision);
    database.close();
  });

  it("rejects counsel-opinion style context keys", () => {
    const service = new AuthorizationAuditService(
      new InMemoryAuthorizationAuditSink(),
    );
    for (const key of [
      "legalOpinion",
      "counselAdvice",
      "documentSummary",
      "privilegedNote",
    ]) {
      expect(
        () =>
          service.record({
            eventType: "AUTHORIZATION_DENIED",
            outcome: "DENIED",
            sourceId: SOURCE,
            activity: "viewing",
            operation: "test",
            reasonCode: "test",
            context: { [key]: "x" },
          }),
        key,
      ).toThrow(/forbidden_audit_context/);
    }
  });

  it("denies when evidence is required but unavailable", async () => {
    const { database, registry, service } = await durable();
    const authorization = new CounselAuthorizationService(registry, service, {
      runtimeMode: "PRODUCTION_D1",
      evidence: new UnavailableEvidenceStore(),
    });
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("evidence_unavailable");
    const events = await registry.listAuthorizationAudit(SOURCE);
    expect(events.at(-1)?.eventType).toBe("EVIDENCE_UNAVAILABLE");
    database.close();
  });
});
