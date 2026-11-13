import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "migrations/d1/0004_gate4_activity_authorization.sql"),
  "utf8",
);

const ACTIVITIES = [
  "viewing",
  "downloading",
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "ocr",
  "search_indexing",
  "embedding_generation",
  "ai_assisted_analysis",
  "citation_display",
  "quotation",
  "redistribution",
  "commercial_use",
  "retention",
];

describe("Gate 4 activity authorization migration", () => {
  it("is additive and never drops or rewrites existing tables", () => {
    expect(sql).toMatch(/Additive only/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/UPDATE\s+ingestion_runs/i);
    const alters = [...sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN/gi)];
    expect(alters.length).toBe(3);
    for (const match of alters) expect(match[1]).toBe("ingestion_runs");
  });

  it("links ingestion runs to the activity decision and basis", () => {
    expect(sql).toContain("authorization_decision_ref");
    expect(sql).toContain("authorization_decision_refs");
    expect(sql).toContain("authorization_basis_detail");
    expect(sql).toContain("'COUNSEL_DETERMINATION'");
  });

  it("creates the decision and audit tables", () => {
    expect(sql).toMatch(
      /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?source_activity_authorizations\b/i,
    );
    expect(sql).toMatch(
      /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?source_authorization_audit\b/i,
    );
  });

  it("enumerates every required activity", () => {
    for (const activity of ACTIVITIES) expect(sql).toContain(`'${activity}'`);
  });

  it("enumerates the full determination vocabulary", () => {
    for (const status of [
      "UNKNOWN",
      "NOT_REVIEWED",
      "REVIEW_REQUIRED",
      "AUTHORIZED",
      "AUTHORIZED_WITH_CONDITIONS",
      "RESTRICTED",
      "PROHIBITED",
    ])
      expect(sql).toContain(`'${status}'`);
  });

  it("requires evidence for authorized and restricted decisions", () => {
    expect(sql).toMatch(
      /status\s+NOT\s+IN\s*\(\s*'AUTHORIZED'[\s\S]{0,120}evidence_ref\s+IS\s+NOT\s+NULL/i,
    );
    expect(sql).toMatch(/conditions_json/i);
    expect(sql).toMatch(
      /status\s+NOT\s+IN\s*\(\s*'AUTHORIZED',\s*'AUTHORIZED_WITH_CONDITIONS'[\s\S]{0,180}counsel_decision_ref/i,
    );
  });

  it("makes both tables append-only with triggers", () => {
    for (const trigger of [
      "trg_source_activity_auth_no_update",
      "trg_source_activity_auth_no_delete",
      "trg_source_auth_audit_no_update",
      "trg_source_auth_audit_no_delete",
    ])
      expect(sql).toMatch(
        new RegExp(`CREATE\\s+TRIGGER[\\s\\S]{0,120}${trigger}`, "i"),
      );
    expect(sql.match(/RAISE\(ABORT/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
