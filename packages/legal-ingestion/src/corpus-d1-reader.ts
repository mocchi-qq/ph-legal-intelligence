// @phli/legal-ingestion — read-only corpus view for the citation verifier
// Gate 18. See docs/gates/gate-18/00_PLAN.md
//
// Reads the canonical corpus tables — legal_documents, document_versions,
// legal_provisions, document_chunks — into the shape the verifier consumes.
// This module is read-only: it contains no INSERT, UPDATE or DELETE, and it
// never writes a row.
//
// It makes no authorization decision and no legal judgement. Read-time
// authorization is backlog B-3 and is explicitly out of scope: this reader
// returns whatever the database holds for the requested documents.
//
// The returned shape is structurally identical to `CitationCorpusView` in
// `@phli/citation-engine`, but the interfaces are declared locally on purpose:
// `legal-ingestion` keeps no dependency on the engine, and the engine
// deliberately knows nothing about storage. A test assigns the result to
// `CitationCorpusView`, so any drift fails there rather than silently.
//
// Fail-closed rules:
// - `documentIds` omitted -> the whole corpus (bounded-corpus use: every row of
//   all four tables, with `is_current` still checked on every version read).
// - `documentIds: []`    -> the empty view, without issuing any query.
// - A requested id that is not in legal_documents throws
//   `corpus_document_not_found:<id>`. A view that silently omits a document is
//   indistinguishable from a wrong citation, so omission is never silent.
// - `is_current` must be 1 or 0. Anything else throws
//   `invalid_corpus_row:document_versions:<id>:is_current`; the value is never
//   coerced to a boolean.
//
// Statuses and dates are passed through verbatim: they are never invented,
// defaulted or normalised.
//
// Every value is a bound parameter. Table and column identifiers are static
// literals in this module, never corpus data.
//
// The local SQLite shim is supplementary evidence only; this is not D1 runtime
// validation.

import type { D1DatabaseLike } from "./d1-types";

export interface CitationDocumentView {
  id: string;
  title: string;
  citationText?: string | null;
  docketNumber?: string | null;
  identityKey?: string | null;
  legalStatus: string;
  effectivityDate?: string | null;
  repealDate?: string | null;
  promulgationDate?: string | null;
}

export interface CitationVersionView {
  id: string;
  documentId: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isCurrent: boolean;
}

export interface CitationProvisionView {
  id: string;
  documentId: string;
  versionId: string;
  label: string;
  text: string;
  legalStatus: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface CitationChunkView {
  id: string;
  documentId: string;
  versionId?: string | null;
  provisionId?: string | null;
  content: string;
}

/** Everything the verifier needs to read; storage-shaped, not engine-shaped. */
export interface CitationCorpusSnapshot {
  documents: CitationDocumentView[];
  versions: CitationVersionView[];
  provisions: CitationProvisionView[];
  chunks: CitationChunkView[];
}

export interface LoadCitationCorpusOptions {
  /**
   * Restrict the read to these documents. Omitted means the whole corpus,
   * which is only appropriate for a bounded corpus. An empty array returns an
   * empty snapshot and issues no query.
   */
  documentIds?: string[];
}

interface DocumentRow {
  id: string;
  title: string;
  citation_text: string | null;
  docket_number: string | null;
  identity_key: string | null;
  legal_status: string;
  effectivity_date: string | null;
  repeal_date: string | null;
  promulgation_date: string | null;
}

interface VersionRow {
  id: string;
  document_id: string;
  effective_from: string | null;
  effective_to: string | null;
  /** Must be 0 or 1; anything else is refused rather than coerced. */
  is_current: number;
}

interface ProvisionRow {
  id: string;
  document_id: string;
  version_id: string;
  label: string;
  text: string;
  legal_status: string;
  effective_from: string | null;
  effective_to: string | null;
  ordinal: number;
}

interface ChunkRow {
  id: string;
  document_id: string;
  version_id: string | null;
  provision_id: string | null;
  content: string;
  chunk_index: number;
}

// Column lists shared by the unfiltered and filtered variants of each SELECT.
// Identifiers stay module literals; only ids are ever bound.
const DOCUMENT_COLUMNS = `id, title, citation_text, docket_number, identity_key,
  legal_status, effectivity_date, repeal_date, promulgation_date`;

const VERSION_COLUMNS = `id, document_id, effective_from, effective_to,
  is_current`;

const PROVISION_COLUMNS = `id, document_id, version_id, label, text,
  legal_status, effective_from, effective_to, ordinal`;

const CHUNK_COLUMNS = `id, document_id, version_id, provision_id, content,
  chunk_index`;

const IN_BATCH = 90;

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/**
 * Split a bind list so each `IN (...)` stays inside SQLite's 90-placeholder
 * budget. The same pattern lives (unexported) in authority-d1-store.ts; the two
 * small helpers are duplicated rather than exported from a store module, so
 * neither reader depends on the other's internals.
 */
function chunkIds(ids: string[], size = IN_BATCH): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function emptySnapshot(): CitationCorpusSnapshot {
  return { documents: [], versions: [], provisions: [], chunks: [] };
}

/**
 * `ids === null` reads every row; otherwise one SELECT per chunk of ids.
 * Results are ordered in SQL per chunk and re-sorted by the caller, so the
 * merged order does not depend on how the ids fell into chunks.
 */
async function readDocuments(
  db: D1DatabaseLike,
  ids: string[] | null,
): Promise<DocumentRow[]> {
  if (ids === null) {
    const result = await db
      .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM legal_documents ORDER BY id`)
      .all<DocumentRow>();
    return result.results ?? [];
  }
  const rows: DocumentRow[] = [];
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT ${DOCUMENT_COLUMNS} FROM legal_documents
          WHERE id IN (${placeholders(slice.length)})
          ORDER BY id`,
      )
      .bind(...slice)
      .all<DocumentRow>();
    rows.push(...(result.results ?? []));
  }
  return rows;
}

async function readVersions(
  db: D1DatabaseLike,
  ids: string[] | null,
): Promise<VersionRow[]> {
  if (ids === null) {
    const result = await db
      .prepare(
        `SELECT ${VERSION_COLUMNS} FROM document_versions
          ORDER BY document_id, id`,
      )
      .all<VersionRow>();
    return result.results ?? [];
  }
  const rows: VersionRow[] = [];
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT ${VERSION_COLUMNS} FROM document_versions
          WHERE document_id IN (${placeholders(slice.length)})
          ORDER BY document_id, id`,
      )
      .bind(...slice)
      .all<VersionRow>();
    rows.push(...(result.results ?? []));
  }
  return rows;
}

async function readProvisions(
  db: D1DatabaseLike,
  ids: string[] | null,
): Promise<ProvisionRow[]> {
  if (ids === null) {
    const result = await db
      .prepare(
        `SELECT ${PROVISION_COLUMNS} FROM legal_provisions
          ORDER BY document_id, ordinal, id`,
      )
      .all<ProvisionRow>();
    return result.results ?? [];
  }
  const rows: ProvisionRow[] = [];
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT ${PROVISION_COLUMNS} FROM legal_provisions
          WHERE document_id IN (${placeholders(slice.length)})
          ORDER BY document_id, ordinal, id`,
      )
      .bind(...slice)
      .all<ProvisionRow>();
    rows.push(...(result.results ?? []));
  }
  return rows;
}

async function readChunks(
  db: D1DatabaseLike,
  ids: string[] | null,
): Promise<ChunkRow[]> {
  if (ids === null) {
    const result = await db
      .prepare(
        `SELECT ${CHUNK_COLUMNS} FROM document_chunks
          ORDER BY document_id, chunk_index, id`,
      )
      .all<ChunkRow>();
    return result.results ?? [];
  }
  const rows: ChunkRow[] = [];
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT ${CHUNK_COLUMNS} FROM document_chunks
          WHERE document_id IN (${placeholders(slice.length)})
          ORDER BY document_id, chunk_index, id`,
      )
      .bind(...slice)
      .all<ChunkRow>();
    rows.push(...(result.results ?? []));
  }
  return rows;
}

/**
 * Refuse any requested document that is not in legal_documents. Reported in
 * request order, so the first missing id is the first one the caller named.
 */
async function assertDocumentsExist(
  db: D1DatabaseLike,
  ids: string[],
): Promise<void> {
  const found = new Set<string>();
  for (const slice of chunkIds(ids)) {
    const result = await db
      .prepare(
        `SELECT id FROM legal_documents WHERE id IN (${placeholders(
          slice.length,
        )})`,
      )
      .bind(...slice)
      .all<{ id: string }>();
    for (const row of result.results ?? []) found.add(row.id);
  }
  for (const id of ids) {
    if (!found.has(id)) throw new Error(`corpus_document_not_found:${id}`);
  }
}

function toDocument(row: DocumentRow): CitationDocumentView {
  return {
    id: row.id,
    title: row.title,
    citationText: row.citation_text,
    docketNumber: row.docket_number,
    identityKey: row.identity_key,
    legalStatus: row.legal_status,
    effectivityDate: row.effectivity_date,
    repealDate: row.repeal_date,
    promulgationDate: row.promulgation_date,
  };
}

function toVersion(row: VersionRow): CitationVersionView {
  // 1 and 0 only: a stored 2 (or a string, or a null) is a corrupt row, not a
  // truthy boolean. Coercing it would hide the corruption from the verifier.
  if (row.is_current !== 1 && row.is_current !== 0) {
    throw new Error(
      `invalid_corpus_row:document_versions:${row.id}:is_current`,
    );
  }
  return {
    id: row.id,
    documentId: row.document_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isCurrent: row.is_current === 1,
  };
}

function toProvision(row: ProvisionRow): CitationProvisionView {
  return {
    id: row.id,
    documentId: row.document_id,
    versionId: row.version_id,
    label: row.label,
    text: row.text,
    legalStatus: row.legal_status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}

function toChunk(row: ChunkRow): CitationChunkView {
  return {
    id: row.id,
    documentId: row.document_id,
    versionId: row.version_id,
    provisionId: row.provision_id,
    content: row.content,
  };
}

/**
 * Load the corpus rows the verifier needs. Read-only: no authorization
 * decision, no status normalisation, no judgement.
 */
export async function loadCitationCorpusView(
  db: D1DatabaseLike,
  options?: LoadCitationCorpusOptions,
): Promise<CitationCorpusSnapshot> {
  const requested = options?.documentIds;
  if (requested !== undefined && requested.length === 0) {
    return emptySnapshot();
  }

  // Deduplicate for the queries but keep request order for the error report.
  const requestedIds = requested === undefined ? null : [...new Set(requested)];
  if (requestedIds !== null) {
    await assertDocumentsExist(db, requestedIds);
  }

  const documentRows = await readDocuments(db, requestedIds);
  const versionRows = await readVersions(db, requestedIds);
  const provisionRows = await readProvisions(db, requestedIds);
  const chunkRows = await readChunks(db, requestedIds);

  // Deterministic order across chunk boundaries, matching the SQL ORDER BYs.
  documentRows.sort((left, right) => compareStrings(left.id, right.id));
  versionRows.sort(
    (left, right) =>
      compareStrings(left.document_id, right.document_id) ||
      compareStrings(left.id, right.id),
  );
  provisionRows.sort(
    (left, right) =>
      compareStrings(left.document_id, right.document_id) ||
      compareNumbers(left.ordinal, right.ordinal) ||
      compareStrings(left.id, right.id),
  );
  chunkRows.sort(
    (left, right) =>
      compareStrings(left.document_id, right.document_id) ||
      compareNumbers(left.chunk_index, right.chunk_index) ||
      compareStrings(left.id, right.id),
  );

  return {
    documents: documentRows.map(toDocument),
    versions: versionRows.map(toVersion),
    provisions: provisionRows.map(toProvision),
    chunks: chunkRows.map(toChunk),
  };
}
