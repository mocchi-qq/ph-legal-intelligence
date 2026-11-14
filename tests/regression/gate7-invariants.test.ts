// Gate 7 — regression invariants. These must hold after every Gate 7 change:
//   * zero real counsel determinations;
//   * all 350 authorization cells UNKNOWN;
//   * four pilot documents blocked, hashes unchanged, no new documents;
//   * synthetic fixtures never become real registry rows.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ACTIVITIES } from "../../packages/legal-ingestion/src/authorization";
import { GATE7_MIGRATIONS } from "../helpers/d1-sqlite";

const root = process.cwd();

function json<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}

interface Source {
  source_id: string;
  authorization_status: string;
}

describe("Gate 7 — regression invariants", () => {
  it("keeps all 350 authorization cells UNKNOWN", () => {
    const sources = json<Source[]>("legal-data/source-registry/sources.json");
    expect(sources).toHaveLength(25);
    expect(ACTIVITIES).toHaveLength(14);
    expect(sources.length * ACTIVITIES.length).toBe(350);
    const authorization = json<{
      sources: { source_id: string; authorization_status: string }[];
    }>("legal-data/source-registry/sources.authorization.json");
    expect(authorization.sources).toHaveLength(25);
    for (const source of authorization.sources) {
      expect(source.authorization_status, source.source_id).toBe("UNKNOWN");
    }
  });

  it("keeps the real registry empty", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    for (const migration of GATE7_MIGRATIONS)
      db.exec(readFileSync(join(root, "migrations/d1", migration), "utf8"));
    for (const table of [
      "counsel_professionals",
      "counsel_determinations",
      "counsel_activity_decisions",
      "counsel_audit_events",
      "counsel_registry_commits",
      "authorization_audit_events",
    ]) {
      const count = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
        n: number;
      };
      expect(count.n, table).toBe(0);
    }
    db.close();
  });

  it("keeps the four pilot documents blocked with unchanged hashes", () => {
    const manifest = json<
      { internal_document_id: string; sha256: string; source_status: string }[]
    >("docs/gates/gate-2/PILOT_MANIFEST.json");
    expect(manifest).toHaveLength(4);
    for (const entry of manifest) {
      expect(entry.source_status).toBe("UNKNOWN");
      const file = join(
        root,
        "legal-data/pilot",
        `${entry.internal_document_id}.html`,
      );
      if (!existsSync(file)) continue; // corpus is git-ignored; absence is not a change
      const digest = createHash("sha256")
        .update(readFileSync(file))
        .digest("hex");
      expect(digest, entry.internal_document_id).toBe(entry.sha256);
    }
  });

  it("has acquired no new real documents", () => {
    const pilotDir = join(root, "legal-data/pilot");
    if (!existsSync(pilotDir)) return;
    const files = readdirSync(pilotDir).filter((file) => !file.startsWith("."));
    expect(files.sort()).toEqual([
      "ra10931.html",
      "ra12232.html",
      "ra12325.html",
      "ra12326.html",
    ]);
  });

  it("keeps the Gate 1 benchmark pinned", () => {
    expect(
      existsSync(join(root, "docs/gates/gate-1/08_benchmark-results.json")),
    ).toBe(true);
    const fixtures = json<{ fixtures: unknown[] }>(
      "legal-data/benchmark/synthetic-fixtures/manifest.json",
    );
    expect(fixtures.fixtures.length).toBeGreaterThan(0);
  });

  it("contains no durable counsel database or evidence store in the repository", () => {
    for (const path of [
      "legal-data/counsel",
      "legal-data/evidence",
      ".wrangler/state",
      "counsel.sqlite",
    ])
      expect(existsSync(join(root, path)), path).toBe(false);
  });
});
