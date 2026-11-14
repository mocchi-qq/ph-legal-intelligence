// Minimal structural types for Cloudflare D1. They match the supported D1
// prepared-statement/batch surface without adding a runtime dependency. The
// adapter is not verified against a live D1 binding in this environment.

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}
