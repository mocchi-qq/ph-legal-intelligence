// Gate 7 — migration sequence validation on a SQLite-compatible engine.
// Supplementary evidence only: this is NOT D1 runtime validation.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { GATE7_MIGRATIONS } from "../helpers/d1-sqlite";

const HASH = "a".repeat(64);

function migrate(extra: readonly string[] = []): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of [...GATE7_MIGRATIONS, ...extra]) {
    db.exec(
      readFileSync(join(process.cwd(), "migrations/d1", migration), "utf8"),
    );
  }
  return db;
}

function seedCounsel(db: DatabaseSync) {
  db.exec(`
    INSERT INTO counsel_professionals
      (id, name, jurisdiction, capacity, verification_status,
       verification_evidence_ref, verified_by, verified_at)
    VALUES ('c1', 'Synthetic Counsel', 'PH', 'Legal counsel', 'VERIFIED',
            'synthetic://verification', 'synthetic-registrar', '2026-11-14')
  `);
}

function insertDetermination(
  db: DatabaseSync,
  overrides: { status?: string; hash?: string; json?: string } = {},
) {
  db.prepare(
    `INSERT INTO counsel_determinations
      (id, source_id, document_scope_json, counsel_id, date_received,
       date_issued, effective_date, expiry_date, status, scope,
       evidence_refs_json, decision_document_ref, decision_document_hash,
       recorded_by)
     VALUES ('d1', 's', ?, 'c1', '2026-11-14', '2026-11-14', '2026-11-14',
             '2027-11-14', ?, 'scope', '["synthetic://e"]',
             'synthetic://decision', ?, 'synthetic-registrar')`,
  ).run(
    overrides.json ?? "[]",
    overrides.status ?? "VERIFIED_FOR_RECORDING",
    overrides.hash ?? HASH,
  );
}

function insertCommit(db: DatabaseSync, id = "d1") {
  db.prepare(
    `INSERT INTO counsel_registry_commits
      (determination_id, source_id, operation_id, payload_hash, committed_at)
     VALUES (?, 's', 'op_1', ?, '2026-11-14T00:00:00Z')`,
  ).run(id, HASH);
}

describe("Gate 7 — migrations 0001–0008 (SQLite-compatible only)", () => {
  it("applies the full sequence to a fresh database", () => {
    const db = migrate();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of [
      "counsel_professionals",
      "counsel_determinations",
      "counsel_activity_decisions",
      "counsel_audit_events",
      "authorization_audit_events",
      "counsel_registry_commits",
    ])
      expect(tables).toContain(table);
    db.close();
  });

  it("re-applies the additive Gate 7 migrations without error", () => {
    const db = migrate([
      "0007_gate7_authorization_audit.sql",
      "0008_gate7_registry_commit.sql",
    ]);
    expect(db).toBeDefined();
    db.close();
  });

  it("enforces foreign keys", () => {
    const db = migrate();
    expect(() => insertDetermination(db)).toThrow(/FOREIGN KEY/);
    seedCounsel(db);
    expect(() => insertDetermination(db)).not.toThrow();
    expect(() =>
      db
        .prepare(
          `INSERT INTO counsel_activity_decisions
            (id, determination_id, activity, status)
           VALUES ('a1', 'missing', 'downloading', 'APPROVED')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
    expect(() => insertCommit(db, "missing")).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it("enforces status, activity and uniqueness constraints", () => {
    const db = migrate();
    seedCounsel(db);
    expect(() => insertDetermination(db, { status: "MAYBE" })).toThrow();
    insertDetermination(db);
    expect(() => insertDetermination(db)).toThrow(/UNIQUE/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO counsel_activity_decisions
            (id, determination_id, activity, status)
           VALUES ('a1', 'd1', 'telepathy', 'APPROVED')`,
        )
        .run(),
    ).toThrow();
    db.prepare(
      `INSERT INTO counsel_activity_decisions
        (id, determination_id, activity, status, conditions_json,
         limitations_json, permitted_users_json)
       VALUES ('a1', 'd1', 'downloading', 'APPROVED', '[]', '[]', '[]')`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO counsel_activity_decisions
            (id, determination_id, activity, status, conditions_json,
             limitations_json, permitted_users_json)
           VALUES ('a2', 'd1', 'downloading', 'APPROVED', '[]', '[]', '[]')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
    db.close();
  });

  it("enforces JSON, hash and date validation from 0006 and 0007", () => {
    const db = migrate();
    seedCounsel(db);
    expect(() => insertDetermination(db, { json: "not-json" })).toThrow();
    expect(() => insertDetermination(db, { hash: "abc" })).toThrow();
    expect(() =>
      db
        .prepare(
          `INSERT INTO authorization_audit_events
            (id, event_type, outcome, occurred_at, source_id, activity,
             operation, reason_code, context_json)
           VALUES ('x', 'AUTHORIZATION_DENIED', 'DENIED', '2026-11-14T00:00:00Z',
                   's', 'viewing', 'test', 'r', '[]')`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it("keeps records append-only and rejects a second terminal event", () => {
    const db = migrate();
    seedCounsel(db);
    insertDetermination(db);
    insertCommit(db);
    expect(() =>
      db
        .prepare("UPDATE counsel_registry_commits SET payload_hash = ?")
        .run(HASH),
    ).toThrow(/append-only/);
    expect(() =>
      db.prepare("DELETE FROM counsel_registry_commits").run(),
    ).toThrow(/append-only/);
    db.prepare(
      `INSERT INTO counsel_audit_events
        (id, determination_id, counsel_id, action, actor, changed_at, reason)
       VALUES ('e1', 'd1', 'c1', 'REVOKED', 'a', '2026-11-14T00:00:00Z', 'r')`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO counsel_audit_events
            (id, determination_id, counsel_id, action, actor, changed_at, reason)
           VALUES ('e2', 'd1', 'c1', 'REVOKED', 'a', '2026-11-14T00:00:01Z', 'r')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
    // One terminal event total: a revocation and a supersession cannot coexist.
    expect(() =>
      db
        .prepare(
          `INSERT INTO counsel_audit_events
            (id, determination_id, counsel_id, action, actor, changed_at, reason)
           VALUES ('e3', 'd1', 'c1', 'SUPERSEDED', 'a', '2026-11-14T00:00:02Z', 'r')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
    db.prepare(
      `INSERT INTO counsel_audit_events
        (id, determination_id, counsel_id, action, actor, changed_at, reason)
       VALUES ('e4', 'd2', 'c1', 'SUPERSEDED', 'a', '2026-11-14T00:00:03Z', 'r')`,
    ).run();
    db.close();
  });

  it("records that the historical sequence is not re-runnable, without rewriting it", () => {
    // 0001 adds columns with ALTER TABLE, so a second full pass is rejected by
    // SQLite. Migrations 0001–0006 are immutable, so this limitation is recorded
    // rather than fixed by editing history. 0007 and 0008 are idempotent.
    const db = migrate();
    let failure = "";
    try {
      for (const migration of GATE7_MIGRATIONS)
        db.exec(
          readFileSync(join(process.cwd(), "migrations/d1", migration), "utf8"),
        );
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    expect(failure).toMatch(/duplicate column name|already exists/);
    db.close();
  });
});
