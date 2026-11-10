import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "migrations/d1/0001_legal_documents.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION_PATH), "utf-8");

const REQUIRED_TABLES = [
  "legal_documents",
  "document_versions",
  "source_manifestations",
  "document_citations",
  "document_relationships",
  "legal_provisions",
  "extraction_jobs",
  "verification_records",
];

const REQUIRED_INDEXES = [
  "idx_legal_documents_document_type",
  "idx_legal_documents_source_id",
  "idx_legal_documents_promulgation_date",
  "idx_legal_documents_docket_number",
  "idx_legal_documents_verification_status",
  "idx_legal_documents_legal_status",
  "idx_document_versions_document_id",
  "idx_document_versions_effective_from",
  "idx_document_citations_source_document_id",
  "idx_document_citations_target_document_id",
];

describe("D1 legal documents migration", () => {
  it("reads the migration file", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it("enables foreign key enforcement", () => {
    expect(sql).toMatch(/PRAGMA\s+foreign_keys\s*=\s*ON/i);
  });

  describe("required tables", () => {
    for (const table of REQUIRED_TABLES) {
      it(`creates table ${table}`, () => {
        const re = new RegExp(
          `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${table}\\b`,
          "i",
        );
        expect(sql).toMatch(re);
      });
    }
  });

  describe("required indexes", () => {
    for (const index of REQUIRED_INDEXES) {
      it(`creates index ${index}`, () => {
        const re = new RegExp(
          `CREATE\\s+INDEX\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${index}\\b`,
          "i",
        );
        expect(sql).toMatch(re);
      });
    }
  });

  it("uses TEXT CHECK IN (...) constraints for enum columns", () => {
    expect(sql).toMatch(
      /document_type\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*document_type\s+IN\s*\(/i,
    );
    expect(sql).toMatch(
      /legal_status\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*legal_status\s+IN\s*\(/i,
    );
    expect(sql).toMatch(
      /verification_status\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*verification_status\s+IN\s*\(/i,
    );
  });

  it("declares the enum CHECK constraints with the full taxonomy", () => {
    expect(sql).toContain("'CONSTITUTION'");
    expect(sql).toContain("'BATAS_PAMBANSA'");
    expect(sql).toContain("'LEGAL_REFERENCE'");
    expect(sql).toContain("'PARTIALLY_AMENDED'");
    expect(sql).toContain("'NOT_YET_EFFECTIVE'");
    expect(sql).toContain("'DEFECTIVE_EXTRACTION'");
    expect(sql).toContain("'official_primary'");
    expect(sql).toContain("'Approved'");
  });

  it("links child tables to legal_documents via foreign keys", () => {
    expect(sql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*document_id\s*\)\s*REFERENCES\s+legal_documents\s*\(\s*id\s*\)/i,
    );
  });
});
