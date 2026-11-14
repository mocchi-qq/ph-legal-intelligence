// Gate 8 — migration 0009 hardening: no-replace triggers, evidence index and
// strict date/datetime CHECKs. SQLite-compatible engine only; this is NOT D1
// runtime validation.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = [
  "0001_legal_documents.sql",
  "0002_gate1_ingestion.sql",
  "0003_owner_authorization.sql",
  "0004_gate4_activity_authorization.sql",
  "0005_gate5_counsel_determinations.sql",
  "0006_gate6_counsel_validation.sql",
  "0007_gate7_authorization_audit.sql",
  "0008_gate7_registry_commit.sql",
  "0009_authority_core.sql",
] as const;

const AUTHORITY_TABLES = [
  "provision_identities",
  "citation_aliases",
  "legal_effect_assertions",
  "legal_effect_evidence",
  "legal_effect_reviews",
  "provision_version_mappings",
  "citation_resolution_events",
] as const;

type AuthorityTable = (typeof AUTHORITY_TABLES)[number];

function migrate(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of MIGRATIONS) {
    db.exec(
      readFileSync(join(process.cwd(), "migrations/d1", migration), "utf8"),
    );
  }
  return db;
}

// Fixed rows that other authority tables reference through foreign keys.
function seedBase(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('SYNTH-DOC-A', 'STATUTE', 'Synthetic Document A', 'IN_FORCE',
       'VERIFIED', 'official_primary'),
      ('SYNTH-DOC-B', 'STATUTE', 'Synthetic Document B', 'IN_FORCE',
       'VERIFIED', 'official_primary');

    INSERT INTO document_versions
      (id, document_id, version_number, content_hash, is_current)
    VALUES
      ('SYNTH-DOC-A-v1', 'SYNTH-DOC-A', 1, 'synthetic-hash-a', 1);

    INSERT INTO legal_provisions
      (id, document_id, version_id, provision_type, label, text, ordinal)
    VALUES
      ('SYNTH-PROV-V1', 'SYNTH-DOC-A', 'SYNTH-DOC-A-v1', 'SECTION',
       'Section 1', 'Synthetic provision text.', 1);

    INSERT INTO provision_identities
      (id, document_id, provision_type, canonical_label, created_at)
    VALUES
      ('SYNTH-PID-1', 'SYNTH-DOC-A', 'SECTION', 'Section 1',
       '2026-11-14T00:00:00Z');

    INSERT INTO legal_effect_assertions
      (id, effect_type, source_document_id, target_document_id, scope,
       claimed_date, evidence_id, assertion_origin, recorded_at, recorded_by,
       state)
    VALUES
      ('SYNTH-ASSERT-1', 'AMENDMENT', 'SYNTH-DOC-A', 'SYNTH-DOC-B',
       'section 1', '2026-11-14', 'synthetic-evidence', 'synthetic-seed',
       '2026-11-14T00:00:00Z', 'synthetic-registrar', 'UNREVIEWED');
  `);
}

interface RowWriter {
  columns: readonly string[];
  values: (id: string) => unknown[];
}

// One valid row per table. Provoke no UNIQUE collision with seedBase.
const ROWS: Record<AuthorityTable, RowWriter> = {
  provision_identities: {
    columns: [
      "id",
      "document_id",
      "provision_type",
      "canonical_label",
      "created_at",
    ],
    values: (id) => [
      id,
      "SYNTH-DOC-B",
      "SECTION",
      "Section 9",
      "2026-11-14T00:00:00Z",
    ],
  },
  citation_aliases: {
    columns: [
      "id",
      "document_id",
      "alias_text",
      "normalized_alias",
      "alias_type",
      "created_at",
    ],
    values: (id) => [
      id,
      "SYNTH-DOC-B",
      "Synthetic Alias",
      "synthetic alias",
      "ABBREVIATION",
      "2026-11-14T00:00:00Z",
    ],
  },
  legal_effect_assertions: {
    columns: [
      "id",
      "effect_type",
      "source_document_id",
      "target_document_id",
      "scope",
      "claimed_date",
      "evidence_id",
      "assertion_origin",
      "recorded_at",
      "recorded_by",
      "state",
    ],
    values: (id) => [
      id,
      "AMENDMENT",
      "SYNTH-DOC-A",
      "SYNTH-DOC-B",
      "section 2",
      "2026-11-14",
      "synthetic-evidence",
      "synthetic-seed",
      "2026-11-14T00:00:00Z",
      "synthetic-registrar",
      "UNREVIEWED",
    ],
  },
  legal_effect_evidence: {
    columns: [
      "id",
      "assertion_id",
      "content_hash",
      "passage",
      "evidence_date",
      "classification",
      "availability",
      "checked_at",
    ],
    values: (id) => [
      id,
      "SYNTH-ASSERT-1",
      "b".repeat(64),
      "synthetic passage",
      "2026-11-14",
      "OFFICIAL_PRIMARY",
      "AVAILABLE",
      "2026-11-14T00:00:00Z",
    ],
  },
  legal_effect_reviews: {
    columns: [
      "id",
      "assertion_id",
      "outcome",
      "reviewer_id",
      "reviewer_capacity",
      "decision_date",
      "scope",
      "proposition_reviewed",
      "status",
      "recorded_at",
    ],
    values: (id) => [
      id,
      "SYNTH-ASSERT-1",
      "CONFIRMED",
      "synthetic-reviewer",
      "reviewing counsel",
      "2026-11-14",
      "section 1",
      "Synthetic proposition",
      "ACTIVE",
      "2026-11-14T00:00:00Z",
    ],
  },
  provision_version_mappings: {
    columns: [
      "id",
      "provision_identity_id",
      "provision_version_id",
      "document_version_id",
      "mapping_type",
      "rationale",
      "review_status",
      "created_at",
    ],
    values: (id) => [
      id,
      "SYNTH-PID-1",
      "SYNTH-PROV-V1",
      "SYNTH-DOC-A-v1",
      "SAME",
      "Synthetic continuity.",
      "REVIEWED",
      "2026-11-14T00:00:00Z",
    ],
  },
  citation_resolution_events: {
    columns: ["id", "original_text", "normalized_text", "status", "created_at"],
    values: (id) => [
      id,
      "Synthetic Citation",
      "synthetic citation",
      "EXACT",
      "2026-11-14T00:00:00Z",
    ],
  },
};

function writeRow(
  db: DatabaseSync,
  table: AuthorityTable,
  verb: string,
  id: string,
): void {
  const { columns, values } = ROWS[table];
  const placeholders = columns.map(() => "?").join(", ");
  db.prepare(
    `${verb} INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
  ).run(...values(id));
}

function insertAssertion(
  db: DatabaseSync,
  id: string,
  claimedDate: string | null,
): void {
  db.prepare(
    `INSERT INTO legal_effect_assertions
      (id, effect_type, source_document_id, target_document_id, scope,
       claimed_date, evidence_id, assertion_origin, recorded_at, recorded_by,
       state)
     VALUES (?, 'AMENDMENT', 'SYNTH-DOC-A', 'SYNTH-DOC-B', 'section 1', ?,
             'synthetic-evidence', 'synthetic-seed', '2026-11-14T00:00:00Z',
             'synthetic-registrar', 'UNREVIEWED')`,
  ).run(id, claimedDate);
}

describe("Gate 8 — migration 0009 hardening", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = migrate();
    seedBase(db);
  });

  it("creates no_update, no_delete and no_replace triggers for all 7 tables", () => {
    const triggers = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%'",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of AUTHORITY_TABLES) {
      expect(triggers).toContain(`trg_${table}_no_update`);
      expect(triggers).toContain(`trg_${table}_no_delete`);
      expect(triggers).toContain(`trg_${table}_no_replace`);
    }
    expect(triggers.length).toBeGreaterThanOrEqual(21);
    db.close();
  });

  // Minimum required: INSERT OR REPLACE on assertions, reviews, provision
  // identities and aliases; covered here for every table.
  for (const table of AUTHORITY_TABLES) {
    it(`rejects INSERT OR REPLACE on ${table} as append-only`, () => {
      const id = `replace-${table}`;
      writeRow(db, table, "INSERT", id);
      expect(() => writeRow(db, table, "INSERT OR REPLACE", id)).toThrow(
        /append-only/,
      );
      const rows = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).all(id);
      expect(rows).toHaveLength(1);
      db.close();
    });
  }

  it("rejects bare REPLACE on legal_effect_assertions", () => {
    expect(() =>
      writeRow(db, "legal_effect_assertions", "REPLACE", "SYNTH-ASSERT-1"),
    ).toThrow(/append-only/);
    db.close();
  });

  it("still accepts a normal insert with a fresh id", () => {
    for (const table of AUTHORITY_TABLES) {
      expect(() =>
        writeRow(db, table, "INSERT", `fresh-${table}`),
      ).not.toThrow();
    }
    db.close();
  });

  it("rejects UPDATE on legal_effect_assertions and legal_effect_reviews", () => {
    expect(() =>
      db
        .prepare("UPDATE legal_effect_assertions SET state = ? WHERE id = ?")
        .run("CONFLICTED", "SYNTH-ASSERT-1"),
    ).toThrow(/append-only/);

    writeRow(db, "legal_effect_reviews", "INSERT", "review-1");
    expect(() =>
      db
        .prepare("UPDATE legal_effect_reviews SET status = ? WHERE id = ?")
        .run("REVOKED", "review-1"),
    ).toThrow(/append-only/);
    db.close();
  });

  it("rejects DELETE on provision_identities and citation_aliases", () => {
    expect(() =>
      db
        .prepare("DELETE FROM provision_identities WHERE id = ?")
        .run("SYNTH-PID-1"),
    ).toThrow(/append-only/);

    writeRow(db, "citation_aliases", "INSERT", "alias-1");
    expect(() =>
      db.prepare("DELETE FROM citation_aliases WHERE id = ?").run("alias-1"),
    ).toThrow(/append-only/);
    db.close();
  });

  it("rejects malformed claimed_date values", () => {
    expect(() => insertAssertion(db, "bad-1", "2026-02-30")).toThrow(/CHECK/);
    expect(() => insertAssertion(db, "bad-2", "2026-11-14T10:00:00Z")).toThrow(
      /CHECK/,
    );
    expect(() => insertAssertion(db, "bad-3", "2026-13-01")).toThrow(/CHECK/);
    db.close();
  });

  it("accepts a well-formed claimed_date and a NULL claimed_date", () => {
    expect(() => insertAssertion(db, "good-1", "2026-11-14")).not.toThrow();
    expect(() => insertAssertion(db, "good-2", null)).not.toThrow();
    db.close();
  });

  it("rejects malformed decision_date and evidence_date values", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO legal_effect_reviews
            (id, assertion_id, outcome, reviewer_id, reviewer_capacity,
             decision_date, scope, proposition_reviewed, status, recorded_at)
           VALUES ('bad-review-1', 'SYNTH-ASSERT-1', 'CONFIRMED',
                   'synthetic-reviewer', 'reviewing counsel', '2026-02-30',
                   'section 1', 'Synthetic proposition', 'ACTIVE',
                   '2026-11-14T00:00:00Z')`,
        )
        .run(),
    ).toThrow(/CHECK/);

    expect(() =>
      db
        .prepare(
          `INSERT INTO legal_effect_evidence
            (id, assertion_id, evidence_date, classification, availability)
           VALUES ('bad-evidence-1', 'SYNTH-ASSERT-1', '2026-11-14T10:00:00Z',
                   'OFFICIAL_PRIMARY', 'AVAILABLE')`,
        )
        .run(),
    ).toThrow(/CHECK/);
    db.close();
  });

  it("rejects datetime columns that do not use the T-separated form", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO citation_aliases
            (id, document_id, alias_text, normalized_alias, alias_type,
             created_at)
           VALUES ('bad-alias-1', 'SYNTH-DOC-B', 'Alias', 'alias',
                   'ABBREVIATION', '2026-11-14 10:00:00')`,
        )
        .run(),
    ).toThrow(/CHECK/);

    expect(() =>
      db
        .prepare(
          `INSERT INTO citation_aliases
            (id, document_id, alias_text, normalized_alias, alias_type,
             created_at)
           VALUES ('bad-alias-2', 'SYNTH-DOC-B', 'Alias', 'alias',
                   'ABBREVIATION', 'not-a-timestamp')`,
        )
        .run(),
    ).toThrow(/CHECK/);
    db.close();
  });

  it("creates the legal_effect_assertions evidence_id index", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(indexes).toContain("idx_effect_assertions_evidence");

    const columns = db
      .prepare("PRAGMA index_info('idx_effect_assertions_evidence')")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toEqual(["evidence_id"]);
    db.close();
  });

  it("leaves foreign key enforcement on after the migrations", () => {
    const result = db.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    expect(result.foreign_keys).toBe(1);
    expect(() =>
      db
        .prepare(
          `INSERT INTO provision_identities
            (id, document_id, provision_type, canonical_label, created_at)
           VALUES ('fk-bad', 'MISSING-DOC', 'SECTION', 'Section 3',
                   '2026-11-14T00:00:00Z')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
    db.close();
  });
});
