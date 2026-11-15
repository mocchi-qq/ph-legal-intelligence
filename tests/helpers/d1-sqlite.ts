// Test-only SQLite shim implementing the minimal D1 surface used by the registry.
// This is NOT Cloudflare D1 and must not be reported as D1 runtime validation.
// Its purpose is supplementary SQL/constraint/rollback evidence.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1Result,
} from "../../packages/legal-ingestion/src/d1-types";

export const GATE7_MIGRATIONS = [
  "0001_legal_documents.sql",
  "0002_gate1_ingestion.sql",
  "0003_owner_authorization.sql",
  "0004_gate4_activity_authorization.sql",
  "0005_gate5_counsel_determinations.sql",
  "0006_gate6_counsel_validation.sql",
  "0007_gate7_authorization_audit.sql",
  "0008_gate7_registry_commit.sql",
  // 0009 is additive (new tables + append-only triggers); it makes this shim
  // applicable to the Gate 8 authority core and Gate 10 reads.
  "0009_authority_core.sql",
] as const;

class SqlitePreparedStatement implements D1PreparedStatementLike {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new SqlitePreparedStatement(this.db, this.sql, values);
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { results, success: true };
  }

  async run(): Promise<unknown> {
    return this.db.prepare(this.sql).run(...this.params);
  }

  runSync(): unknown {
    return this.db.prepare(this.sql).run(...this.params);
  }
}

export interface ShimOptions {
  /**
   * true  — emulate the documented D1 batch semantic (one transaction);
   * false — execute statements one by one, leaving earlier writes behind when a
   *         later statement fails. Used to prove the adapter does not depend on
   *         unverified batch atomicity.
   */
  atomicBatch?: boolean;
  /** Fail the nth (1-based) statement of the next batch. */
  failBatchAt?: number | null;
}

export class SqliteD1Database implements D1DatabaseLike {
  readonly db: DatabaseSync;
  readonly options: ShimOptions;
  batchCount = 0;

  constructor(path = ":memory:", options: ShimOptions = {}) {
    this.db = new DatabaseSync(path);
    this.options = { atomicBatch: true, ...options };
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  prepare(query: string): D1PreparedStatementLike {
    return new SqlitePreparedStatement(this.db, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    this.batchCount += 1;
    const failAt = this.options.failBatchAt ?? null;
    if (this.options.atomicBatch !== false) {
      this.db.exec("BEGIN");
      try {
        const results = statements.map((statement, index) => {
          if (failAt === index + 1) throw new Error("injected_batch_failure");
          return (statement as SqlitePreparedStatement).runSync();
        });
        this.db.exec("COMMIT");
        return results;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    // Deliberately non-atomic: earlier statements stay if a later one fails.
    const results: unknown[] = [];
    for (const [index, statement] of statements.entries()) {
      if (failAt === index + 1) throw new Error("injected_batch_failure");
      results.push((statement as SqlitePreparedStatement).runSync());
    }
    return results;
  }

  applyMigrations(): void {
    for (const migration of GATE7_MIGRATIONS) {
      this.db.exec(
        readFileSync(join(process.cwd(), "migrations/d1", migration), "utf8"),
      );
    }
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  close(): void {
    this.db.close();
  }
}
