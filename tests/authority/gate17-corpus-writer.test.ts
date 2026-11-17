// Gate 17 — corpus → D1 writer against the SQLite shim.
// Supplementary evidence only: this is NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type {
  CorpusState,
  CorpusWriteReport,
  D1DatabaseLike,
} from "../../packages/legal-ingestion/src/index";
import {
  emptyCorpusState,
  writeCorpusToD1,
} from "../../packages/legal-ingestion/src/index";
import type {
  DocumentVersion,
  LegalDocument,
  SourceManifestation,
} from "../../packages/legal-schema/src/index";
import {
  AcquisitionStatus,
  AuthorityLevel,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const CREATED_AT = "2026-01-01T00:00:00Z";
const HASH_ALPHA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_BETA =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const ZERO_INSERTED = {
  documents: 0,
  versions: 0,
  provisions: 0,
  chunks: 0,
  manifestations: 0,
};

/** Remove write-time provenance so a replay must rely on `options.now`. */
function withoutProvenance(corpus: CorpusState): CorpusState {
  for (const row of [
    ...corpus.documents,
    ...corpus.versions,
    ...corpus.provisions,
    ...corpus.chunks,
    ...corpus.manifestations,
  ]) {
    delete (row as { createdAt?: string }).createdAt;
    delete (row as { updatedAt?: string }).updatedAt;
  }
  return corpus;
}

function fresh(): SqliteD1Database {
  const db = new SqliteD1Database();
  db.applyMigrations();
  return db;
}

function document(id: string, title: string): LegalDocument {
  return {
    id,
    documentType: DocumentType.REPUBLIC_ACT,
    title,
    shortTitle: `${title} (short)`,
    docketNumber: null,
    issuingBody: "Synthetic Legislature",
    jurisdiction: "PH",
    promulgationDate: "2026-01-01",
    legalStatus: LegalStatus.IN_FORCE,
    verificationStatus: VerificationStatus.VERIFIED,
    authorityLevel: AuthorityLevel.OFFICIAL_PRIMARY,
    sourceId: "src-synthetic",
    identityKey: `SYNTHETIC:${id}`,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function version(
  id: string,
  documentId: string,
  contentHash: string,
  isCurrent: boolean,
): DocumentVersion {
  return {
    id,
    documentId,
    versionNumber: 1,
    versionLabel: "Original",
    contentHash,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    isCurrent,
    createdAt: CREATED_AT,
  };
}

function manifestation(id: string, documentId: string): SourceManifestation {
  return {
    id,
    documentId,
    sourceId: "src-synthetic",
    sourceUrl: "https://example.test/synthetic/alpha",
    sourceType: "synthetic_fixture",
    authorityLevel: AuthorityLevel.OFFICIAL_PRIMARY,
    acquisitionStatus: AcquisitionStatus.APPROVED,
    mimeType: "text/plain",
    fileSizeBytes: 1024,
    storageKey: "fixtures/alpha.txt",
    contentHash: HASH_ALPHA,
    isPrimary: true,
    retrievedAt: "2026-01-02T00:00:00Z",
    retrievedBy: "synthetic-runner",
    retrievalStatus: "200",
    createdAt: CREATED_AT,
  };
}

/**
 * Two documents, one version each, two provisions on alpha and two chunks on
 * alpha, plus one manifestation.
 */
function buildCorpus(): CorpusState {
  return {
    documents: [
      document("doc-alpha", "Synthetic Alpha Act"),
      document("doc-beta", "Synthetic Beta Regulation"),
    ],
    versions: [
      version("ver-alpha-1", "doc-alpha", HASH_ALPHA, true),
      version("ver-beta-1", "doc-beta", HASH_BETA, false),
    ],
    manifestations: [manifestation("man-alpha-1", "doc-alpha")],
    provisions: [
      {
        id: "prov-alpha-1",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionType: "SECTION",
        label: "Section 1",
        heading: "Synthetic scope",
        text: "Section 1. This synthetic provision states the scope.",
        ordinal: 1,
        legalStatus: LegalStatus.IN_FORCE,
        createdAt: CREATED_AT,
      },
      {
        id: "prov-alpha-2",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionType: "SECTION",
        label: "Section 2",
        heading: null,
        text: "Section 2. This synthetic provision states the rule.",
        ordinal: 2,
        legalStatus: LegalStatus.IN_FORCE,
        createdAt: CREATED_AT,
      },
    ],
    chunks: [
      {
        id: "chunk-alpha-1",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionId: "prov-alpha-1",
        chunkKind: "provision",
        chunkIndex: 0,
        content: "Section 1. This synthetic provision states the scope.",
        tokenCount: 8,
        charStart: 0,
        charEnd: 48,
        pageNumber: 1,
        createdAt: CREATED_AT,
      },
      {
        id: "chunk-alpha-2",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionId: "prov-alpha-2",
        chunkKind: "provision",
        chunkIndex: 1,
        content: "Section 2. This synthetic provision states the rule.",
        tokenCount: 8,
        charStart: 49,
        charEnd: 96,
        pageNumber: 1,
        createdAt: CREATED_AT,
      },
    ],
    relationships: [],
    runs: [],
    pendingRelationships: [],
  };
}

function row<T>(db: SqliteD1Database, sql: string, ...params: unknown[]): T {
  return db.db.prepare(sql).get(...params) as T;
}

function rows<T>(db: SqliteD1Database, sql: string): T[] {
  return db.db.prepare(sql).all() as T[];
}

function counts(db: SqliteD1Database): Record<string, number> {
  const tables = [
    "legal_documents",
    "document_versions",
    "legal_provisions",
    "document_chunks",
    "source_manifestations",
  ];
  const result: Record<string, number> = {};
  for (const table of tables) {
    const record = row<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM ${table}`,
    );
    result[table] = record.count;
  }
  return result;
}

describe("writeCorpusToD1", () => {
  it("writes a corpus and round-trips every column it owns", async () => {
    const db = fresh();
    const report = await writeCorpusToD1(db, buildCorpus());

    expect(report.inserted).toEqual({
      documents: 2,
      versions: 2,
      provisions: 2,
      chunks: 2,
      manifestations: 1,
    });
    expect(report.unchanged).toEqual([]);
    expect(report.conflicts).toEqual([]);

    const storedDocument = row<Record<string, unknown>>(
      db,
      "SELECT * FROM legal_documents WHERE id = ?",
      "doc-alpha",
    );
    expect(storedDocument).toMatchObject({
      document_type: "REPUBLIC_ACT",
      title: "Synthetic Alpha Act",
      short_title: "Synthetic Alpha Act (short)",
      docket_number: null,
      jurisdiction: "PH",
      legal_status: "IN_FORCE",
      verification_status: "VERIFIED",
      authority_level: "official_primary",
      identity_key: "SYNTHETIC:doc-alpha",
      created_at: CREATED_AT,
    });

    const storedVersions = rows<Record<string, unknown>>(
      db,
      "SELECT * FROM document_versions ORDER BY id",
    );
    expect(storedVersions).toMatchObject([
      {
        id: "ver-alpha-1",
        document_id: "doc-alpha",
        version_number: 1,
        content_hash: HASH_ALPHA,
        is_current: 1,
      },
      {
        id: "ver-beta-1",
        document_id: "doc-beta",
        content_hash: HASH_BETA,
        is_current: 0,
      },
    ]);

    const storedProvisions = rows<Record<string, unknown>>(
      db,
      "SELECT * FROM legal_provisions ORDER BY ordinal",
    );
    expect(storedProvisions).toMatchObject([
      {
        id: "prov-alpha-1",
        version_id: "ver-alpha-1",
        label: "Section 1",
        heading: "Synthetic scope",
        ordinal: 1,
        legal_status: "IN_FORCE",
      },
      {
        id: "prov-alpha-2",
        version_id: "ver-alpha-1",
        label: "Section 2",
        heading: null,
        ordinal: 2,
      },
    ]);

    const storedChunks = rows<Record<string, unknown>>(
      db,
      "SELECT * FROM document_chunks ORDER BY chunk_index",
    );
    expect(storedChunks).toMatchObject([
      {
        id: "chunk-alpha-1",
        version_id: "ver-alpha-1",
        provision_id: "prov-alpha-1",
        chunk_kind: "provision",
        chunk_index: 0,
        char_start: 0,
        char_end: 48,
        page_number: 1,
        token_count: 8,
      },
      {
        id: "chunk-alpha-2",
        provision_id: "prov-alpha-2",
        chunk_index: 1,
        char_start: 49,
        char_end: 96,
      },
    ]);

    const storedManifestation = row<Record<string, unknown>>(
      db,
      "SELECT * FROM source_manifestations WHERE id = ?",
      "man-alpha-1",
    );
    expect(storedManifestation).toMatchObject({
      document_id: "doc-alpha",
      source_id: "src-synthetic",
      source_url: "https://example.test/synthetic/alpha",
      authority_level: "official_primary",
      acquisition_status: "Approved",
      file_size_bytes: 1024,
      content_hash: HASH_ALPHA,
      is_primary: 1,
      retrieved_at: "2026-01-02T00:00:00Z",
    });
  });

  it("is idempotent: a second write inserts nothing and changes no row count", async () => {
    const db = fresh();
    const corpus = buildCorpus();
    await writeCorpusToD1(db, corpus);
    const before = counts(db);

    const report = await writeCorpusToD1(db, corpus);

    expect(report.inserted).toEqual({
      documents: 0,
      versions: 0,
      provisions: 0,
      chunks: 0,
      manifestations: 0,
    });
    expect(report.unchanged).toEqual(
      [
        "doc-alpha",
        "doc-beta",
        "ver-alpha-1",
        "ver-beta-1",
        "prov-alpha-1",
        "prov-alpha-2",
        "chunk-alpha-1",
        "chunk-alpha-2",
        "man-alpha-1",
      ].sort(),
    );
    expect(report.conflicts).toEqual([]);
    expect(counts(db)).toEqual(before);
  });

  it("reports a differing document title and leaves the original row intact", async () => {
    const db = fresh();
    await writeCorpusToD1(db, buildCorpus());

    const mutated = buildCorpus();
    mutated.documents[0].title = "Synthetic Alpha Act (rewritten)";
    const report = await writeCorpusToD1(db, mutated);

    expect(report.conflicts).toEqual([
      {
        table: "legal_documents",
        id: "doc-alpha",
        reason: "legal_documents:title_differs",
      },
    ]);
    expect(report.inserted).toEqual({
      documents: 0,
      versions: 0,
      provisions: 0,
      chunks: 0,
      manifestations: 0,
    });
    expect(report.unchanged).not.toContain("doc-alpha");
    expect(report.unchanged).toContain("doc-beta");

    const stored = row<{ title: string }>(
      db,
      "SELECT title FROM legal_documents WHERE id = ?",
      "doc-alpha",
    );
    expect(stored.title).toBe("Synthetic Alpha Act");
  });

  it("reports a differing version content hash and writes nothing", async () => {
    const db = fresh();
    await writeCorpusToD1(db, buildCorpus());
    const before = counts(db);

    const mutated = buildCorpus();
    mutated.versions[1].contentHash =
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const report = await writeCorpusToD1(db, mutated);

    expect(report.conflicts).toEqual([
      {
        table: "document_versions",
        id: "ver-beta-1",
        reason: "document_versions:content_hash_differs",
      },
    ]);
    expect(report.inserted).toEqual({
      documents: 0,
      versions: 0,
      provisions: 0,
      chunks: 0,
      manifestations: 0,
    });
    expect(counts(db)).toEqual(before);

    const stored = row<{ content_hash: string }>(
      db,
      "SELECT content_hash FROM document_versions WHERE id = ?",
      "ver-beta-1",
    );
    expect(stored.content_hash).toBe(HASH_BETA);
  });

  it("stores SQL metacharacters verbatim instead of executing them", async () => {
    const db = fresh();
    const payload = "'); DROP TABLE legal_documents; --";
    const corpus = buildCorpus();
    corpus.documents[0].title = `Synthetic ${payload}`;
    corpus.chunks[0].content = `Chunk ${payload}`;

    const report = await writeCorpusToD1(db, corpus);
    expect(report.inserted.documents).toBe(2);
    expect(report.inserted.chunks).toBe(2);

    const storedTitle = row<{ title: string }>(
      db,
      "SELECT title FROM legal_documents WHERE id = ?",
      "doc-alpha",
    );
    const storedChunk = row<{ content: string }>(
      db,
      "SELECT content FROM document_chunks WHERE id = ?",
      "chunk-alpha-1",
    );
    expect(storedTitle.title).toBe(`Synthetic ${payload}`);
    expect(storedChunk.content).toBe(`Chunk ${payload}`);

    const table = row<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      "legal_documents",
    );
    expect(table.name).toBe("legal_documents");
    expect(counts(db).legal_documents).toBe(2);
  });

  it("inserts in foreign-key order: versions before provisions before chunks", async () => {
    const db = fresh();
    const report = await writeCorpusToD1(db, buildCorpus());

    // The shim runs with PRAGMA foreign_keys = ON, so a successful write with
    // children referencing parents proves the insert order.
    expect(report.conflicts).toEqual([]);
    expect(report.inserted).toEqual({
      documents: 2,
      versions: 2,
      provisions: 2,
      chunks: 2,
      manifestations: 1,
    });

    const provision = row<{ version_id: string }>(
      db,
      "SELECT version_id FROM legal_provisions WHERE id = ?",
      "prov-alpha-1",
    );
    expect(provision.version_id).toBe("ver-alpha-1");
  });

  it("reports a chunk version_id that exists nowhere as an unresolved reference", async () => {
    const db = fresh();
    const corpus = buildCorpus();
    corpus.chunks[0].versionId = "ver-does-not-exist";

    const report = await writeCorpusToD1(db, corpus);

    expect(report.conflicts).toEqual([
      {
        table: "document_chunks",
        id: "chunk-alpha-1",
        reason: "document_chunks:unresolved_reference:version_id",
      },
    ]);
    expect(report.inserted).toEqual(ZERO_INSERTED);
    expect(db.batchCount).toBe(0);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });

  it("throws batch_required before any read when the handle has no batch", async () => {
    const prepared: string[] = [];
    const handle = {
      prepare(query: string) {
        prepared.push(query);
        throw new Error("prepare must not be called");
      },
    } as unknown as D1DatabaseLike;

    await expect(writeCorpusToD1(handle, buildCorpus())).rejects.toThrow(
      "batch_required",
    );
    expect(prepared).toEqual([]);
  });

  it("reports zero inserted counts when the batch throws", async () => {
    const db = fresh();
    db.options.failBatchAt = 1;

    const error = await writeCorpusToD1(db, buildCorpus()).then(
      () => null,
      (caught: unknown) => caught as Error & { report?: CorpusWriteReport },
    );

    expect(error?.message).toBe("injected_batch_failure");
    expect(error?.report?.inserted).toEqual(ZERO_INSERTED);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });

  it("treats a replay with a different options.now as unchanged, not conflicting", async () => {
    const db = fresh();
    const corpus = withoutProvenance(buildCorpus());

    const first = await writeCorpusToD1(db, corpus, {
      now: "2026-01-01T00:00:00Z",
    });
    expect(first.inserted).toEqual({
      documents: 2,
      versions: 2,
      provisions: 2,
      chunks: 2,
      manifestations: 1,
    });

    // A later clock changes the pending created_at/updated_at, but provenance
    // is excluded from equality: the business rows are identical.
    const replay = await writeCorpusToD1(db, corpus, {
      now: "2027-12-31T23:59:59Z",
    });

    expect(replay.inserted).toEqual(ZERO_INSERTED);
    expect(replay.conflicts).toEqual([]);
    expect(replay.unchanged).toEqual(
      [
        "doc-alpha",
        "doc-beta",
        "ver-alpha-1",
        "ver-beta-1",
        "prov-alpha-1",
        "prov-alpha-2",
        "chunk-alpha-1",
        "chunk-alpha-2",
        "man-alpha-1",
      ].sort(),
    );
  });

  it("reports a duplicate id in the corpus and writes nothing", async () => {
    const db = fresh();
    const corpus = buildCorpus();
    corpus.documents.push(
      document("doc-alpha", "Synthetic Alpha Act (duplicate)"),
    );

    const report = await writeCorpusToD1(db, corpus);

    expect(report.conflicts).toEqual([
      {
        table: "legal_documents",
        id: "doc-alpha",
        reason: "legal_documents:duplicate_id_in_corpus",
      },
    ]);
    expect(report.inserted).toEqual(ZERO_INSERTED);
    expect(db.batchCount).toBe(0);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });

  it("reports a missing required retrieved_at and writes nothing", async () => {
    const db = fresh();
    const corpus = buildCorpus();
    delete (corpus.manifestations[0] as { retrievedAt?: string }).retrievedAt;

    const report = await writeCorpusToD1(db, corpus);

    expect(report.conflicts).toEqual([
      {
        table: "source_manifestations",
        id: "man-alpha-1",
        reason: "source_manifestations:missing_required:retrieved_at",
      },
    ]);
    expect(report.inserted).toEqual(ZERO_INSERTED);
    expect(db.batchCount).toBe(0);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });

  it("reports a legal_status outside the migration vocabulary", async () => {
    const db = fresh();
    const corpus = buildCorpus();
    (corpus.documents[0] as { legalStatus: string }).legalStatus = "BOGUS";

    const report = await writeCorpusToD1(db, corpus);

    expect(report.conflicts).toEqual([
      {
        table: "legal_documents",
        id: "doc-alpha",
        reason: "legal_documents:invalid_value:legal_status",
      },
    ]);
    expect(report.inserted).toEqual(ZERO_INSERTED);
    expect(db.batchCount).toBe(0);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });

  it("omits null columns that have a schema default so the default applies", async () => {
    const db = fresh();
    const corpus = withoutProvenance(buildCorpus());
    delete (corpus.documents[0] as { legalStatus?: string }).legalStatus;
    delete (corpus.manifestations[0] as { acquisitionStatus?: string })
      .acquisitionStatus;

    const report = await writeCorpusToD1(db, corpus);

    expect(report.conflicts).toEqual([]);
    expect(report.inserted.documents).toBe(2);
    expect(report.inserted.manifestations).toBe(1);

    const storedDocument = row<Record<string, unknown>>(
      db,
      "SELECT legal_status, created_at, updated_at FROM legal_documents WHERE id = ?",
      "doc-alpha",
    );
    expect(storedDocument).toMatchObject({
      legal_status: "UNKNOWN",
    });
    expect(storedDocument?.created_at).not.toBeNull();
    expect(storedDocument?.updated_at).not.toBeNull();

    const storedManifestation = row<Record<string, unknown>>(
      db,
      "SELECT acquisition_status FROM source_manifestations WHERE id = ?",
      "man-alpha-1",
    );
    expect(storedManifestation?.acquisition_status).toBe("Pending");
  });

  it("reports zeros and writes nothing for an empty corpus", async () => {
    const db = fresh();
    const report = await writeCorpusToD1(db, emptyCorpusState());

    expect(report.inserted).toEqual({
      documents: 0,
      versions: 0,
      provisions: 0,
      chunks: 0,
      manifestations: 0,
    });
    expect(report.unchanged).toEqual([]);
    expect(report.conflicts).toEqual([]);
    expect(db.batchCount).toBe(0);
    expect(counts(db)).toEqual({
      legal_documents: 0,
      document_versions: 0,
      legal_provisions: 0,
      document_chunks: 0,
      source_manifestations: 0,
    });
  });
});
