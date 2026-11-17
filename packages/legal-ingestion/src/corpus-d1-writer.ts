// @phli/legal-ingestion — corpus → D1 writer
// Gate 17. See docs/gates/gate-17/00_PLAN.md
//
// Inserts an ingested `CorpusState` into the canonical D1 tables in
// foreign-key order: legal_documents, document_versions, legal_provisions,
// document_chunks, source_manifestations.
//
// The writer is insert-only. It never UPDATEs or DELETEs: a row that already
// exists with different business content is reported as a conflict and nothing
// at all is written.
//
// Atomicity depends on `db.batch`. The whole write is exactly one batch. A
// handle that does not expose `batch` is refused with `batch_required` before
// any read or write: there is deliberately no sequential fallback, because a
// table-at-a-time loop would leave a partial corpus behind when a later table
// fails. The Cloudflare D1 binding provides an atomic batch, and the local
// SQLite shim emulates that semantic. If `batch()` rejects, the error is
// rethrown with the report attached, and every `inserted` count is zero: a
// report never claims a row that is not durable.
//
// Equality compares business columns only. `created_at` and `updated_at` are
// write-time provenance, not corpus facts: they are still written on insert,
// but they are excluded from the comparison, so replaying the same corpus with
// a different `options.now` stays unchanged instead of conflicting.
//
// Pre-validation happens before the batch is built. Duplicate ids in the
// corpus, a null in a NOT NULL column that has no schema default, a value
// outside a CHECK vocabulary, or an unresolved foreign key aborts the write
// with a report and no statements. Columns that are NOT NULL *with* a schema
// default are omitted from the insert when the corpus value is null, so the
// database default applies. The required/defaulted lists and vocabularies below
// are transcribed from migrations/d1/0001_legal_documents.sql and
// migrations/d1/0002_gate1_ingestion.sql; the migration is authoritative.
//
// Out of scope, deliberately: extraction_jobs, verification_records,
// document_relationships and citation_aliases. They are neither read nor
// written here, and their absence from a corpus write is intentional.
//
// Every value is a bound parameter. Table and column identifiers are static
// literals in this module, never corpus data.
//
// The local SQLite shim is supplementary evidence only; this is not D1 runtime
// validation.

import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-types";
import type { CorpusState } from "./types";

export interface CorpusWriteReport {
  inserted: {
    documents: number;
    versions: number;
    provisions: number;
    chunks: number;
    manifestations: number;
  };
  /** Ids already present with identical content, sorted. */
  unchanged: string[];
  /** Ids present with different content; non-empty means nothing was written. */
  conflicts: Array<{ table: string; id: string; reason: string }>;
}

interface PendingRow {
  id: string;
  /** Columns and values actually bound into the INSERT. */
  columns: string[];
  values: unknown[];
  /** Business columns for equality; write-time provenance is absent. */
  compare: Array<[column: string, value: unknown]>;
}

interface TableWrite {
  table: string;
  key: keyof CorpusWriteReport["inserted"];
  rows: PendingRow[];
}

interface TableSchema {
  table: string;
  /** NOT NULL columns with no default: a null is refused. */
  required: ReadonlySet<string>;
  /** NOT NULL columns with a literal default: a null is omitted. */
  defaulted: ReadonlyMap<string, unknown>;
  /** CHECK (...) vocabularies, copied from the migrations. */
  checks: ReadonlyMap<string, ReadonlySet<string>>;
  /** column → referenced table. */
  foreignKeys: ReadonlyMap<string, string>;
}

type Entry = [column: string, value: unknown];
type Conflict = { table: string; id: string; reason: string };

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Split ids so each `IN (...)` stays inside SQLite's 90-placeholder budget. */
function chunkIds(ids: string[], size = 90): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

/**
 * `created_at` comes from the row, else the supplied clock, else it is omitted
 * so the schema default (`datetime('now')`) applies. It is never invented.
 */
function provenanceValue(
  explicit: string | null | undefined,
  now: string | undefined,
): string | null {
  return explicit ?? now ?? null;
}

function emptyInserted(): CorpusWriteReport["inserted"] {
  return {
    documents: 0,
    versions: 0,
    provisions: 0,
    chunks: 0,
    manifestations: 0,
  };
}

// ---------------------------------------------------------------------------
// Schema facts read from migrations/d1/0001_legal_documents.sql and
// migrations/d1/0002_gate1_ingestion.sql. Keep these in lockstep with the
// migrations: a value listed there is accepted even if this code once rejected
// it, and a NOT NULL column with a DEFAULT is omitted rather than refused.
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES = new Set([
  "CONSTITUTION",
  "STATUTE",
  "REPUBLIC_ACT",
  "COMMONWEALTH_ACT",
  "PRESIDENTIAL_DECREE",
  "BATAS_PAMBANSA",
  "EXECUTIVE_ORDER",
  "ADMINISTRATIVE_ORDER",
  "COURT_DECISION",
  "SIGNED_RESOLUTION",
  "COURT_RULE",
  "COURT_CIRCULAR",
  "AGENCY_REGULATION",
  "ADMINISTRATIVE_DECISION",
  "TREATY",
  "LOCAL_ORDINANCE",
  "LEGAL_REFERENCE",
]);

const LEGAL_STATUSES = new Set([
  "UNKNOWN",
  "IN_FORCE",
  "PARTIALLY_AMENDED",
  "AMENDED",
  "REPEALED",
  "SUPERSEDED",
  "EXPIRED",
  "NOT_YET_EFFECTIVE",
  "UNDER_REVIEW",
]);

const VERIFICATION_STATUSES = new Set([
  "UNVERIFIED",
  "PENDING_REVIEW",
  "VERIFIED",
  "CONFLICT_DETECTED",
  "DEFECTIVE_EXTRACTION",
]);

const AUTHORITY_LEVELS = new Set([
  "official_primary",
  "official_secondary",
  "unofficial",
]);

const ACQUISITION_STATUSES = new Set([
  "Approved",
  "Restricted",
  "Manual",
  "Pending",
  "Rejected",
]);

const CHUNK_KINDS = new Set([
  "provision",
  "paragraph",
  "table",
  "footnote",
  "page",
]);

const PROVISION_TYPES = new Set([
  "PREAMBLE",
  "ARTICLE",
  "SECTION",
  "RULE",
  "PARAGRAPH",
  "SUBPARAGRAPH",
  "CLAUSE",
  "ITEM",
]);

/** Sentinel for a dynamic default such as `datetime('now')`. */
const SCHEMA_NOW = Symbol("schema_now");

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  legal_documents: {
    table: "legal_documents",
    required: new Set(["id", "document_type", "title"]),
    defaulted: new Map<string, unknown>([
      ["legal_status", "UNKNOWN"],
      ["verification_status", "UNVERIFIED"],
      ["authority_level", "unofficial"],
      ["created_at", SCHEMA_NOW],
      ["updated_at", SCHEMA_NOW],
    ]),
    checks: new Map<string, ReadonlySet<string>>([
      ["document_type", DOCUMENT_TYPES],
      ["legal_status", LEGAL_STATUSES],
      ["verification_status", VERIFICATION_STATUSES],
      ["authority_level", AUTHORITY_LEVELS],
    ]),
    // source_id is indexed, not a foreign key.
    foreignKeys: new Map(),
  },
  document_versions: {
    table: "document_versions",
    required: new Set(["id", "document_id", "version_number", "content_hash"]),
    defaulted: new Map<string, unknown>([
      ["is_current", 0],
      ["created_at", SCHEMA_NOW],
    ]),
    checks: new Map(),
    foreignKeys: new Map([["document_id", "legal_documents"]]),
  },
  legal_provisions: {
    table: "legal_provisions",
    required: new Set([
      "id",
      "document_id",
      "version_id",
      "provision_type",
      "label",
      "text",
      "ordinal",
    ]),
    defaulted: new Map<string, unknown>([
      ["legal_status", "UNKNOWN"],
      ["created_at", SCHEMA_NOW],
    ]),
    checks: new Map<string, ReadonlySet<string>>([
      ["provision_type", PROVISION_TYPES],
      ["legal_status", LEGAL_STATUSES],
    ]),
    foreignKeys: new Map([
      ["document_id", "legal_documents"],
      ["version_id", "document_versions"],
      ["parent_provision_id", "legal_provisions"],
      ["amended_by_document_id", "legal_documents"],
    ]),
  },
  document_chunks: {
    table: "document_chunks",
    required: new Set([
      "id",
      "document_id",
      "chunk_kind",
      "chunk_index",
      "content",
    ]),
    defaulted: new Map<string, unknown>([["created_at", SCHEMA_NOW]]),
    checks: new Map<string, ReadonlySet<string>>([["chunk_kind", CHUNK_KINDS]]),
    foreignKeys: new Map([
      ["document_id", "legal_documents"],
      ["version_id", "document_versions"],
      ["provision_id", "legal_provisions"],
    ]),
  },
  source_manifestations: {
    table: "source_manifestations",
    required: new Set([
      "id",
      "source_id",
      "source_url",
      "source_type",
      "retrieved_at",
    ]),
    defaulted: new Map<string, unknown>([
      ["authority_level", "unofficial"],
      ["acquisition_status", "Pending"],
      ["is_primary", 0],
      ["created_at", SCHEMA_NOW],
    ]),
    checks: new Map<string, ReadonlySet<string>>([
      ["authority_level", AUTHORITY_LEVELS],
      ["acquisition_status", ACQUISITION_STATUSES],
    ]),
    foreignKeys: new Map([["document_id", "legal_documents"]]),
  },
};

/**
 * Build one insert row.
 *
 * - `created_at` / `updated_at` are provenance: written when known, omitted so
 *   the schema default applies when not, never compared.
 * - A null in a defaulted column is omitted so the default applies.
 * - A null in a required column is reported and the row is not usable.
 * - A value outside its CHECK vocabulary is reported.
 */
function buildRow(
  schema: TableSchema,
  entries: Entry[],
  conflicts: Conflict[],
): PendingRow {
  const id = entries[0][1] == null ? "" : String(entries[0][1]);
  const columns: string[] = [];
  const values: unknown[] = [];
  const compare: Array<[string, unknown]> = [];

  for (const [column, value] of entries) {
    if (column === "created_at" || column === "updated_at") {
      if (value != null) {
        columns.push(column);
        values.push(value);
      }
      continue;
    }

    if (value == null) {
      if (schema.defaulted.has(column)) {
        compare.push([column, schema.defaulted.get(column)]);
        continue;
      }
      if (schema.required.has(column)) {
        conflicts.push({
          table: schema.table,
          id,
          reason: `${schema.table}:missing_required:${column}`,
        });
        continue;
      }
      columns.push(column);
      values.push(null);
      compare.push([column, null]);
      continue;
    }

    const vocabulary = schema.checks.get(column);
    if (vocabulary && !vocabulary.has(String(value))) {
      conflicts.push({
        table: schema.table,
        id,
        reason: `${schema.table}:invalid_value:${column}`,
      });
    }

    columns.push(column);
    values.push(value);
    compare.push([column, value]);
  }

  return { id, columns, values, compare };
}

/** Normalise for comparison: nullish → null, boolean → 1/0, numbers as-is. */
function normalize(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  return String(value);
}

function firstDifferingColumn(
  stored: Record<string, unknown>,
  row: PendingRow,
): string | null {
  for (const [column, value] of row.compare) {
    if (normalize(stored[column]) !== normalize(value)) {
      return column;
    }
  }
  return null;
}

function insertSql(table: string, row: PendingRow): string {
  return `INSERT INTO ${table} (${row.columns.join(", ")}) VALUES (${placeholders(
    row.columns.length,
  )})`;
}

function buildTables(
  corpus: CorpusState,
  now: string | undefined,
): { tables: TableWrite[]; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];

  const documents = corpus.documents.map((document) =>
    buildRow(
      TABLE_SCHEMAS.legal_documents,
      [
        ["id", document.id],
        ["document_type", document.documentType],
        ["title", document.title],
        ["short_title", document.shortTitle],
        ["citation_text", document.citationText],
        ["docket_number", document.docketNumber],
        ["issuing_body", document.issuingBody],
        ["jurisdiction", document.jurisdiction],
        ["promulgation_date", document.promulgationDate],
        ["approval_date", document.approvalDate],
        ["publication_date", document.publicationDate],
        ["effectivity_date", document.effectivityDate],
        ["amendment_date", document.amendmentDate],
        ["repeal_date", document.repealDate],
        ["legal_status", document.legalStatus],
        ["verification_status", document.verificationStatus],
        ["authority_level", document.authorityLevel],
        ["source_id", document.sourceId],
        ["identity_key", document.identityKey],
        ["created_at", provenanceValue(document.createdAt, now)],
        ["updated_at", provenanceValue(document.updatedAt, now)],
      ],
      conflicts,
    ),
  );

  const versions = corpus.versions.map((version) =>
    buildRow(
      TABLE_SCHEMAS.document_versions,
      [
        ["id", version.id],
        ["document_id", version.documentId],
        ["version_number", version.versionNumber],
        ["version_label", version.versionLabel],
        ["content_hash", version.contentHash],
        ["effective_from", version.effectiveFrom],
        ["effective_to", version.effectiveTo],
        ["is_current", version.isCurrent ? 1 : 0],
        ["change_summary", version.changeSummary],
        ["created_at", provenanceValue(version.createdAt, now)],
      ],
      conflicts,
    ),
  );

  const provisions = corpus.provisions.map((provision) =>
    buildRow(
      TABLE_SCHEMAS.legal_provisions,
      [
        ["id", provision.id],
        ["document_id", provision.documentId],
        ["version_id", provision.versionId],
        ["provision_type", provision.provisionType],
        ["label", provision.label],
        ["heading", provision.heading],
        ["text", provision.text],
        ["ordinal", provision.ordinal],
        ["parent_provision_id", provision.parentProvisionId],
        ["legal_status", provision.legalStatus],
        ["effective_from", provision.effectiveFrom],
        ["effective_to", provision.effectiveTo],
        ["amended_by_document_id", provision.amendedByDocumentId],
        ["created_at", provenanceValue(provision.createdAt, now)],
      ],
      conflicts,
    ),
  );

  const chunks = corpus.chunks.map((chunkRow) =>
    buildRow(
      TABLE_SCHEMAS.document_chunks,
      [
        ["id", chunkRow.id],
        ["document_id", chunkRow.documentId],
        ["version_id", chunkRow.versionId],
        ["provision_id", chunkRow.provisionId],
        ["chunk_kind", chunkRow.chunkKind],
        ["chunk_index", chunkRow.chunkIndex],
        ["content", chunkRow.content],
        ["token_count", chunkRow.tokenCount],
        ["char_start", chunkRow.charStart],
        ["char_end", chunkRow.charEnd],
        ["page_number", chunkRow.pageNumber],
        ["embedding_id", chunkRow.embeddingId],
        ["created_at", provenanceValue(chunkRow.createdAt, now)],
      ],
      conflicts,
    ),
  );

  const manifestations = corpus.manifestations.map((manifestation) =>
    buildRow(
      TABLE_SCHEMAS.source_manifestations,
      [
        ["id", manifestation.id],
        ["document_id", manifestation.documentId],
        ["source_id", manifestation.sourceId],
        ["source_url", manifestation.sourceUrl],
        ["source_type", manifestation.sourceType],
        ["authority_level", manifestation.authorityLevel],
        ["acquisition_status", manifestation.acquisitionStatus],
        ["mime_type", manifestation.mimeType],
        ["file_size_bytes", manifestation.fileSizeBytes],
        ["storage_key", manifestation.storageKey],
        ["content_hash", manifestation.contentHash],
        ["is_primary", manifestation.isPrimary ? 1 : 0],
        ["retrieved_at", manifestation.retrievedAt],
        ["retrieved_by", manifestation.retrievedBy],
        ["retrieval_status", manifestation.retrievalStatus],
        ["created_at", provenanceValue(manifestation.createdAt, now)],
      ],
      conflicts,
    ),
  );

  // Insert order matters: every child row's foreign key is satisfied first.
  const tables: TableWrite[] = [
    { table: "legal_documents", key: "documents", rows: documents },
    { table: "document_versions", key: "versions", rows: versions },
    { table: "legal_provisions", key: "provisions", rows: provisions },
    { table: "document_chunks", key: "chunks", rows: chunks },
    {
      table: "source_manifestations",
      key: "manifestations",
      rows: manifestations,
    },
  ];

  // A second row with the same id can never be inserted: the first one takes
  // the primary key and the second one violates UNIQUE. Refuse the whole write
  // rather than compare only one of the pair.
  for (const table of tables) {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const row of table.rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        continue;
      }
      if (reported.has(row.id)) continue;
      reported.add(row.id);
      conflicts.push({
        table: table.table,
        id: row.id,
        reason: `${table.table}:duplicate_id_in_corpus`,
      });
    }
  }

  return { tables, conflicts };
}

/** Read the existing rows for these ids, one SELECT per chunk of 90 ids. */
async function readExisting(
  db: D1DatabaseLike,
  table: string,
  ids: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const existing = new Map<string, Record<string, unknown>>();
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT * FROM ${table} WHERE id IN (${placeholders(slice.length)})`,
      )
      .bind(...slice)
      .all<Record<string, unknown>>();
    for (const row of result.results ?? []) {
      existing.set(String(row.id), row);
    }
  }
  return existing;
}

function pendingValue(row: PendingRow, column: string): unknown {
  const index = row.columns.indexOf(column);
  return index < 0 ? null : row.values[index];
}

/**
 * Resolve every foreign key against a pending row in this corpus or an existing
 * database row. Pending rows in the same table also count for a self-reference
 * such as `legal_provisions.parent_provision_id`.
 */
async function resolveReferences(
  db: D1DatabaseLike,
  reads: Array<{
    table: string;
    rows: PendingRow[];
    existing: Map<string, Record<string, unknown>>;
  }>,
  conflicts: Conflict[],
): Promise<void> {
  const pendingIds = new Map<string, Set<string>>();
  const loaded = new Map<string, Map<string, Record<string, unknown>>>();

  for (const read of reads) {
    pendingIds.set(read.table, new Set(read.rows.map((row) => row.id)));
    loaded.set(read.table, read.existing);
  }

  // First pass: collect the references that no pending row satisfies, grouped
  // by referenced table so they can be read back in one SELECT per table.
  const missing = new Map<string, Set<string>>();
  for (const read of reads) {
    const foreignKeys = TABLE_SCHEMAS[read.table].foreignKeys;
    if (foreignKeys.size === 0) continue;
    for (const row of read.rows) {
      for (const [column, target] of foreignKeys) {
        const value = pendingValue(row, column);
        if (value == null) continue;
        const id = String(value);
        if (pendingIds.get(target)?.has(id)) continue;
        if (loaded.get(target)?.has(id)) continue;
        const ids = missing.get(target) ?? new Set<string>();
        ids.add(id);
        missing.set(target, ids);
      }
    }
  }

  for (const [target, ids] of missing) {
    const found = await readExisting(db, target, [...ids]);
    const map = loaded.get(target) ?? new Map();
    for (const [id, row] of found) map.set(id, row);
    loaded.set(target, map);
  }

  // Second pass: report whatever is still unresolved.
  for (const read of reads) {
    const foreignKeys = TABLE_SCHEMAS[read.table].foreignKeys;
    if (foreignKeys.size === 0) continue;
    for (const row of read.rows) {
      for (const [column, target] of foreignKeys) {
        const value = pendingValue(row, column);
        if (value == null) continue;
        const id = String(value);
        if (pendingIds.get(target)?.has(id)) continue;
        if (loaded.get(target)?.has(id)) continue;
        conflicts.push({
          table: read.table,
          id: row.id,
          reason: `${read.table}:unresolved_reference:${column}`,
        });
      }
    }
  }
}

export async function writeCorpusToD1(
  db: D1DatabaseLike,
  corpus: CorpusState,
  options?: { now?: string },
): Promise<CorpusWriteReport> {
  // Atomicity is a hard precondition, checked before any read or write. Without
  // batch there is no way to make a five-table insert atomic, and a sequential
  // fallback would leave a partial corpus behind on failure.
  const batch = (db as Partial<D1DatabaseLike>).batch;
  if (typeof batch !== "function") {
    throw new Error("batch_required");
  }

  const report: CorpusWriteReport = {
    inserted: emptyInserted(),
    unchanged: [],
    conflicts: [],
  };

  const built = buildTables(corpus, options?.now);
  report.conflicts.push(...built.conflicts);
  if (report.conflicts.length > 0) {
    // Duplicate ids, missing required values or invalid vocabulary: nothing is
    // read and nothing is written.
    return report;
  }

  const unchanged = new Set<string>();
  const reads: Array<{
    table: string;
    key: keyof CorpusWriteReport["inserted"];
    rows: PendingRow[];
    existing: Map<string, Record<string, unknown>>;
  }> = [];

  // Verify before writing: read every id we would insert and compare the
  // business columns we would write.
  for (const table of built.tables) {
    if (table.rows.length === 0) continue;
    const existing = await readExisting(
      db,
      table.table,
      table.rows.map((row) => row.id),
    );
    reads.push({
      table: table.table,
      key: table.key,
      rows: table.rows,
      existing,
    });

    for (const row of table.rows) {
      const stored = existing.get(row.id);
      if (!stored) continue;
      const column = firstDifferingColumn(stored, row);
      if (column === null) {
        unchanged.add(row.id);
      } else {
        report.conflicts.push({
          table: table.table,
          id: row.id,
          reason: `${table.table}:${column}_differs`,
        });
      }
    }
  }

  report.unchanged = [...unchanged].sort();
  if (report.conflicts.length > 0) {
    // Fail closed: a conflict means no row may be inserted at all.
    return report;
  }

  await resolveReferences(db, reads, report.conflicts);
  if (report.conflicts.length > 0) return report;

  const statements: D1PreparedStatementLike[] = [];
  const batched = emptyInserted();
  for (const read of reads) {
    for (const row of read.rows) {
      if (read.existing.has(row.id)) continue;
      statements.push(
        db.prepare(insertSql(read.table, row)).bind(...row.values),
      );
      batched[read.key] += 1;
    }
  }

  if (statements.length > 0) {
    try {
      await batch.call(db, statements);
    } catch (error) {
      // A failed batch inserted nothing that this report may claim. Counts are
      // reset before the error is rethrown, and the empty report travels with
      // the error so the caller can see that nothing was claimed.
      report.inserted = emptyInserted();
      if (error !== null && typeof error === "object") {
        (error as { report?: CorpusWriteReport }).report = report;
      }
      throw error;
    }
    // Count only after the batch resolves: these rows are now durable.
    report.inserted = batched;
  }

  return report;
}
