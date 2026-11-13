import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  COUNSEL_ACTIVITIES,
} from "../../packages/legal-ingestion/src/index";

const taxonomy = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/gates/gate-6/activity-taxonomy.json"),
    "utf8",
  ),
) as {
  canonical_activity_count: number;
  gate4_enforced_matrix_count: number;
  activities: Array<{ activity_id: string }>;
  mapping: { gate5_16: string[]; gate4_14: string[]; extended: string[] };
};

const gate4Matrix = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/gates/gate-4/authorization-matrix.json"),
    "utf8",
  ),
) as { activity_vocabulary: string[] };

const gate5Migration = readFileSync(
  join(process.cwd(), "migrations/d1/0005_gate5_counsel_determinations.sql"),
  "utf8",
);

const decisionForm = readFileSync(
  join(process.cwd(), "docs/gates/gate-5/03_COUNSEL_DECISION_FORM.md"),
  "utf8",
);

describe("Gate 6 — canonical activity taxonomy", () => {
  it("defines 16 unique canonical activities", () => {
    expect(taxonomy.canonical_activity_count).toBe(16);
    expect(taxonomy.activities).toHaveLength(16);
    expect(new Set(taxonomy.activities.map((a) => a.activity_id)).size).toBe(
      16,
    );
  });

  it("matches the runtime and counsel activity identifiers", () => {
    expect([...COUNSEL_ACTIVITIES]).toEqual(taxonomy.mapping.gate5_16);
    expect([...ACTIVITIES]).toEqual(taxonomy.mapping.gate4_14);
  });

  it("matches the Gate 4 14-cell matrix", () => {
    expect(taxonomy.gate4_enforced_matrix_count).toBe(14);
    expect(gate4Matrix.activity_vocabulary).toEqual(taxonomy.mapping.gate4_14);
  });

  it("represents every canonical activity in migration 0005 and the counsel form", () => {
    for (const activity of taxonomy.mapping.gate5_16) {
      expect(gate5Migration).toContain(`'${activity}'`);
      expect(decisionForm).toContain(`\`${activity}\``);
    }
  });

  it("marks the two extended activities as outside the Gate 4 matrix", () => {
    expect(taxonomy.mapping.extended).toEqual([
      "temporary_local_storage",
      "substantial_reproduction",
    ]);
    for (const activity of taxonomy.mapping.extended)
      expect(taxonomy.mapping.gate4_14).not.toContain(activity);
  });
});
