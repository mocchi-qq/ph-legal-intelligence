import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const MIGRATIONS = [
  "0001_legal_documents.sql",
  "0002_gate1_ingestion.sql",
  "0003_owner_authorization.sql",
  "0004_gate4_activity_authorization.sql",
  "0005_gate5_counsel_determinations.sql",
  "0006_gate6_counsel_validation.sql",
];

function migratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const migration of MIGRATIONS) {
    const sql = readFileSync(
      join(process.cwd(), "migrations/d1", migration),
      "utf8",
    );
    db.exec(sql);
  }
  return db;
}

function seedCounsel(db: DatabaseSync) {
  db.exec(`
    INSERT INTO counsel_professionals
      (id, name, jurisdiction, capacity, verification_status,
       verification_evidence_ref, verified_by, verified_at)
    VALUES
      ('c1', 'Synthetic Counsel', 'PH', 'Legal counsel', 'VERIFIED',
       'synthetic://counsel/verification', 'synthetic-registrar', '2026-11-13')
  `);
}

function seedDetermination(db: DatabaseSync) {
  seedCounsel(db);
  db.exec(`
    INSERT INTO counsel_determinations
      (id, source_id, document_scope_json, counsel_id, date_received,
       date_issued, effective_date, expiry_date, status, scope,
       evidence_refs_json, decision_document_ref, decision_document_hash,
       recorded_by)
    VALUES
      ('d1', 'synthetic_counsel_source', '[]', 'c1', '2026-11-13',
       '2026-11-13', '2026-11-13', '2027-11-13', 'VERIFIED_FOR_RECORDING',
       'Synthetic determination', '["synthetic://evidence"]',
       'synthetic://decision', '${"a".repeat(64)}', 'synthetic-registrar')
  `);
  db.exec(`
    INSERT INTO counsel_activity_decisions
      (id, determination_id, activity, status, conditions_json,
       limitations_json, permitted_users_json, evidence_ref)
    VALUES
      ('a1', 'd1', 'downloading', 'APPROVED', '[]', '[]', '[]',
       'synthetic://evidence')
  `);
}

describe("Gate 6 — SQLite-compatible migration validation", () => {
  it("applies migrations 0001–0005 in order", () => {
    const db = migratedDatabase();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const names = tables.map((table) => table.name);
    for (const required of [
      "counsel_professionals",
      "counsel_determinations",
      "counsel_activity_decisions",
      "counsel_audit_events",
      "source_activity_authorizations",
      "ingestion_runs",
    ])
      expect(names).toContain(required);
    db.close();
  });

  it("accepts a complete synthetic determination and activity row", () => {
    const db = migratedDatabase();
    seedDetermination(db);
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM counsel_activity_decisions")
      .get() as { count: number };
    expect(row.count).toBe(1);
    db.close();
  });

  it("rejects duplicate determination/activity combinations", () => {
    const db = migratedDatabase();
    seedDetermination(db);
    expect(() =>
      db.exec(`
        INSERT INTO counsel_activity_decisions
          (id, determination_id, activity, status)
        VALUES ('a2', 'd1', 'downloading', 'APPROVED')
      `),
    ).toThrow();
    db.close();
  });

  it("rejects unknown activity identifiers and invalid statuses", () => {
    const db = migratedDatabase();
    seedDetermination(db);
    expect(() =>
      db.exec(`
        INSERT INTO counsel_activity_decisions
          (id, determination_id, activity, status)
        VALUES ('a3', 'd1', 'invented_activity', 'APPROVED')
      `),
    ).toThrow();
    expect(() =>
      db.exec(`
        INSERT INTO counsel_activity_decisions
          (id, determination_id, activity, status)
        VALUES ('a4', 'd1', 'viewing', 'MAYBE')
      `),
    ).toThrow();
    db.close();
  });

  it("rejects a foreign key to a missing determination", () => {
    const db = migratedDatabase();
    seedCounsel(db);
    expect(() =>
      db.exec(`
        INSERT INTO counsel_activity_decisions
          (id, determination_id, activity, status)
        VALUES ('a5', 'missing', 'viewing', 'APPROVED')
      `),
    ).toThrow();
    db.close();
  });

  it("rejects VERIFIED counsel and VERIFIED_FOR_RECORDING without evidence", () => {
    const db = migratedDatabase();
    expect(() =>
      db.exec(`
        INSERT INTO counsel_professionals
          (id, name, jurisdiction, capacity, verification_status)
        VALUES ('bad', 'No Evidence', 'PH', 'Counsel', 'VERIFIED')
      `),
    ).toThrow();
    seedCounsel(db);
    expect(() =>
      db.exec(`
        INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           status, scope, evidence_refs_json, recorded_by)
        VALUES ('bad-det', 's', '[]', 'c1', '2026-11-13',
                'VERIFIED_FOR_RECORDING', 's', '[]', 'registrar')
      `),
    ).toThrow();
    db.close();
  });

  it("prevents updates and deletes of determination and audit history", () => {
    const db = migratedDatabase();
    seedDetermination(db);
    expect(() =>
      db.exec("UPDATE counsel_determinations SET scope = 'tampered'"),
    ).toThrow(/append-only/);
    expect(() =>
      db.exec("DELETE FROM counsel_determinations WHERE id = 'd1'"),
    ).toThrow(/append-only/);
    db.exec(`
      INSERT INTO counsel_audit_events
        (id, determination_id, action, actor, changed_at, reason)
      VALUES ('e1', 'd1', 'DETERMINATION_RECORDED', 'registrar',
              '2026-11-13T00:00:00Z', 'recorded')
    `);
    expect(() =>
      db.exec("UPDATE counsel_audit_events SET reason = 'tampered'"),
    ).toThrow(/append-only/);
    expect(() =>
      db.exec("DELETE FROM counsel_audit_events WHERE id = 'e1'"),
    ).toThrow(/append-only/);
    db.close();
  });

  it("supports transaction rollback for an incomplete determination", () => {
    const db = migratedDatabase();
    seedCounsel(db);
    db.exec("BEGIN");
    db.exec(`
      INSERT INTO counsel_determinations
        (id, source_id, document_scope_json, counsel_id, date_received,
         date_issued, status, scope, evidence_refs_json,
         decision_document_ref, recorded_by)
      VALUES ('tx', 's', '[]', 'c1', '2026-11-13', '2026-11-13',
              'VERIFIED_FOR_RECORDING', 's', '["e"]', 'd', 'registrar')
    `);
    db.exec("ROLLBACK");
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM counsel_determinations")
      .get() as { count: number };
    expect(row.count).toBe(0);
    db.close();
  });
  it("rejects malformed JSON, non-hex hashes and invalid dates", () => {
    const db = migratedDatabase();
    seedCounsel(db);
    expect(() =>
      db.exec(`
        INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           date_issued, status, scope, evidence_refs_json,
           decision_document_ref, decision_document_hash, recorded_by)
        VALUES ('bad-json', 's', 'not-json', 'c1', '2026-11-13',
                '2026-11-13', 'VERIFIED_FOR_RECORDING', 's', '[]',
                'd', NULL, 'registrar')
      `),
    ).toThrow();
    expect(() =>
      db.exec(`
        INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           date_issued, status, scope, evidence_refs_json,
           decision_document_ref, decision_document_hash, recorded_by)
        VALUES ('bad-hash', 's', '[]', 'c1', '2026-11-13',
                '2026-11-13', 'VERIFIED_FOR_RECORDING', 's', '["e"]',
                'd', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', 'registrar')
      `),
    ).toThrow();
    expect(() =>
      db.exec(`
        INSERT INTO counsel_determinations
          (id, source_id, document_scope_json, counsel_id, date_received,
           date_issued, status, scope, evidence_refs_json,
           decision_document_ref, recorded_by)
        VALUES ('bad-date', 's', '[]', 'c1', 'not-a-date',
                '2026-11-13', 'VERIFIED_FOR_RECORDING', 's', '["e"]',
                'd', 'registrar')
      `),
    ).toThrow();
    db.close();
  });
});
