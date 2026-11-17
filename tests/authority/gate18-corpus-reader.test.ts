// Gate 18 — read-only corpus reader against the SQLite shim.
// Supplementary evidence only: this is NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import type {
  CorpusState,
  D1DatabaseLike,
} from "../../packages/legal-ingestion/src/index";
import {
  D1AuthorityStore,
  loadCitationCorpusView,
  writeCorpusToD1,
} from "../../packages/legal-ingestion/src/index";
import type {
  DocumentVersion,
  LegalDocument,
} from "../../packages/legal-schema/src/index";
import {
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

const EMPTY_SNAPSHOT = {
  documents: [],
  versions: [],
  provisions: [],
  chunks: [],
};

function fresh(): SqliteD1Database {
  const db = new SqliteD1Database();
  db.applyMigrations();
  return db;
}

function document(
  id: string,
  title: string,
  citationText: string,
  docketNumber: string | null,
): LegalDocument {
  return {
    id,
    documentType: DocumentType.REPUBLIC_ACT,
    title,
    shortTitle: `${title} (short)`,
    citationText,
    docketNumber,
    issuingBody: "Synthetic Legislature",
    jurisdiction: "PH",
    promulgationDate: "2026-01-01",
    effectivityDate: "2026-01-15",
    repealDate: null,
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
  effectiveTo: string | null,
): DocumentVersion {
  return {
    id,
    documentId,
    versionNumber: 1,
    versionLabel: "Original",
    contentHash,
    effectiveFrom: "2026-01-15",
    effectiveTo,
    isCurrent,
    createdAt: CREATED_AT,
  };
}

/**
 * Two documents, one version each, three provisions and three chunks, all
 * written through `writeCorpusToD1` so the rows are exactly the ones a real
 * ingest produces.
 */
function buildCorpus(): CorpusState {
  return {
    documents: [
      document(
        "doc-alpha",
        "Synthetic Alpha Act",
        "SYNTH-ACT-0001",
        "G.R. No. 000001",
      ),
      document("doc-beta", "Synthetic Beta Regulation", "SYNTH-REG-0002", null),
    ],
    versions: [
      version("ver-alpha-1", "doc-alpha", HASH_ALPHA, true, null),
      version("ver-beta-1", "doc-beta", HASH_BETA, false, "2026-06-30"),
    ],
    manifestations: [],
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
        effectiveFrom: "2026-01-15",
        effectiveTo: null,
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
        legalStatus: LegalStatus.AMENDED,
        effectiveFrom: "2026-01-15",
        effectiveTo: "2026-06-30",
        createdAt: CREATED_AT,
      },
      {
        id: "prov-beta-1",
        documentId: "doc-beta",
        versionId: "ver-beta-1",
        provisionType: "SECTION",
        label: "Section 1",
        heading: null,
        text: "Section 1. This synthetic regulation states the duty.",
        ordinal: 1,
        legalStatus: LegalStatus.REPEALED,
        effectiveFrom: "2026-01-15",
        effectiveTo: "2026-06-30",
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
      {
        id: "chunk-beta-1",
        documentId: "doc-beta",
        versionId: "ver-beta-1",
        provisionId: "prov-beta-1",
        chunkKind: "provision",
        chunkIndex: 0,
        content: "Section 1. This synthetic regulation states the duty.",
        tokenCount: 8,
        charStart: 0,
        charEnd: 50,
        pageNumber: 1,
        createdAt: CREATED_AT,
      },
    ],
    relationships: [],
    runs: [],
    pendingRelationships: [],
  };
}

async function seeded(): Promise<SqliteD1Database> {
  const db = fresh();
  const report = await writeCorpusToD1(db, buildCorpus());
  expect(report.conflicts).toEqual([]);
  expect(report.inserted.documents).toBe(2);
  return db;
}

/** Count `prepare` calls so "issues no query" is observable, not inferred. */
function counted(db: SqliteD1Database): {
  db: D1DatabaseLike;
  prepareCalls: () => number;
} {
  let calls = 0;
  const wrapped: D1DatabaseLike = {
    prepare(query) {
      calls += 1;
      return db.prepare(query);
    },
    batch(statements) {
      return db.batch(statements);
    },
  };
  return { db: wrapped, prepareCalls: () => calls };
}

const ASSERTION_A1 = {
  id: "a1",
  effectType: "PARTIAL_AMENDMENT" as const,
  sourceDocumentId: "doc-alpha",
  sourceVersionId: "ver-alpha-1",
  sourceProvisionId: "prov-alpha-1",
  targetDocumentId: "doc-alpha",
  targetProvisionIdentityId: null,
  targetVersionId: "ver-alpha-1",
  scope: "Section 1",
  claimedDate: "2026-06-15",
  claimedEffectiveDate: "2026-07-01",
  evidenceId: "ev1",
  sourceLocator: "Section 1",
  assertionOrigin: "synthetic-seed",
  recordedAt: "2026-06-16T00:00:00Z",
  recordedBy: "synthetic-registrar",
  state: "PENDING_REVIEW" as const,
  supersedesAssertionId: null,
  conflictGroupId: null,
};

const ASSERTION_A2 = {
  ...ASSERTION_A1,
  id: "a2",
  effectType: "REPEAL" as const,
  sourceDocumentId: "doc-beta",
  sourceVersionId: "ver-beta-1",
  sourceProvisionId: "prov-beta-1",
  targetDocumentId: "doc-beta",
  targetProvisionIdentityId: null,
  targetVersionId: "ver-beta-1",
  scope: "Section 1",
  claimedDate: "2026-09-01",
  claimedEffectiveDate: "2026-10-01",
  evidenceId: "ev2",
  state: "UNREVIEWED" as const,
  supersedesAssertionId: "a1",
};

/** Two assertions, a2 targeting doc-beta and superseding a1 on doc-alpha. */
async function seedAuthority(store: D1AuthorityStore): Promise<void> {
  await store.recordAssertion(ASSERTION_A1);
  await store.recordEvidence({
    id: "ev1",
    assertionId: "a1",
    documentVersionId: "ver-alpha-1",
    provisionVersionId: "prov-alpha-1",
    artifactId: null,
    contentHash: HASH_ALPHA,
    passage: "Synthetic amending passage.",
    locator: "Section 1",
    evidenceDate: "2026-06-15",
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
    checkedAt: "2026-06-16T00:00:00Z",
  });
  await store.recordReview({
    id: "r1",
    assertionId: "a1",
    outcome: "CONFIRMED",
    reviewerId: "counsel-1",
    reviewerCapacity: "Counsel",
    decisionDate: "2026-07-15",
    scope: "Section 1",
    propositionReviewed: "Section 1 is partially amended.",
    conditions: [],
    evidenceRefs: ["ev1"],
    notes: null,
    supersedesReviewId: null,
    status: "ACTIVE",
    recordedAt: "2026-07-15T00:00:00Z",
  });

  await store.recordAssertion(ASSERTION_A2);
  await store.recordEvidence({
    id: "ev2",
    assertionId: "a2",
    documentVersionId: "ver-beta-1",
    provisionVersionId: "prov-beta-1",
    artifactId: null,
    contentHash: HASH_BETA,
    passage: "Synthetic repealing passage.",
    locator: "Section 1",
    evidenceDate: "2026-09-01",
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
    checkedAt: "2026-09-02T00:00:00Z",
  });
  await store.recordReview({
    id: "r2",
    assertionId: "a2",
    outcome: "CONFIRMED",
    reviewerId: "counsel-1",
    reviewerCapacity: "Counsel",
    decisionDate: "2026-09-15",
    scope: "Section 1",
    propositionReviewed: "Section 1 is repealed.",
    conditions: [],
    evidenceRefs: ["ev2"],
    notes: null,
    supersedesReviewId: null,
    status: "ACTIVE",
    recordedAt: "2026-09-15T00:00:00Z",
  });
}

describe("loadCitationCorpusView", () => {
  it("is structurally compatible with CitationCorpusView and round-trips every field", async () => {
    const db = await seeded();

    // The assignment is the compatibility proof: legal-ingestion declares its
    // own interfaces, and any drift from the engine's view fails to compile.
    const view: CitationCorpusView = await loadCitationCorpusView(db);

    expect(view.documents).toEqual([
      {
        id: "doc-alpha",
        title: "Synthetic Alpha Act",
        citationText: "SYNTH-ACT-0001",
        docketNumber: "G.R. No. 000001",
        identityKey: "SYNTHETIC:doc-alpha",
        legalStatus: "IN_FORCE",
        effectivityDate: "2026-01-15",
        repealDate: null,
        promulgationDate: "2026-01-01",
      },
      {
        id: "doc-beta",
        title: "Synthetic Beta Regulation",
        citationText: "SYNTH-REG-0002",
        docketNumber: null,
        identityKey: "SYNTHETIC:doc-beta",
        legalStatus: "IN_FORCE",
        effectivityDate: "2026-01-15",
        repealDate: null,
        promulgationDate: "2026-01-01",
      },
    ]);

    expect(view.versions).toEqual([
      {
        id: "ver-alpha-1",
        documentId: "doc-alpha",
        effectiveFrom: "2026-01-15",
        effectiveTo: null,
        isCurrent: true,
      },
      {
        id: "ver-beta-1",
        documentId: "doc-beta",
        effectiveFrom: "2026-01-15",
        effectiveTo: "2026-06-30",
        isCurrent: false,
      },
    ]);
    expect(typeof view.versions[0].isCurrent).toBe("boolean");

    expect(view.provisions).toEqual([
      {
        id: "prov-alpha-1",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        label: "Section 1",
        text: "Section 1. This synthetic provision states the scope.",
        legalStatus: "IN_FORCE",
        effectiveFrom: "2026-01-15",
        effectiveTo: null,
      },
      {
        id: "prov-alpha-2",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        label: "Section 2",
        text: "Section 2. This synthetic provision states the rule.",
        legalStatus: "AMENDED",
        effectiveFrom: "2026-01-15",
        effectiveTo: "2026-06-30",
      },
      {
        id: "prov-beta-1",
        documentId: "doc-beta",
        versionId: "ver-beta-1",
        label: "Section 1",
        text: "Section 1. This synthetic regulation states the duty.",
        legalStatus: "REPEALED",
        effectiveFrom: "2026-01-15",
        effectiveTo: "2026-06-30",
      },
    ]);

    expect(view.chunks).toEqual([
      {
        id: "chunk-alpha-1",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionId: "prov-alpha-1",
        content: "Section 1. This synthetic provision states the scope.",
      },
      {
        id: "chunk-alpha-2",
        documentId: "doc-alpha",
        versionId: "ver-alpha-1",
        provisionId: "prov-alpha-2",
        content: "Section 2. This synthetic provision states the rule.",
      },
      {
        id: "chunk-beta-1",
        documentId: "doc-beta",
        versionId: "ver-beta-1",
        provisionId: "prov-beta-1",
        content: "Section 1. This synthetic regulation states the duty.",
      },
    ]);
  });

  it("filters to the requested documents and loads both when both are asked for", async () => {
    const db = await seeded();

    const alphaOnly = await loadCitationCorpusView(db, {
      documentIds: ["doc-alpha"],
    });
    expect(alphaOnly.documents.map((row) => row.id)).toEqual(["doc-alpha"]);
    expect(alphaOnly.versions.map((row) => row.id)).toEqual(["ver-alpha-1"]);
    expect(alphaOnly.provisions.map((row) => row.id)).toEqual([
      "prov-alpha-1",
      "prov-alpha-2",
    ]);
    expect(alphaOnly.chunks.map((row) => row.id)).toEqual([
      "chunk-alpha-1",
      "chunk-alpha-2",
    ]);

    const both = await loadCitationCorpusView(db, {
      documentIds: ["doc-alpha", "doc-beta"],
    });
    expect(both.documents.map((row) => row.id)).toEqual([
      "doc-alpha",
      "doc-beta",
    ]);
    expect(both.versions.map((row) => row.id)).toEqual([
      "ver-alpha-1",
      "ver-beta-1",
    ]);
    expect(both.chunks.map((row) => row.id)).toEqual([
      "chunk-alpha-1",
      "chunk-alpha-2",
      "chunk-beta-1",
    ]);
  });

  it("returns an empty snapshot for [] without issuing a query", async () => {
    const seededDb = await seeded();
    const { db, prepareCalls } = counted(seededDb);

    const view = await loadCitationCorpusView(db, { documentIds: [] });

    expect(view).toEqual(EMPTY_SNAPSHOT);
    expect(prepareCalls()).toBe(0);
  });

  it("refuses an unknown document id instead of omitting it", async () => {
    const db = await seeded();

    await expect(
      loadCitationCorpusView(db, { documentIds: ["doc-alpha", "doc-ghost"] }),
    ).rejects.toThrow("corpus_document_not_found:doc-ghost");
    await expect(
      loadCitationCorpusView(db, { documentIds: ["doc-ghost"] }),
    ).rejects.toThrow("corpus_document_not_found:doc-ghost");
  });

  it("refuses a version row whose is_current is neither 1 nor 0", async () => {
    const db = await seeded();

    // The writer refuses this row, and migration 0001's CHECK would too, so the
    // row is written with that one constraint suppressed: the reader must still
    // refuse it. This guards against silent coercion — treating a stored 2 as
    // truthy would report a version as current that the database never marked
    // current, which the temporal layer would then trust.
    //
    // This is the single sanctioned raw-SQL write in this file. Every corpus row
    // the other tests read is seeded through `writeCorpusToD1`, never by hand.
    db.db.exec("PRAGMA ignore_check_constraints = ON");
    try {
      db.db
        .prepare(
          `INSERT INTO document_versions
            (id, document_id, version_number, content_hash, effective_from,
             is_current)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("ver-alpha-corrupt", "doc-alpha", 2, HASH_ALPHA, "2026-02-01", 2);
    } finally {
      db.db.exec("PRAGMA ignore_check_constraints = OFF");
    }

    await expect(loadCitationCorpusView(db)).rejects.toThrow(
      "invalid_corpus_row:document_versions:ver-alpha-corrupt:is_current",
    );
  });

  it("is deterministic regardless of the order documentIds are given in", async () => {
    const db = await seeded();

    const forward = await loadCitationCorpusView(db, {
      documentIds: ["doc-alpha", "doc-beta"],
    });
    const reversed = await loadCitationCorpusView(db, {
      documentIds: ["doc-beta", "doc-alpha"],
    });

    expect(reversed).toEqual(forward);
  });
});

describe("D1AuthorityStore.loadStateForMany", () => {
  it("loads both documents and merges a superseding assertion exactly once", async () => {
    const db = await seeded();
    const store = new D1AuthorityStore(db);
    await seedAuthority(store);

    const snapshot = await store.loadStateForMany(["doc-alpha", "doc-beta"]);

    expect(snapshot.documents.map((row) => row.id)).toEqual([
      "doc-alpha",
      "doc-beta",
    ]);
    expect(snapshot.versions.map((row) => row.id)).toEqual([
      "ver-alpha-1",
      "ver-beta-1",
    ]);
    expect(snapshot.provisions.map((row) => row.id)).toEqual([
      "prov-alpha-1",
      "prov-alpha-2",
      "prov-beta-1",
    ]);
    // a1 targets doc-alpha; a2 targets doc-beta and supersedes a1, so both
    // documents' answers contain a2. It must appear once, not twice.
    expect(snapshot.assertions.map((row) => row.id)).toEqual(["a1", "a2"]);
    expect(snapshot.assertions.filter((row) => row.id === "a2")).toHaveLength(
      1,
    );
    expect(snapshot.evidence.map((row) => row.id)).toEqual(["ev1", "ev2"]);
    expect(snapshot.reviews.map((row) => row.id)).toEqual(["r1", "r2"]);
  });

  it("is exact-equal when the input order is reversed", async () => {
    const db = await seeded();
    const store = new D1AuthorityStore(db);
    await seedAuthority(store);

    const forward = await store.loadStateForMany(["doc-alpha", "doc-beta"]);
    const reversed = await store.loadStateForMany(["doc-beta", "doc-alpha"]);

    // Exact deep equality: the merged snapshot is sorted, so input order cannot
    // reach the output.
    expect(reversed).toEqual(forward);
  });

  it("returns the empty snapshot for an empty input", async () => {
    const db = await seeded();
    const store = new D1AuthorityStore(db);
    await seedAuthority(store);

    const empty = await store.loadStateForMany([]);

    expect(empty).toEqual(await store.loadStateFor("doc-not-here"));
    expect(empty).toEqual({
      documents: [],
      versions: [],
      provisions: [],
      provisionIdentities: [],
      provisionMappings: [],
      assertions: [],
      evidence: [],
      reviews: [],
    });
  });

  it("lets an unknown id contribute nothing while the real ones still load", async () => {
    const db = await seeded();
    const store = new D1AuthorityStore(db);
    await seedAuthority(store);

    const snapshot = await store.loadStateForMany(["doc-ghost", "doc-alpha"]);

    expect(snapshot.documents.map((row) => row.id)).toEqual(["doc-alpha"]);
    expect(snapshot.versions.map((row) => row.id)).toEqual(["ver-alpha-1"]);
    expect(snapshot.provisions.map((row) => row.id)).toEqual([
      "prov-alpha-1",
      "prov-alpha-2",
    ]);
    expect(snapshot.assertions.map((row) => row.id)).toEqual(["a1", "a2"]);
  });
});
