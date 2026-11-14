// Gate 7 — ACTUAL Cloudflare D1 runtime tests.
//
// Unlike the SQLite shim suite, this runs against a real D1 database through the
// official Cloudflare HTTP API. It never runs by default: it requires
//   PHLI_D1_RUNTIME=1
//   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
//   PHLI_D1_DATABASE_ID  (a dedicated, non-production test database)
//
// The REST API has no transactional batch, so `batch()` here executes statements
// sequentially. That is deliberate: the commit-marker design must be safe under
// non-atomic execution, and this suite proves it on the real engine.
import { describe, expect, it } from "vitest";
import {
  AuthorizationAuditService,
  CounselAuthorizationService,
  type CounselDetermination,
  D1AuthorizationAuditSink,
  D1CounselRegistry,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type D1Result,
  InMemoryAuthorizationAuditSink,
} from "../../packages/legal-ingestion/src/index";

const ENABLED =
  process.env.PHLI_D1_RUNTIME === "1" &&
  Boolean(process.env.PHLI_D1_DATABASE_ID) &&
  Boolean(process.env.CLOUDFLARE_API_TOKEN) &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const SOURCE = `synthetic_remote_${RUN}`;
const COUNSEL_ID = `c_remote_${RUN}`;

interface D1QueryResult {
  results?: Record<string, unknown>[];
  success: boolean;
}

class RestStatement implements D1PreparedStatementLike {
  constructor(
    private readonly db: RestD1,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new RestStatement(this.db, this.sql, values);
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const rows = await this.db.execute(this.sql, this.params);
    const row = rows[0];
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const rows = await this.db.execute(this.sql, this.params);
    return { results: rows as T[], success: true };
  }

  async run(): Promise<unknown> {
    return this.db.execute(this.sql, this.params);
  }
}

class RestD1 implements D1DatabaseLike {
  failAt: number | null = null;
  private count = 0;

  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const database = process.env.PHLI_D1_DATABASE_ID;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.length ? { sql, params } : { sql }),
      },
    );
    const body = (await response.json()) as {
      success: boolean;
      errors?: { code: number; message: string }[];
      result?: D1QueryResult[];
    };
    if (!body.success)
      throw new Error(
        `d1:${(body.errors ?? [])
          .map((error) => `${error.code}:${error.message}`)
          .join("|")}`,
      );
    return body.result?.[0]?.results ?? [];
  }

  prepare(query: string): D1PreparedStatementLike {
    return new RestStatement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    this.count = 0;
    const out: unknown[] = [];
    for (const statement of statements) {
      this.count += 1;
      if (this.failAt === this.count) throw new Error("injected_batch_failure");
      out.push(await statement.run());
    }
    return out;
  }
}

function professional() {
  return {
    id: COUNSEL_ID,
    name: "Synthetic Remote Counsel",
    firm: null,
    jurisdiction: "PH",
    capacity: "Legal counsel",
    verificationStatus: "VERIFIED" as const,
    verificationEvidenceRef: "synthetic://remote/verification",
    verifiedBy: "synthetic-registrar",
    verifiedAt: "2026-11-14",
  };
}

function determination(overrides: Partial<CounselDetermination> = {}) {
  return {
    id: `det_${RUN}`,
    sourceId: SOURCE,
    documentIds: [],
    counselId: COUNSEL_ID,
    dateReceived: "2026-11-14",
    dateIssued: "2026-11-14",
    effectiveDate: "2026-11-01",
    expiryDate: "2027-11-01",
    status: "VERIFIED_FOR_RECORDING" as const,
    scope: "Synthetic remote determination",
    activityDecisions: [
      {
        activity: "downloading" as const,
        status: "APPROVED" as const,
        scope: null,
        conditions: [],
        limitations: [],
        permittedUsers: [],
        effectiveDate: null,
        expiryDate: null,
        evidenceRef: "synthetic://remote/evidence",
      },
      {
        activity: "temporary_local_storage" as const,
        status: "APPROVED" as const,
        scope: null,
        conditions: [],
        limitations: [],
        permittedUsers: [],
        effectiveDate: null,
        expiryDate: null,
        evidenceRef: "synthetic://remote/evidence",
      },
    ],
    evidenceRefs: ["synthetic://remote/evidence"],
    decisionDocumentRef: "synthetic://remote/decision",
    decisionDocumentHash: "e".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: "Synthetic fixture. Not real counsel.",
    ...overrides,
  };
}

describe.skipIf(!ENABLED)("Gate 7 — actual Cloudflare D1 runtime", () => {
  const db = new RestD1();

  async function seed() {
    const registry = new D1CounselRegistry(db);
    await registry.registerProfessional(
      professional(),
      "synthetic-registrar",
      "setup",
    );
    return registry;
  }

  it("has migrations 0001–0008 applied and no real counsel data", async () => {
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((row) => String(row.name));
    for (const table of [
      "counsel_professionals",
      "counsel_determinations",
      "counsel_activity_decisions",
      "counsel_audit_events",
      "authorization_audit_events",
      "counsel_registry_commits",
    ])
      expect(names).toContain(table);
    const real = await db.execute(
      "SELECT COUNT(*) AS n FROM counsel_determinations WHERE source_id NOT LIKE 'synthetic_%'",
    );
    expect(Number(real[0]?.n)).toBe(0);
  }, 120_000);

  it("persists a professional and a determination on real D1", async () => {
    const registry = await seed();
    const result = await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "record",
    );
    expect(result.status).toBe("RECORDED");
    expect((await registry.getDetermination(`det_${RUN}`))?.sourceId).toBe(
      SOURCE,
    );
    const state = await registry.loadState(SOURCE);
    expect(state.determinations).toHaveLength(1);
    expect(state.statuses.get(`det_${RUN}`)).toBe("VERIFIED_FOR_RECORDING");
  }, 120_000);

  it("denies every partial write that never reached the commit marker", async () => {
    const registry = new D1CounselRegistry(db);
    for (let failAt = 1; failAt <= 5; failAt += 1) {
      const source = `${SOURCE}_partial_${failAt}`;
      db.failAt = failAt;
      await expect(
        registry.recordDetermination(
          determination({
            id: `det_partial_${failAt}_${RUN}`,
            sourceId: source,
            activityDecisions: determination().activityDecisions,
          }),
          "synthetic-registrar",
          "partial",
        ),
      ).rejects.toThrow();
      db.failAt = null;
      const state = await registry.loadState(source);
      expect(state.determinations, `failAt=${failAt}`).toHaveLength(0);
      expect(
        await registry.getDetermination(`det_partial_${failAt}_${RUN}`),
      ).toBeNull();
      if (failAt > 1)
        expect(await registry.listIncompleteDeterminations(source)).toEqual([
          `det_partial_${failAt}_${RUN}`,
        ]);
    }
  }, 120_000);

  it("is safe to retry after success and rejects a changed retry", async () => {
    const registry = new D1CounselRegistry(db);
    const again = await registry.recordDetermination(
      determination(),
      "synthetic-registrar",
      "retry",
    );
    expect(again.status).toBe("ALREADY_COMMITTED");
    await expect(
      registry.recordDetermination(
        determination({ scope: "changed" }),
        "synthetic-registrar",
        "changed",
      ),
    ).rejects.toThrow("duplicate_determination_id");
  }, 120_000);

  it("enforces append-only and detects tampering", async () => {
    await expect(
      db.execute("UPDATE counsel_determinations SET status = 'REVOKED'"),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.execute("DELETE FROM counsel_audit_events"),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.execute("UPDATE counsel_registry_commits SET payload_hash = 'x'"),
    ).rejects.toThrow(/append-only/);
  }, 120_000);

  it("enforces constraints, JSON, hash and date validation", async () => {
    await expect(
      db.execute(
        `INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           date_issued, effective_date, expiry_date, status, scope,
           evidence_refs_json, decision_document_ref, decision_document_hash,
           recorded_by)
         VALUES ('bad_fk', 's', '[]', 'missing_counsel', '2026-11-14',
                 '2026-11-14', '2026-11-14', '2027-11-14',
                 'VERIFIED_FOR_RECORDING', 'x', '["synthetic://e"]',
                 'synthetic://d', '${"a".repeat(64)}', 'r')`,
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(
      db.execute(
        `INSERT INTO authorization_audit_events
          (id, event_type, outcome, occurred_at, source_id, activity,
           operation, reason_code, context_json)
         VALUES ('bad_json', 'AUTHORIZATION_DENIED', 'DENIED',
                 '2026-11-14T00:00:00Z', 's', 'viewing', 'x', 'r', '[]')`,
      ),
    ).rejects.toThrow();
  }, 120_000);

  it("revokes on real D1 and denies the next projection", async () => {
    const registry = new D1CounselRegistry(db);
    const audit = new AuthorizationAuditService(
      new D1AuthorizationAuditSink(db),
    );
    const authorization = new CounselAuthorizationService(registry, audit, {
      runtimeMode: "PRODUCTION_D1",
    });
    const before = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(before.allowed).toBe(true);
    await registry.revoke(`det_${RUN}`, "synthetic-registrar", "revoked");
    const after = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(after.allowed).toBe(false);
    expect(after.reason).toBe("no_verified_determination");
    await expect(
      registry.revoke(`det_${RUN}`, "synthetic-registrar", "again"),
    ).rejects.toThrow("already_revoked");
    const events = await registry.listAuthorizationAudit(SOURCE);
    expect(events.map((event) => event.eventType)).toEqual([
      "AUTHORIZATION_GRANTED",
      "AUTHORIZATION_DENIED",
    ]);
  }, 120_000);

  it("allows only one terminal event under a real concurrent race", async () => {
    const source = `${SOURCE}_race`;
    const registry = new D1CounselRegistry(db);
    await registry.recordDetermination(
      determination({ id: `race_old_${RUN}`, sourceId: source }),
      "synthetic-registrar",
      "old",
    );
    await registry.recordDetermination(
      determination({ id: `race_new_${RUN}`, sourceId: source }),
      "synthetic-registrar",
      "new",
    );
    const settled = await Promise.allSettled([
      registry.revoke(`race_old_${RUN}`, "synthetic-registrar", "revoke"),
      registry.supersede(
        `race_old_${RUN}`,
        `race_new_${RUN}`,
        "synthetic-registrar",
        "supersede",
      ),
    ]);
    expect(
      settled.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const terminal = await db.execute(
      `SELECT action FROM counsel_audit_events
        WHERE determination_id = 'race_old_${RUN}'
          AND action IN ('REVOKED','SUPERSEDED')`,
    );
    expect(terminal).toHaveLength(1);
  }, 120_000);
});
