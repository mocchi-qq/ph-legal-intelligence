import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "migrations/d1/0005_gate5_counsel_determinations.sql"),
  "utf8",
);

const ACTIVITIES = [
  "viewing",
  "downloading",
  "temporary_processing",
  "temporary_local_storage",
  "persistent_storage",
  "text_extraction",
  "ocr",
  "search_indexing",
  "embedding_generation",
  "ai_assisted_analysis",
  "citation_display",
  "quotation",
  "substantial_reproduction",
  "redistribution",
  "commercial_use",
  "retention",
];

describe("Gate 5 counsel determination migration", () => {
  it("is additive and preserves prior migrations", () => {
    expect(sql).toMatch(/Additive only/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/UPDATE\s+counsel_/i);
  });

  it("creates the professional, determination, activity and audit tables", () => {
    for (const table of [
      "counsel_professionals",
      "counsel_determinations",
      "counsel_activity_decisions",
      "counsel_audit_events",
    ])
      expect(sql).toMatch(
        new RegExp(
          `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${table}\\b`,
          "i",
        ),
      );
  });

  it("enumerates all 16 counsel activities", () => {
    for (const activity of ACTIVITIES) expect(sql).toContain(`'${activity}'`);
  });

  it("enumerates determination and activity-decision statuses", () => {
    for (const status of [
      "NOT_RECEIVED",
      "RECEIVED_UNVERIFIED",
      "IDENTITY_UNVERIFIED",
      "EVIDENCE_INCOMPLETE",
      "SCOPE_AMBIGUOUS",
      "REVIEW_REQUIRED",
      "VERIFIED_FOR_RECORDING",
      "SUPERSEDED",
      "REVOKED",
      "APPROVED",
      "APPROVED_WITH_CONDITIONS",
      "RESTRICTED",
      "PROHIBITED",
      "UNRESOLVED",
    ])
      expect(sql).toContain(`'${status}'`);
  });

  it("requires verified counsel identity and complete determination evidence", () => {
    expect(sql).toMatch(
      /verification_status\s*!=\s*'VERIFIED'[\s\S]{0,160}verification_evidence_ref\s+IS\s+NOT\s+NULL/i,
    );
    expect(sql).toMatch(
      /status\s*!=\s*'VERIFIED_FOR_RECORDING'[\s\S]{0,200}decision_document_ref\s+IS\s+NOT\s+NULL/i,
    );
    expect(sql).toMatch(/length\(decision_document_hash\)\s*=\s*64/i);
  });

  it("prevents duplicate activity rows and enforces foreign keys", () => {
    expect(sql).toMatch(/UNIQUE\s*\(\s*determination_id,\s*activity\s*\)/i);
    expect(sql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*counsel_id\s*\)\s*REFERENCES\s+counsel_professionals/i,
    );
    expect(sql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*determination_id\s*\)\s*REFERENCES\s+counsel_determinations/i,
    );
  });

  it("makes determinations, activities and audit events append-only", () => {
    for (const trigger of [
      "trg_counsel_professionals_no_update",
      "trg_counsel_professionals_no_delete",
      "trg_counsel_determinations_no_update",
      "trg_counsel_determinations_no_delete",
      "trg_counsel_activity_no_update",
      "trg_counsel_activity_no_delete",
      "trg_counsel_audit_no_update",
      "trg_counsel_audit_no_delete",
    ])
      expect(sql).toMatch(
        new RegExp(`CREATE\\s+TRIGGER[\\s\\S]{0,120}${trigger}`, "i"),
      );
    expect(sql.match(/RAISE\(ABORT/g)?.length).toBeGreaterThanOrEqual(8);
  });
});
