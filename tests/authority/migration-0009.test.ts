// Gate 8 — migration 0009 (authority core) on a SQLite-compatible engine.
// Supplementary evidence only: this is NOT D1 runtime validation.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const GATE8_MIGRATIONS = [
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

function migrate(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of GATE8_MIGRATIONS) {
    db.exec(
      readFileSync(join(process.cwd(), "migrations/d1", migration), "utf8"),
    );
  }
  return db;
}

function seedDocuments(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('SYNTH-DOC-A', 'STATUTE', 'Synthetic Document A', 'IN_FORCE',
       'VERIFIED', 'official_primary'),
      ('SYNTH-DOC-B', 'STATUTE', 'Synthetic Document B', 'IN_FORCE',
       'VERIFIED', 'official_primary')
  `);
}

interface AssertionOverrides {
  id?: string;
  effectType?: string;
  sourceDocumentId?: string;
  targetDocumentId?: string;
  scope?: string;
  evidenceId?: string;
  claimedDate?: string | null;
  assertedAt?: string;
  state?: string;
}

function insertAssertion(
  db: DatabaseSync,
  overrides: AssertionOverrides = {},
): void {
  db.prepare(
    `INSERT INTO legal_effect_assertions
      (id, effect_type, source_document_id, source_version_id,
       source_provision_id, target_document_id, target_provision_identity_id,
       target_version_id, scope, claimed_date, claimed_effective_date,
       evidence_id, source_locator, assertion_origin, recorded_at, recorded_by,
       state, supersedes_assertion_id, conflict_group_id)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, NULL, ?, NULL,
             'synthetic-seed', ?, 'synthetic-registrar', ?, NULL, NULL)`,
  ).run(
    overrides.id ?? "synth-assert-0001",
    overrides.effectType ?? "AMENDMENT",
    overrides.sourceDocumentId ?? "SYNTH-DOC-A",
    overrides.targetDocumentId ?? "SYNTH-DOC-B",
    overrides.scope ?? "section 1",
    overrides.claimedDate === undefined ? "2026-11-14" : overrides.claimedDate,
    overrides.evidenceId ?? "synth-evidence-0001",
    overrides.assertedAt ?? "2026-11-14T00:00:00Z",
    overrides.state ?? "UNREVIEWED",
  );
}

function insertReview(
  db: DatabaseSync,
  overrides: {
    id?: string;
    assertionId?: string;
    outcome?: string;
    conditionsJson?: string;
  } = {},
): void {
  db.prepare(
    `INSERT INTO legal_effect_reviews
      (id, assertion_id, outcome, reviewer_id, reviewer_capacity, decision_date,
       scope, proposition_reviewed, conditions_json, evidence_refs_json,
       notes, supersedes_review_id, status, recorded_at)
     VALUES (?, ?, ?, 'synthetic-reviewer', 'reviewing counsel', '2026-11-14',
             'section 1', 'Synthetic proposition', ?, '[]', NULL, NULL,
             'ACTIVE', '2026-11-14T00:00:00Z')`,
  ).run(
    overrides.id ?? "synth-review-0001",
    overrides.assertionId ?? "synth-assert-0001",
    overrides.outcome ?? "CONFIRMED",
    overrides.conditionsJson ?? "[]",
  );
}

function insertEvidence(
  db: DatabaseSync,
  overrides: {
    id?: string;
    assertionId?: string;
    contentHash?: string;
  } = {},
): void {
  db.prepare(
    `INSERT INTO legal_effect_evidence
      (id, assertion_id, document_version_id, provision_version_id,
       artifact_id, content_hash, passage, locator, evidence_date,
       classification, availability, checked_at)
     VALUES (?, ?, NULL, NULL, NULL, ?, 'synthetic passage', 'section 1',
             '2026-11-14', 'OFFICIAL_PRIMARY', 'AVAILABLE',
             '2026-11-14T00:00:00Z')`,
  ).run(
    overrides.id ?? "synth-evidence-0001",
    overrides.assertionId ?? "synth-assert-0001",
    overrides.contentHash ?? "b".repeat(64),
  );
}

describe("Gate 8 — migration 0009 (SQLite compatibility)", () => {
  it("applies 0001-0009 and creates the authority tables", () => {
    const db = migrate();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of AUTHORITY_TABLES) expect(tables).toContain(table);
    db.close();
  });

  it("creates append-only triggers for every authority table", () => {
    const db = migrate();
    const triggers = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%'",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    expect(triggers.length).toBeGreaterThanOrEqual(14);
    for (const table of AUTHORITY_TABLES) {
      expect(triggers).toContain(`trg_${table}_no_update`);
      expect(triggers).toContain(`trg_${table}_no_delete`);
    }
    db.close();
  });

  it("rejects UPDATE on legal_effect_assertions as append-only", () => {
    const db = migrate();
    seedDocuments(db);
    insertAssertion(db);
    expect(() =>
      db
        .prepare("UPDATE legal_effect_assertions SET state = ? WHERE id = ?")
        .run("CONFLICTED", "synth-assert-0001"),
    ).toThrow(/append-only/);
    db.close();
  });

  it("rejects DELETE on legal_effect_assertions as append-only", () => {
    const db = migrate();
    seedDocuments(db);
    insertAssertion(db);
    expect(() =>
      db.prepare("DELETE FROM legal_effect_assertions").run(),
    ).toThrow(/append-only/);
    db.close();
  });

  it("enforces foreign keys on target_document_id", () => {
    const db = migrate();
    seedDocuments(db);
    expect(() => insertAssertion(db, { targetDocumentId: "MISSING" })).toThrow(
      /FOREIGN KEY/,
    );
    expect(() => insertAssertion(db)).not.toThrow();
    db.close();
  });

  it("enforces the effect_type CHECK constraint", () => {
    const db = migrate();
    seedDocuments(db);
    expect(() => insertAssertion(db, { effectType: "NOT_A_TYPE" })).toThrow(
      /CHECK/,
    );
    db.close();
  });

  it("requires conditions when a review confirms with conditions", () => {
    const db = migrate();
    seedDocuments(db);
    insertAssertion(db);
    expect(() =>
      insertReview(db, {
        outcome: "CONFIRMED_WITH_CONDITIONS",
        conditionsJson: "[]",
      }),
    ).toThrow(/CHECK/);
    expect(() => insertReview(db)).not.toThrow();
    db.close();
  });

  it("rejects an evidence content_hash that is not 64 hex characters", () => {
    const db = migrate();
    seedDocuments(db);
    insertAssertion(db);
    expect(() => insertEvidence(db, { contentHash: "abc" })).toThrow(/CHECK/);
    expect(() =>
      insertEvidence(db, { id: "synth-evidence-0002" }),
    ).not.toThrow();
    db.close();
  });

  it("seeds a valid assertion through the shared helper", () => {
    const db = migrate();
    seedDocuments(db);
    insertAssertion(db, { id: "synth-assert-0002", scope: "section 2" });
    const rows = db
      .prepare(
        "SELECT id, effect_type, target_document_id, evidence_id, state FROM legal_effect_assertions",
      )
      .all() as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      {
        id: "synth-assert-0002",
        effect_type: "AMENDMENT",
        target_document_id: "SYNTH-DOC-B",
        evidence_id: "synth-evidence-0001",
        state: "UNREVIEWED",
      },
    ]);
    db.close();
  });
});
