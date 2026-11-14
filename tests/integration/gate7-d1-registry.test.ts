// Gate 7 — D1 registry integration tests.
//
// IMPORTANT: these run against `node:sqlite` through a D1-shaped shim. They are
// supplementary SQL/constraint/rollback evidence, NOT Cloudflare D1 runtime
// validation. The D1 runtime is blocked on this host (see 01_D1_RUNTIME_FEASIBILITY).
import { describe, expect, it } from "vitest";
import {
  type AuthorizationAuditEvent,
  AuthorizationAuditService,
  CounselAuthorizationService,
  type CounselDetermination,
  CounselDeterminationRepository,
  D1CounselRegistry,
  InMemoryAuthorizationAuditSink,
  InMemoryCounselRegistry,
  projectFromState,
} from "../../packages/legal-ingestion/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const SOURCE = "synthetic_gate7_source";
const COUNSEL_ID = "c_gate7";

function professional() {
  return {
    id: COUNSEL_ID,
    name: "Synthetic Gate 7 Counsel",
    firm: "Synthetic Firm",
    jurisdiction: "PH",
    capacity: "Legal counsel",
    verificationStatus: "VERIFIED" as const,
    verificationEvidenceRef: "synthetic://gate7/verification",
    verifiedBy: "synthetic-registrar",
    verifiedAt: "2026-11-14",
  };
}

function determination(
  overrides: Partial<CounselDetermination> = {},
): CounselDetermination {
  return {
    id: "det_1",
    sourceId: SOURCE,
    documentIds: [],
    counselId: COUNSEL_ID,
    dateReceived: "2026-11-14",
    dateIssued: "2026-11-14",
    effectiveDate: "2026-11-14",
    expiryDate: "2027-11-14",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic Gate 7 determination",
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
        evidenceRef: "synthetic://gate7/evidence",
      },
      {
        activity: "temporary_local_storage",
        status: "APPROVED",
        scope: null,
        conditions: [],
        limitations: [],
        permittedUsers: [],
        effectiveDate: null,
        expiryDate: null,
        evidenceRef: "synthetic://gate7/evidence",
      },
    ],
    evidenceRefs: ["synthetic://gate7/evidence"],
    decisionDocumentRef: "synthetic://gate7/decision",
    decisionDocumentHash: "a".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: "Synthetic fixture. Not real counsel.",
    ...overrides,
  };
}

async function fresh(
  options: ConstructorParameters<typeof SqliteD1Database>[1] = {},
) {
  const database = new SqliteD1Database(":memory:", {
    ...options,
    failBatchAt: null,
  });
  database.applyMigrations();
  const registry = new D1CounselRegistry(database);
  await registry.registerProfessional(
    professional(),
    "synthetic-registrar",
    "setup",
    "2026-11-14T00:00:00Z",
  );
  database.options.failBatchAt = options.failBatchAt ?? null;
  return { database, registry };
}

describe("Gate 7 — D1 registry (SQLite shim, not live D1)", () => {
  it("persists and retrieves a counsel professional", async () => {
    const { database, registry } = await fresh();
    expect(await registry.getProfessional(COUNSEL_ID)).toEqual(professional());
    const audit = await registry.auditTrail();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("COUNSEL_REGISTERED");
    expect(audit[0]?.id).toMatch(/^counsel_audit_/);
    database.close();
  });

  it("records a determination with activities, audit and commit marker", async () => {
    const { database, registry } = await fresh();
    const result = await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    expect(result.status).toBe("RECORDED");
    const loaded = await registry.getDetermination("det_1");
    expect(loaded?.sourceId).toBe(SOURCE);
    expect(loaded?.activityDecisions).toHaveLength(2);
    expect(await registry.auditTrail("det_1")).toHaveLength(1);
    const state = await registry.loadState(SOURCE);
    expect(state.determinations).toHaveLength(1);
    expect(state.statuses.get("det_1")).toBe("VERIFIED_FOR_RECORDING");
    database.close();
  });

  it("rejects a duplicate determination id with a different payload", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "first",
    );
    await expect(
      registry.recordDetermination(
        determination({ scope: "Different scope" }),
        "synthetic-registrar",
        "second",
      ),
    ).rejects.toThrow("duplicate_determination_id");
    expect(await registry.auditTrail("det_1")).toHaveLength(1);
    database.close();
  });

  it("treats an identical resubmission as already committed", async () => {
    const { database, registry } = await fresh();
    const first = await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "first",
    );
    const second = await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "retry",
    );
    expect(first.status).toBe("RECORDED");
    expect(second.status).toBe("ALREADY_COMMITTED");
    expect(second.audit.id).toBe(first.audit.id);
    expect(await registry.auditTrail("det_1")).toHaveLength(1);
    database.close();
  });

  it("rejects a duplicate activity decision", async () => {
    const { database, registry } = await fresh();
    const det = determination();
    det.activityDecisions = [
      det.activityDecisions[0]!,
      det.activityDecisions[0]!,
    ];
    await expect(
      registry.recordDetermination(det, "synthetic-registrar", "dup"),
    ).rejects.toThrow();
    expect(await registry.getDetermination("det_1")).toBeNull();
    database.close();
  });

  it("rolls back every write when the batch fails at any stage", async () => {
    // 1 determination + 2 activities + 1 audit + 1 commit = 5 statements.
    for (let failAt = 1; failAt <= 5; failAt += 1) {
      const { database, registry } = await fresh({ failBatchAt: failAt });
      await expect(
        registry.recordDetermination(
          determination(),
          "synthetic-registrar",
          "fail",
        ),
      ).rejects.toThrow();
      database.options.failBatchAt = null;
      expect(
        await registry.getDetermination("det_1"),
        `failAt=${failAt}`,
      ).toBeNull();
      const state = await registry.loadState(SOURCE);
      expect(state.determinations, `failAt=${failAt}`).toHaveLength(0);
      const projection = projectFromState(state, SOURCE, "downloading");
      expect(projection.allowed, `failAt=${failAt}`).toBe(false);
      expect(await registry.listIncompleteDeterminations(SOURCE)).toHaveLength(
        0,
      );
      database.close();
    }
  });

  it("cannot project a partial determination when the batch is NOT atomic", async () => {
    // This is the real safety property: correct behaviour must not depend on an
    // unverified D1 batch-atomicity guarantee.
    for (let failAt = 1; failAt <= 5; failAt += 1) {
      const { database, registry } = await fresh({
        atomicBatch: false,
        failBatchAt: failAt,
      });
      await expect(
        registry.recordDetermination(
          determination(),
          "synthetic-registrar",
          "fail",
        ),
      ).rejects.toThrow();
      database.options.failBatchAt = null;
      const state = await registry.loadState(SOURCE);
      expect(state.determinations, `failAt=${failAt}`).toHaveLength(0);
      expect(
        projectFromState(state, SOURCE, "downloading").allowed,
        `failAt=${failAt}`,
      ).toBe(false);
      expect(
        await registry.listIncompleteDeterminations(SOURCE),
        `failAt=${failAt}`,
      ).toHaveLength(failAt === 1 ? 0 : 1);
      database.close();
    }
  });

  it("never projects rows written without a commit marker", async () => {
    const { database, registry } = await fresh();
    const det = determination();
    database.db
      .prepare(
        `INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           date_issued, effective_date, expiry_date, status, scope,
           evidence_refs_json, decision_document_ref, decision_document_hash,
           recorded_by)
         VALUES (?, ?, '[]', ?, '2026-11-14', '2026-11-14', '2026-11-14',
                 '2027-11-14', 'VERIFIED_FOR_RECORDING', 'unmarked',
                 '["synthetic://gate7/evidence"]', 'synthetic://gate7/decision',
                 ?, 'synthetic-registrar')`,
      )
      .run(det.id, SOURCE, COUNSEL_ID, "a".repeat(64));
    database.db
      .prepare(
        `INSERT INTO counsel_activity_decisions
          (id, determination_id, activity, status, conditions_json,
           limitations_json, permitted_users_json)
         VALUES ('act_x', 'det_1', 'downloading', 'APPROVED', '[]', '[]', '[]')`,
      )
      .run();
    expect(await registry.getDetermination("det_1")).toBeNull();
    expect((await registry.loadState(SOURCE)).determinations).toHaveLength(0);
    database.close();
  });

  it("refuses to project a commit whose payload was altered", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    // Append-only triggers block rewriting rows; simulate corruption directly at
    // the file level by dropping the guard in a separate connection.
    database.db.exec("DROP TRIGGER trg_counsel_activity_no_update");
    database.db
      .prepare(
        "UPDATE counsel_activity_decisions SET status = 'PROHIBITED' WHERE determination_id = 'det_1' AND activity = 'downloading'",
      )
      .run();
    expect((await registry.loadState(SOURCE)).determinations).toHaveLength(0);
    expect(await registry.getDetermination("det_1")).toBeNull();
    database.close();
  });

  it("revocation takes effect on the immediately following projection", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    const sink = new InMemoryAuthorizationAuditSink();
    const audit = new AuthorizationAuditService(sink, {
      idFactory: (() => {
        let n = 0;
        return () => {
          n += 1;
          return `aa_${n}`;
        };
      })(),
      now: () => "2026-11-14T12:00:00Z",
    });
    const service = new CounselAuthorizationService(registry, audit, {
      runtimeMode: "PRODUCTION_D1",
    });

    const before = await service.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(before.allowed).toBe(true);

    const revoke = await registry.revoke(
      "det_1",
      "synthetic-registrar",
      "revoked",
      "2026-11-14T12:00:01Z",
    );
    expect(revoke.action).toBe("REVOKED");

    const after = await service.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:02Z",
    });
    expect(after.allowed).toBe(false);
    expect(after.reason).toBe("no_verified_determination");
    expect(sink.list().at(-1)?.eventType).toBe("AUTHORIZATION_DENIED");
    database.close();
  });

  it("rejects a second revocation and a revocation after supersession", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    await registry.revoke(
      "det_1",
      "synthetic-registrar",
      "first",
      "2026-11-14T01:00:00Z",
    );
    await expect(
      registry.revoke("det_1", "synthetic-registrar", "second"),
    ).rejects.toThrow("already_revoked");
    database.close();
  });

  it("supersession denies the old determination and keeps the new one", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "old",
    );
    await registry.recordDetermination(
      determination({ id: "det_2", scope: "replacement" }),
      "synthetic-registrar",
      "new",
    );
    await registry.supersede(
      "det_1",
      "det_2",
      "synthetic-registrar",
      "superseded",
      "2026-11-14T02:00:00Z",
    );
    const state = await registry.loadState(SOURCE);
    expect(state.statuses.get("det_1")).toBe("SUPERSEDED");
    const projection = projectFromState(state, SOURCE, "downloading");
    expect(projection.allowed).toBe(true);
    expect(projection.determinationId).toBe("det_2");
    await expect(
      registry.supersede("det_1", "det_2", "synthetic-registrar", "again"),
    ).rejects.toThrow("already_superseded");
    await expect(
      registry.revoke("det_1", "synthetic-registrar", "revoke old"),
    ).rejects.toThrow("already_superseded");
    database.close();
  });

  it("retires the superseded determination in the same atomic write", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "old",
    );
    await registry.recordDetermination(
      determination({
        id: "det_2",
        scope: "replacement",
        supersedesId: "det_1",
      }),
      "synthetic-registrar",
      "replacement",
    );
    const state = await registry.loadState(SOURCE);
    expect(state.statuses.get("det_1")).toBe("SUPERSEDED");
    expect(projectFromState(state, SOURCE, "downloading").determinationId).toBe(
      "det_2",
    );
    const events = await registry.auditTrail("det_1");
    expect(events.at(-1)?.action).toBe("SUPERSEDED");
    database.close();
  });

  it("rejects superseding a revoked or unknown determination at record time", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "old",
    );
    await expect(
      registry.recordDetermination(
        determination({ id: "det_x", supersedesId: "missing" }),
        "synthetic-registrar",
        "bad",
      ),
    ).rejects.toThrow("superseded_determination_not_found");
    await registry.revoke("det_1", "synthetic-registrar", "revoked");
    await expect(
      registry.recordDetermination(
        determination({ id: "det_y", supersedesId: "det_1" }),
        "synthetic-registrar",
        "bad",
      ),
    ).rejects.toThrow("cannot_supersede_revoked");
    database.close();
  });

  it("denies when two active determinations cover the same activity", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "first",
    );
    await registry.recordDetermination(
      determination({ id: "det_2", scope: "second" }),
      "synthetic-registrar",
      "second",
    );
    const state = await registry.loadState(SOURCE);
    expect(projectFromState(state, SOURCE, "downloading").reason).toBe(
      "conflicting_determinations",
    );
    database.close();
  });

  it("scopes document-level determinations correctly", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination({
        id: "det_1",
        documentIds: ["doc_a"],
        activityDecisions: [determination().activityDecisions[0]!],
      }),
      "synthetic-registrar",
      "record",
    );
    expect(await registry.listByDocument(SOURCE, "doc_a")).toHaveLength(1);
    expect(await registry.listByDocument(SOURCE, "doc_b")).toHaveLength(0);
    const sink = new InMemoryAuthorizationAuditSink();
    const service = new CounselAuthorizationService(
      registry,
      new AuthorizationAuditService(sink),
      { runtimeMode: "PRODUCTION_D1" },
    );
    expect(
      (
        await service.authorize({
          sourceId: SOURCE,
          activity: "downloading",
          operation: "ingest",
          documentId: "doc_b",
        })
      ).allowed,
    ).toBe(false);
    expect(
      (
        await service.authorize({
          sourceId: SOURCE,
          activity: "downloading",
          operation: "ingest",
          documentId: "doc_a",
        })
      ).allowed,
    ).toBe(true);
    database.close();
  });

  it("persists authorization audit append-only", async () => {
    const { database, registry } = await fresh();
    const event: AuthorizationAuditEvent = {
      id: "aa_persist",
      eventType: "AUTHORIZATION_DENIED",
      outcome: "DENIED",
      occurredAt: "2026-11-14T00:00:00Z",
      sourceId: SOURCE,
      documentId: "doc_1",
      activity: "temporary_local_storage",
      operation: "temporary_local_storage",
      reasonCode: "no_verified_determination",
      determinationId: null,
      correlationId: "corr_1",
      registryStatus: "UNKNOWN",
      context: { stage: "pre_write" },
    };
    await registry.appendAuthorizationAudit(event);
    expect(await registry.listAuthorizationAudit(SOURCE)).toEqual([event]);
    expect(() =>
      database.db
        .prepare("UPDATE authorization_audit_events SET outcome = 'GRANTED'")
        .run(),
    ).toThrow(/append-only/);
    expect(() =>
      database.db.prepare("DELETE FROM authorization_audit_events").run(),
    ).toThrow(/append-only/);
    await expect(
      registry.appendAuthorizationAudit({ ...event, id: "aa_persist" }),
    ).rejects.toThrow();
    expect(() =>
      database.db
        .prepare(
          `INSERT INTO authorization_audit_events
            (id, event_type, outcome, occurred_at, source_id, activity,
             operation, reason_code, context_json)
           VALUES ('bad', 'NOT_A_TYPE', 'DENIED', '2026-11-14T00:00:00Z',
                   's', 'viewing', 'test', 'r', '{}')`,
        )
        .run(),
    ).toThrow();
    expect(() =>
      database.db
        .prepare(
          `INSERT INTO authorization_audit_events
            (id, event_type, outcome, occurred_at, source_id, activity,
             operation, reason_code, context_json)
           VALUES ('bad2', 'AUTHORIZATION_DENIED', 'DENIED', 'not-a-date',
                   's', 'viewing', 'test', 'r', '{}')`,
        )
        .run(),
    ).toThrow();
    database.close();
  });

  it("keeps append-only history for counsel records", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    expect(() =>
      database.db
        .prepare("UPDATE counsel_determinations SET status = 'REVOKED'")
        .run(),
    ).toThrow(/append-only/);
    expect(() =>
      database.db.prepare("DELETE FROM counsel_audit_events").run(),
    ).toThrow(/append-only/);
    expect(() =>
      database.db
        .prepare("UPDATE counsel_registry_commits SET payload_hash = 'x'")
        .run(),
    ).toThrow(/append-only/);
    database.close();
  });

  it("allows exactly one terminal event under a concurrent revoke/supersede race", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "old",
    );
    await registry.recordDetermination(
      determination({ id: "det_2", scope: "replacement" }),
      "synthetic-registrar",
      "new",
    );
    const settled = await Promise.allSettled([
      registry.revoke("det_1", "synthetic-registrar", "revoke"),
      registry.supersede("det_1", "det_2", "synthetic-registrar", "supersede"),
    ]);
    expect(
      settled.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const terminal = database.db
      .prepare(
        "SELECT action FROM counsel_audit_events WHERE determination_id = 'det_1' AND action IN ('REVOKED','SUPERSEDED')",
      )
      .all();
    expect(terminal).toHaveLength(1);
    database.close();
  });

  it("bounds an unfiltered audit trail read", async () => {
    const { database, registry } = await fresh();
    await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    await registry.revoke("det_1", "synthetic-registrar", "revoke");
    expect((await registry.auditTrail()).length).toBeGreaterThanOrEqual(2);
    expect(await registry.auditTrail(undefined, 1)).toHaveLength(1);
    database.close();
  });

  it("keeps an in-memory registry distinguishable from the durable adapter", async () => {
    const repo = new CounselDeterminationRepository();
    const memory = new InMemoryCounselRegistry(repo);
    expect(memory.mode).toBe("in-memory");
    const { database, registry } = await fresh();
    expect(registry.mode).toBe("d1");
    database.close();
  });
});
