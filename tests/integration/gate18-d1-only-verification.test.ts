// Gate 18 — verification runs from the database only.
//
// Gate 17 closed the ledger half of the chain: a claim was persisted and layer 4
// read its rows back out of D1. The corpus half was still in memory, and the
// source/target merge that made layer 4 work lived inside that test file.
//
// This test removes both:
//
//   ingest → writeCorpusToD1 → loadCitationCorpusView (D1)
//          → loadStateForMany (D1) → claim → review
//          → createAuthorityStatusLookup(contextDocumentIds) → verify
//
// What is proven here:
//
// - layers 1–3 run over a `CitationCorpusView` that came from
//   `loadCitationCorpusView` and nowhere else. This file never builds that view
//   by hand; the one assignment is typed `CitationCorpusView` so structural drift
//   between `legal-ingestion` and `citation-engine` fails at compile time.
// - layer 4 runs over the snapshot `D1AuthorityStore.loadStateForMany` returns,
//   through the production lookup with `contextDocumentIds`. No test-local
//   authority adapter and no hand-merged snapshot is involved: the source
//   document is in scope because the lookup puts it there.
// - before review the projection abstains and the citation is PARTIALLY_VERIFIED;
//   after a recorded CONFIRMED/ACTIVE review it is DETERMINED, AMENDED and
//   VERIFIED; without the `citation_display` authorization it fails closed.
//
// What is still not:
//
// - no remote D1. The in-memory SQLite shim is supplementary evidence for the
//   SQL, the constraints and the shape; it is not D1 runtime validation and no
//   workerd instance is exercised.
// - no read-time authorization (backlog B-3). `loadCitationCorpusView` returns
//   whatever the database holds; it makes no decision about whether the caller
//   may read it. If the corpus were written without a decision record, a read
//   would reveal it. Authorization is still per (document, activity) at the
//   projection, which is a different question from "may this caller read this".
// - no legal authority for any id. Every id is `SYNTH-*`, every URL is
//   `.invalid`, and no Philippine law is represented or implied.
// - no extraction job, no verification record, no migration change.
//
// Synthetic only: a fixed clock, a fixed as-of date, the in-memory shim and no
// network. The clock is fixed so the ingest, the ledger rows and the projection
// are reproducible.
//
// Guard against accidental in-memory use: `CorpusState` lives only inside
// `beforeAll` and never reaches an `it` body. Its rows are read back from D1
// before anything is verified, and only ids, counts and one chunk span are
// carried out into `Chain`. There is therefore no in-memory corpus a later step
// could be fed from, even by accident. The single deliberate use of the corpus
// after the write is `recordEffectClaim`, which validates its input against the
// corpus it was ingested into and returns ledger records; the claim's evidence
// span is taken from the D1 chunk in `view`, not from `state`.
import { beforeAll, describe, expect, it } from "vitest";
import type {
  AuthorityStatusLookup,
  CitationCorpusView,
} from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import type {
  ArtifactInput,
  AuthoritySnapshot,
  CorpusWriteReport,
  DecisionInput,
  DocumentActivityAuthorization,
  EffectClaimInput,
  EffectClaimRecords,
} from "../../packages/legal-ingestion/src/index";
import {
  ActivityAuthorizationRegistry,
  CorpusStore,
  createAuthorityStatusLookup,
  createRegistryAuthorization,
  D1AuthorityStore,
  deriveReviewId,
  ingestArtifact,
  loadCitationCorpusView,
  recordEffectClaim,
  writeCorpusToD1,
} from "../../packages/legal-ingestion/src/index";
import type { LegalEffectReview } from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

// ---------------------------------------------------------------------------
// Synthetic material
// ---------------------------------------------------------------------------

/** The one synthetic source both artifacts come from, fully authorized. */
const SOURCE_ID = "SYNTH-SOURCE-1";

const FIXED_NOW = "2026-11-16T00:00:00Z";
/** Inside the target version's validity: effective 2025-01-01, no end date. */
const AS_OF = "2026-08-01";
const TARGET_EFFECTIVITY = "2025-01-01";
const SOURCE_EFFECTIVITY = "2025-06-01";

const CLAIMED_DATE = "2025-06-15";
const CLAIMED_EFFECTIVE_DATE = "2025-07-01";
const REVIEW_DECISION_DATE = "2026-06-01";

const TARGET_CITATION = "SYNTH-TARGET-1001";
const SOURCE_CITATION = "SYNTH-SRC-3001";

const SOURCE_IDENTITY_KEY = "SYNTH-SRC-DOC";
const TARGET_IDENTITY_KEY = "SYNTH-TARGET-DOC";

const ANALYST_ID = "SYNTH-ANALYST-1";
const REVIEWER_ID = "SYNTH-REVIEWER-1";

/** The only id this file ever asks the reader for and never writes. */
const NOT_WRITTEN_ID = "SYNTH-NOT-WRITTEN";

const DECISION_FIXTURE = {
  evidenceRef: "synthetic://gate18/authorization-evidence",
  evidenceLocation: "synthetic://gate18/authorization-evidence#activity-table",
  reviewer: "synthetic-reviewer",
  decisionDate: "2026-11-16",
} as const;

/** Every activity this chain needs, recorded once for the one source. */
const CHAIN_ACTIVITIES = [
  "downloading",
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
  "citation_display",
] as const;

/** The same set minus the activity the fail-closed step removes. */
const ACTIVITIES_WITHOUT_DISPLAY = [
  "downloading",
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
] as const;

const SOURCE_CONTENT = [
  "SYNTH-SRC-DOC",
  "",
  "Section 1. The Synthetic Target Registration Act is amended by inserting a new synthetic registration duty.",
  "",
  "Section 2. This synthetic instrument takes effect on its stated effectivity date.",
].join("\n");

const TARGET_CONTENT = [
  "SYNTH-TARGET-DOC",
  "",
  "Section 1. This Act establishes a synthetic registration duty for covered entities.",
  "",
  "Section 2. A covered entity must register with the synthetic authority before it begins operations.",
].join("\n");

/** The amending instrument. */
const SOURCE_ARTIFACT: ArtifactInput = {
  artifactId: "SYNTH-SRC-DOC-v1",
  sourceId: SOURCE_ID,
  sourceUrl: "https://synthetic.invalid/SYNTH-SRC-DOC",
  mimeType: "text/plain",
  retrievedAt: FIXED_NOW,
  // Not flagged synthetic: the Gate 4 activity checks only run on this path.
  // The host is reserved `.invalid` and acquisition performs no request.
  synthetic: false,
  content: SOURCE_CONTENT,
  documentType: "REPUBLIC_ACT",
  identityKey: SOURCE_IDENTITY_KEY,
  title: "Synthetic Source Amendment Act",
  officialNumber: SOURCE_CITATION,
  issuingBody: "Synthetic Congress",
  jurisdiction: "PH",
  promulgationDate: "2025-05-01",
  effectivityDate: SOURCE_EFFECTIVITY,
  legalStatus: "IN_FORCE",
  authorityLevel: "official_primary",
};

/** The instrument the claim says was amended. */
const TARGET_ARTIFACT: ArtifactInput = {
  artifactId: "SYNTH-TARGET-DOC-v1",
  sourceId: SOURCE_ID,
  sourceUrl: "https://synthetic.invalid/SYNTH-TARGET-DOC",
  mimeType: "text/plain",
  retrievedAt: FIXED_NOW,
  synthetic: false,
  content: TARGET_CONTENT,
  documentType: "REPUBLIC_ACT",
  identityKey: TARGET_IDENTITY_KEY,
  title: "Synthetic Target Registration Act",
  officialNumber: TARGET_CITATION,
  issuingBody: "Synthetic Congress",
  jurisdiction: "PH",
  promulgationDate: "2024-12-15",
  effectivityDate: TARGET_EFFECTIVITY,
  legalStatus: "IN_FORCE",
  authorityLevel: "official_primary",
};

const INGEST_OPTIONS = {
  pipelineVersion: "gate18.0.0",
  extractorVersion: "extract.3",
  normalizerVersion: "norm.3",
  enforceActivityAuthorization: true as const,
  acceptedAuthorizationBases: ["SYNTHETIC_FIXTURE"] as const,
  authorizationNow: FIXED_NOW,
  now: () => FIXED_NOW,
};

/**
 * The proposition the citation is offered to support. It is the target's
 * Section 2 body verbatim, so support is decided on the passage itself rather
 * than on a paraphrase a lexical proxy could not judge.
 */
const PROPOSITION =
  "A covered entity must register with the synthetic authority before it begins operations.";

/** One recorded SYNTHETIC_FIXTURE decision for an activity of the source. */
function fixtureDecision(
  activity: DecisionInput["activity"],
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId: SOURCE_ID,
    activity,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    ...DECISION_FIXTURE,
    ...overrides,
  };
}

function registryWith(
  activities: readonly DecisionInput["activity"][],
  sourceId: string = SOURCE_ID,
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const activity of activities)
    registry.record(
      fixtureDecision(activity, { sourceId }),
      "gate18-d1-only",
      "synthetic fixture decision",
      "test",
      FIXED_NOW,
    );
  return registry;
}

/** documentId → sourceId: the one fact the Gate 13 adapter asks its caller for. */
type SourceOfDocument = Readonly<Record<string, string>>;

/**
 * The registry-backed Gate 13 adapter, in the production form. The map it
 * resolves through is a document → source lookup, not a corpus: it carries no
 * text, no version and no effect.
 */
function authorizationOver(
  registry: ActivityAuthorizationRegistry,
  sourceOfDocument: SourceOfDocument,
): DocumentActivityAuthorization {
  return createRegistryAuthorization({
    registry,
    sourceOfDocument: (documentId) => sourceOfDocument[documentId] ?? null,
    now: FIXED_NOW,
  });
}

function ingest(
  store: CorpusStore,
  artifact: ArtifactInput,
  registry: ActivityAuthorizationRegistry,
) {
  return ingestArtifact(store, artifact, {
    ...INGEST_OPTIONS,
    activityAuthorization: registry,
  });
}

interface IngestSummary {
  status: "SUCCEEDED";
  documentId: string;
  versionId: string;
  chunkCount: number;
  provisionCount: number;
  duplicate: boolean;
}

/** Narrow a run to its success fields, or fail the setup loudly. */
function ingestSummary(
  result: ReturnType<typeof ingestArtifact>,
): IngestSummary {
  if (result.status !== "SUCCEEDED")
    throw new Error(`ingest failed: ${result.reason}`);
  return {
    status: result.status,
    // Optional on `IngestOutcome`: a run that succeeded must name both rows,
    // and a run that did not is refused above.
    documentId: notNull(result.documentId, "ingested document id"),
    versionId: notNull(result.versionId, "ingested version id"),
    chunkCount: result.chunkCount,
    provisionCount: result.provisionCount,
    duplicate: result.duplicate,
  };
}

function documentWithKey(
  state: { documents: Array<{ id: string; identityKey?: string | null }> },
  identityKey: string,
) {
  const document = state.documents.find(
    (candidate) => candidate.identityKey === identityKey,
  );
  if (!document) throw new Error(`document ${identityKey} missing`);
  return document;
}

function currentVersionOf(
  state: {
    versions: Array<{
      id: string;
      documentId: string;
      isCurrent: boolean;
      contentHash?: string;
    }>;
  },
  documentId: string,
) {
  const version = state.versions.find(
    (candidate) => candidate.documentId === documentId && candidate.isCurrent,
  );
  if (!version) throw new Error(`no current version for ${documentId}`);
  return version;
}

/**
 * The provision carrying `label` and the chunk built from it, looked up in the
 * D1-backed view. The claim's span is taken from that chunk, so the evidence
 * passage is provably a slice of a D1 row.
 */
function provisionAndChunk(
  view: CitationCorpusView,
  documentId: string,
  label: string,
) {
  const provision = view.provisions.find(
    (candidate) =>
      candidate.documentId === documentId && candidate.label === label,
  );
  if (!provision) throw new Error(`no ${label} provision for ${documentId}`);
  const chunk = view.chunks.find(
    (candidate) => candidate.provisionId === provision.id,
  );
  if (!chunk) throw new Error(`no ${label} chunk for ${documentId}`);
  return { provision, chunk };
}

/** Persist the intake's records in the only order the ledger's keys allow. */
async function persistClaim(
  store: D1AuthorityStore,
  records: EffectClaimRecords,
): Promise<void> {
  if (records.provisionIdentity !== null)
    await store.recordProvisionIdentity(records.provisionIdentity);
  if (records.provisionMapping !== null)
    await store.recordProvisionMapping(records.provisionMapping);
  await store.recordAssertion(records.assertion);
  await store.recordEvidence(records.evidence);
}

/** A review row with a deterministic id derived from its own fields. */
function reviewOf(
  fields: Omit<LegalEffectReview, "id" | "recordedAt">,
  recordedAt: string,
): LegalEffectReview {
  return { id: deriveReviewId(fields), ...fields, recordedAt };
}

function notNull<T>(value: T | null | undefined, what: string): NonNullable<T> {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value as NonNullable<T>;
}

// ---------------------------------------------------------------------------
// D1 reads — SELECTs only. Nothing in this file INSERTs a corpus row.
// ---------------------------------------------------------------------------

const CORPUS_TABLES = [
  "legal_documents",
  "document_versions",
  "legal_provisions",
  "document_chunks",
  "source_manifestations",
] as const;

type CorpusTable = (typeof CORPUS_TABLES)[number];

/** A direct SELECT, used only to check what the writer stored and the reader read. */
function rows<T>(
  db: SqliteD1Database,
  sql: string,
  ...params: Array<string | number | null>
): T[] {
  return db.db.prepare(sql).all(...params) as T[];
}

function countRows(db: SqliteD1Database, table: CorpusTable): number {
  const [row] = rows<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM ${table}`,
  );
  return row?.count ?? -1;
}

function idsIn(db: SqliteD1Database, table: CorpusTable): string[] {
  return rows<{ id: string }>(db, `SELECT id FROM ${table} ORDER BY id`).map(
    (row) => row.id,
  );
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

type VerifyInput = Parameters<
  ReturnType<typeof createCitationVerifier>["verify"]
>[0];

interface IngestedShape {
  documentIds: string[];
  versionIds: string[];
  provisionIds: string[];
  chunkIds: string[];
  counts: CorpusWriteReport["inserted"];
}

interface Chain {
  registry: ActivityAuthorizationRegistry;
  db: SqliteD1Database;
  ledger: D1AuthorityStore;
  report: CorpusWriteReport;
  /** The verifier's layers 1–3 input. Its only source is the D1 reader. */
  view: CitationCorpusView;
  /** The lookup's input, read in both id orders before the claim existed. */
  snapshot: AuthoritySnapshot;
  reverseSnapshot: AuthoritySnapshot;
  sourceOfDocument: SourceOfDocument;
  documentActivityAuthorization: DocumentActivityAuthorization;
  /** The verifier's layer 4 input, built by the production factory. */
  lookup: AuthorityStatusLookup;
  verifier: ReturnType<typeof createCitationVerifier>;
  citation: VerifyInput;
  /** What ingestion produced, as plain values: no corpus row travels here. */
  ingested: IngestedShape;
  runs: IngestSummary[];
  sourceDocumentId: string;
  targetDocumentId: string;
  sourceVersionId: string;
  targetVersionId: string;
  sourceProvisionId: string;
  targetProvisionId: string;
  sourceChunkId: string;
  targetChunkId: string;
  spanStart: number;
  spanEnd: number;
  expectedPassage: string;
  claimInput: EffectClaimInput;
  records: EffectClaimRecords;
  warnings: string[];
  assertionId: string;
  evidenceId: string;
  confirmedReviewId: string | null;
}

describe("Gate 18 — verification reads the corpus and the ledger from D1 only", () => {
  let chain: Chain;

  beforeAll(async () => {
    // 1. Authorize: six SYNTHETIC_FIXTURE decisions for the one source.
    const registry = registryWith(CHAIN_ACTIVITIES);

    // 2. Ingest: both artifacts on the non-synthetic path, so the activity gate
    //    actually runs for downloading's successors.
    const store = CorpusStore.memory();
    const sourceRun = ingestSummary(ingest(store, SOURCE_ARTIFACT, registry));
    const targetRun = ingestSummary(ingest(store, TARGET_ARTIFACT, registry));

    // The corpus exists in memory only until the writer has it. Everything the
    // verification steps consume below is read back from D1; the ids and counts
    // captured here are plain values, and `state` never leaves this function.
    const state = store.state;
    if (state.documents.length !== 2 || state.versions.length !== 2)
      throw new Error("ingestion did not produce the expected corpus shape");

    const sourceDocument = documentWithKey(state, SOURCE_IDENTITY_KEY);
    const targetDocument = documentWithKey(state, TARGET_IDENTITY_KEY);
    const sourceVersion = currentVersionOf(state, sourceDocument.id);
    const targetVersion = currentVersionOf(state, targetDocument.id);

    const ingested: IngestedShape = {
      documentIds: state.documents.map((document) => document.id).sort(),
      versionIds: state.versions.map((version) => version.id).sort(),
      provisionIds: state.provisions.map((provision) => provision.id).sort(),
      chunkIds: state.chunks.map((chunk) => chunk.id).sort(),
      counts: {
        documents: state.documents.length,
        versions: state.versions.length,
        provisions: state.provisions.length,
        chunks: state.chunks.length,
        manifestations: state.manifestations.length,
      },
    };

    // 3. Write: the writer, not a test helper, puts the corpus into D1. This is
    //    the only INSERT into the five corpus tables anywhere in this file.
    const db = new SqliteD1Database();
    db.applyMigrations();
    const report = await writeCorpusToD1(db, state, { now: FIXED_NOW });

    // 4. Layers 1–3: the view comes from D1. The assignment is the compile-time
    //    proof that the reader and the engine agree on the shape.
    const view: CitationCorpusView = await loadCitationCorpusView(db, {
      documentIds: [sourceDocument.id, targetDocument.id],
    });

    // 5. Layer 4: one production call, no per-document merge in this file. Both
    //    orders are read now, before the claim exists, so they must be identical.
    const ledger = new D1AuthorityStore(db);
    const snapshot = await ledger.loadStateForMany([
      sourceDocument.id,
      targetDocument.id,
    ]);
    const reverseSnapshot = await ledger.loadStateForMany([
      targetDocument.id,
      sourceDocument.id,
    ]);

    // 6. Claim: the span is a slice of the D1 chunk in `view`, not of the corpus.
    const source = provisionAndChunk(view, sourceDocument.id, "Section 1");
    const target = provisionAndChunk(view, targetDocument.id, "Section 2");

    const phrase =
      "Synthetic Target Registration Act is amended by inserting a new synthetic registration duty.";
    const spanStart = source.chunk.content.indexOf(phrase);
    if (spanStart < 0)
      throw new Error("span phrase missing from the D1 source chunk");
    const spanEnd = spanStart + phrase.length;

    const claimInput: EffectClaimInput = {
      effectType: "AMENDMENT",
      scope:
        "SYNTH-SRC-DOC Section 1 amends SYNTH-TARGET-DOC Section 2 by inserting a registration duty.",
      source: {
        documentId: sourceDocument.id,
        versionId: sourceVersion.id,
      },
      target: {
        documentId: targetDocument.id,
        provisionLabel: "Section 2",
      },
      claimedDate: CLAIMED_DATE,
      claimedEffectiveDate: CLAIMED_EFFECTIVE_DATE,
      evidence: {
        chunkId: source.chunk.id,
        charStart: spanStart,
        charEnd: spanEnd,
      },
      analyst: { id: ANALYST_ID, recordedAt: FIXED_NOW },
    };

    // The one deliberate use of the in-memory corpus after the write: the intake
    // validates its input against the corpus it was ingested into. It produces
    // ledger records; it never reaches the verifier.
    const claim = recordEffectClaim(state, claimInput);
    if (!claim.ok) throw new Error(`claim refused: ${claim.reason}`);
    await persistClaim(ledger, claim.records);

    // 7. Layer 4 wiring, in the production form: the lookup loads the target and
    //    names the source as context, so no caller merges two snapshots by hand.
    const sourceOfDocument: Record<string, string> = {};
    for (const document of state.documents)
      if (document.sourceId) sourceOfDocument[document.id] = document.sourceId;

    const documentActivityAuthorization = authorizationOver(
      registry,
      sourceOfDocument,
    );
    const lookup = createAuthorityStatusLookup(ledger, {
      activity: "citation_display",
      documentActivityAuthorization,
      contextDocumentIds: [sourceDocument.id],
    });

    // 8. The verifier's corpus is the D1-backed view; its authority is the lookup.
    const verifier = createCitationVerifier(view, { authority: lookup });
    const citation: VerifyInput = {
      citationText: TARGET_CITATION,
      documentId: targetDocument.id,
      passageId: target.chunk.id,
      proposition: PROPOSITION,
      relevantDate: AS_OF,
    };

    chain = {
      registry,
      db,
      ledger,
      report,
      view,
      snapshot,
      reverseSnapshot,
      sourceOfDocument,
      documentActivityAuthorization,
      lookup,
      verifier,
      citation,
      ingested,
      runs: [sourceRun, targetRun],
      sourceDocumentId: sourceDocument.id,
      targetDocumentId: targetDocument.id,
      sourceVersionId: sourceVersion.id,
      targetVersionId: targetVersion.id,
      sourceProvisionId: source.provision.id,
      targetProvisionId: target.provision.id,
      sourceChunkId: source.chunk.id,
      targetChunkId: target.chunk.id,
      spanStart,
      spanEnd,
      expectedPassage: phrase,
      claimInput,
      records: claim.records,
      warnings: claim.warnings,
      assertionId: claim.records.assertion.id,
      evidenceId: claim.records.evidence.id,
      confirmedReviewId: null,
    };
  });

  it("step 1 — every chain activity is authorized for the source on the fixture basis", () => {
    const { registry } = chain;
    expect(registry.history(SOURCE_ID)).toHaveLength(CHAIN_ACTIVITIES.length);
    for (const activity of CHAIN_ACTIVITIES) {
      const decision = registry.latest(SOURCE_ID, activity);
      expect(decision?.status).toBe("AUTHORIZED");
      expect(decision?.basis).toBe("SYNTHETIC_FIXTURE");
      expect(decision?.id).toBe(`auth_${SOURCE_ID}_${activity}_1`);
      expect(
        registry.check(SOURCE_ID, activity, { now: FIXED_NOW }).allowed,
      ).toBe(true);
    }
    expect(registry.latest(SOURCE_ID, "citation_display")?.id).toBe(
      `auth_${SOURCE_ID}_citation_display_1`,
    );
  });

  it("step 2 — both artifacts are ingested on the authorized, non-synthetic path", () => {
    const { runs, ingested, sourceDocumentId, targetDocumentId } = chain;

    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.status)).toEqual(["SUCCEEDED", "SUCCEEDED"]);
    // Both runs succeeded, so the activity gate actually ran rather than being
    // skipped for a `synthetic: true` artifact.
    expect(runs.map((run) => run.duplicate)).toEqual([false, false]);
    expect(runs.map((run) => run.chunkCount)).toEqual([2, 2]);
    expect(runs.map((run) => run.provisionCount)).toEqual([2, 2]);
    expect(runs.map((run) => run.documentId)).toEqual([
      sourceDocumentId,
      targetDocumentId,
    ]);

    // The shape ingestion produced, as plain counts.
    expect(ingested.counts).toEqual({
      documents: 2,
      versions: 2,
      provisions: 4,
      chunks: 4,
      manifestations: 2,
    });
    expect(ingested.documentIds).toHaveLength(2);
    expect(new Set(ingested.documentIds).size).toBe(2);
    expect(ingested.documentIds).toContain(sourceDocumentId);
    expect(ingested.documentIds).toContain(targetDocumentId);
  });

  it("step 3 — the writer inserts the whole corpus once, with no hand-copied extra", () => {
    const { db, report, ingested } = chain;

    // Counts "as produced": the report must agree with the corpus it wrote.
    expect(report.inserted).toEqual(ingested.counts);
    expect(report.inserted).toEqual({
      documents: 2,
      versions: 2,
      provisions: 4,
      chunks: 4,
      manifestations: 2,
    });
    expect(report.unchanged).toEqual([]);
    expect(report.conflicts).toEqual([]);

    // The writer is the only INSERT path in this file, and it ran as one batch.
    expect(db.batchCount).toBe(1);

    // Exactly the ingested ids are present: no helper added a row.
    expect(idsIn(db, "legal_documents")).toEqual(ingested.documentIds);
    expect(idsIn(db, "document_versions")).toEqual(ingested.versionIds);
    expect(idsIn(db, "legal_provisions")).toEqual(ingested.provisionIds);
    expect(idsIn(db, "document_chunks")).toEqual(ingested.chunkIds);
    expect(countRows(db, "legal_documents")).toBe(2);
    expect(countRows(db, "document_versions")).toBe(2);
    expect(countRows(db, "legal_provisions")).toBe(4);
    expect(countRows(db, "document_chunks")).toBe(4);

    // Both named documents are rows in D1, with the identity the fixture set.
    const source = rows<{ identity_key: string; citation_text: string }>(
      db,
      "SELECT identity_key, citation_text FROM legal_documents WHERE id = ?",
      chain.sourceDocumentId,
    );
    expect(source).toEqual([
      { identity_key: SOURCE_IDENTITY_KEY, citation_text: SOURCE_CITATION },
    ]);
    const target = rows<{ identity_key: string; citation_text: string }>(
      db,
      "SELECT identity_key, citation_text FROM legal_documents WHERE id = ?",
      chain.targetDocumentId,
    );
    expect(target).toEqual([
      { identity_key: TARGET_IDENTITY_KEY, citation_text: TARGET_CITATION },
    ]);
  });

  it("step 4 — loadCitationCorpusView reads back every field the verifier consumes", () => {
    const { view, db, ingested, sourceDocumentId, targetDocumentId } = chain;

    // Counts match the ingested corpus, and the ids are exactly D1's.
    expect(view.documents).toHaveLength(2);
    expect(view.versions).toHaveLength(2);
    expect(view.provisions).toHaveLength(4);
    expect(view.chunks).toHaveLength(4);
    expect(view.documents).toHaveLength(ingested.counts.documents);
    expect(view.versions).toHaveLength(ingested.counts.versions);
    expect(view.provisions).toHaveLength(ingested.counts.provisions);
    expect(view.chunks).toHaveLength(ingested.counts.chunks);
    expect(view.documents.map((document) => document.id).sort()).toEqual(
      ingested.documentIds,
    );
    expect(view.versions.map((version) => version.id).sort()).toEqual(
      ingested.versionIds,
    );
    expect(view.provisions.map((provision) => provision.id).sort()).toEqual(
      ingested.provisionIds,
    );
    expect(view.chunks.map((chunk) => chunk.id).sort()).toEqual(
      ingested.chunkIds,
    );

    // Documents: exact values, including the optional fields the reader fills.
    const source = notNull(
      view.documents.find((document) => document.id === sourceDocumentId),
      "source document in the D1 view",
    );
    expect(source).toEqual({
      id: sourceDocumentId,
      title: "Synthetic Source Amendment Act",
      citationText: SOURCE_CITATION,
      docketNumber: null,
      identityKey: SOURCE_IDENTITY_KEY,
      legalStatus: "IN_FORCE",
      effectivityDate: SOURCE_EFFECTIVITY,
      repealDate: null,
      promulgationDate: "2025-05-01",
    });
    const target = notNull(
      view.documents.find((document) => document.id === targetDocumentId),
      "target document in the D1 view",
    );
    expect(target).toEqual({
      id: targetDocumentId,
      title: "Synthetic Target Registration Act",
      citationText: TARGET_CITATION,
      docketNumber: null,
      identityKey: TARGET_IDENTITY_KEY,
      legalStatus: "IN_FORCE",
      effectivityDate: TARGET_EFFECTIVITY,
      repealDate: null,
      promulgationDate: "2024-12-15",
    });

    // Versions: a real boolean from a stored 1, not a truthy coercion.
    const sourceVersion = notNull(
      view.versions.find((version) => version.id === chain.sourceVersionId),
      "source version in the D1 view",
    );
    expect(sourceVersion).toEqual({
      id: chain.sourceVersionId,
      documentId: sourceDocumentId,
      effectiveFrom: SOURCE_EFFECTIVITY,
      effectiveTo: null,
      isCurrent: true,
    });
    expect(typeof sourceVersion.isCurrent).toBe("boolean");
    const [storedVersion] = rows<{
      is_current: number;
      effective_from: string;
    }>(
      db,
      "SELECT is_current, effective_from FROM document_versions WHERE id = ?",
      chain.sourceVersionId,
    );
    expect(storedVersion).toEqual({
      is_current: 1,
      effective_from: SOURCE_EFFECTIVITY,
    });

    // Provisions: the label and text the verifier's location and support layers
    // read, equal to the row D1 holds.
    const targetProvision = notNull(
      view.provisions.find(
        (provision) => provision.id === chain.targetProvisionId,
      ),
      "target Section 2 provision in the D1 view",
    );
    expect(targetProvision).toEqual({
      id: chain.targetProvisionId,
      documentId: targetDocumentId,
      versionId: chain.targetVersionId,
      label: "Section 2",
      text: PROPOSITION,
      legalStatus: "IN_FORCE",
      effectiveFrom: TARGET_EFFECTIVITY,
      effectiveTo: null,
    });
    for (const provision of view.provisions) {
      const [stored] = rows<{
        label: string;
        text: string;
        legal_status: string;
        effective_from: string | null;
        effective_to: string | null;
      }>(
        db,
        `SELECT label, text, legal_status, effective_from, effective_to
           FROM legal_provisions WHERE id = ?`,
        provision.id,
      );
      expect(stored).toEqual({
        label: provision.label,
        text: provision.text,
        legal_status: provision.legalStatus,
        effective_from: provision.effectiveFrom ?? null,
        effective_to: provision.effectiveTo ?? null,
      });
    }

    // Chunks: every content string equals the D1 row's content, read directly.
    for (const chunk of view.chunks) {
      const [stored] = rows<{
        document_id: string;
        version_id: string | null;
        provision_id: string | null;
        content: string;
      }>(
        db,
        `SELECT document_id, version_id, provision_id, content
           FROM document_chunks WHERE id = ?`,
        chunk.id,
      );
      expect(stored).toEqual({
        document_id: chunk.documentId,
        version_id: chunk.versionId ?? null,
        provision_id: chunk.provisionId ?? null,
        content: chunk.content,
      });
    }
    const targetChunk = notNull(
      view.chunks.find((chunk) => chunk.id === chain.targetChunkId),
      "target Section 2 chunk in the D1 view",
    );
    expect(targetChunk.content).toBe(PROPOSITION);
    expect(targetChunk.provisionId).toBe(chain.targetProvisionId);
  });

  it("step 5 — loadStateForMany returns both documents and is order-independent", async () => {
    const {
      snapshot,
      reverseSnapshot,
      sourceDocumentId,
      targetDocumentId,
      sourceVersionId,
      targetVersionId,
      targetProvisionId,
      ingested,
    } = chain;

    // Both documents are present, and their versions and provisions with them.
    expect(snapshot.documents).toHaveLength(2);
    expect(snapshot.documents.map((document) => document.id).sort()).toEqual(
      [sourceDocumentId, targetDocumentId].sort(),
    );
    expect(snapshot.versions).toHaveLength(2);
    expect(snapshot.versions.map((version) => version.id).sort()).toEqual(
      [sourceVersionId, targetVersionId].sort(),
    );
    expect(snapshot.provisions).toHaveLength(4);
    expect(snapshot.provisions.map((provision) => provision.id).sort()).toEqual(
      ingested.provisionIds,
    );

    // Concrete fields: the document identity and the provision the claim names.
    for (const [documentId, title] of [
      [sourceDocumentId, "Synthetic Source Amendment Act"],
      [targetDocumentId, "Synthetic Target Registration Act"],
    ] as const) {
      const document = notNull(
        snapshot.documents.find((row) => row.id === documentId),
        `document ${documentId} in the ledger snapshot`,
      );
      expect(document.documentType).toBe("REPUBLIC_ACT");
      expect(document.title).toBe(title);
    }
    const targetSection2 = notNull(
      snapshot.provisions.find(
        (provision) => provision.id === targetProvisionId,
      ),
      "target Section 2 provision in the ledger snapshot",
    );
    expect(targetSection2).toEqual({
      id: targetProvisionId,
      documentId: targetDocumentId,
      versionId: targetVersionId,
      label: "Section 2",
      text: PROPOSITION,
    });

    // Read before the claim was persisted, so no ledger row is in either answer.
    expect(snapshot.provisionIdentities).toEqual([]);
    expect(snapshot.provisionMappings).toEqual([]);
    expect(snapshot.assertions).toEqual([]);
    expect(snapshot.evidence).toEqual([]);
    expect(snapshot.reviews).toEqual([]);

    // Exact deep equality: the merge sorts, so input order cannot reach output.
    expect(reverseSnapshot).toEqual(snapshot);

    // And a live read after the claim proves the store now carries it, once.
    const now = await chain.ledger.loadStateForMany([
      targetDocumentId,
      sourceDocumentId,
    ]);
    expect(now.assertions.map((row) => row.id)).toEqual([chain.assertionId]);
    expect(now.evidence.map((row) => row.id)).toEqual([chain.evidenceId]);
    expect(now.reviews).toEqual([]);
  });

  it("step 6 — the claim over a D1 chunk is persisted as ledger rows", async () => {
    const {
      ledger,
      db,
      records,
      warnings,
      assertionId,
      evidenceId,
      claimInput,
    } = chain;
    const { assertion, evidence, provisionIdentity, provisionMapping } =
      records;

    expect(warnings).toEqual([]);
    expect(assertion.id).toBe(assertionId);
    expect(assertion.effectType).toBe("AMENDMENT");
    expect(assertion.state).toBe("UNREVIEWED");
    expect(assertion.assertionOrigin).toBe("ANALYST_INTAKE");
    expect(assertion.recordedBy).toBe(ANALYST_ID);
    expect(assertion.recordedAt).toBe(FIXED_NOW);
    expect(assertion.sourceDocumentId).toBe(chain.sourceDocumentId);
    expect(assertion.sourceVersionId).toBe(chain.sourceVersionId);
    expect(assertion.sourceProvisionId).toBeNull();
    expect(assertion.targetDocumentId).toBe(chain.targetDocumentId);
    expect(assertion.targetVersionId).toBe(chain.targetVersionId);
    expect(assertion.claimedDate).toBe(CLAIMED_DATE);
    expect(assertion.claimedEffectiveDate).toBe(CLAIMED_EFFECTIVE_DATE);
    expect(assertion.sourceLocator).toBe(`chunk:${chain.sourceChunkId}`);
    expect(assertion.evidenceId).toBe(evidenceId);

    // Evidence is pinned to the source version's stored hash and to a span of
    // the D1 chunk: the slice of the row equals the recorded passage.
    expect(evidence.id).toBe(evidenceId);
    expect(evidence.assertionId).toBe(assertionId);
    expect(evidence.documentVersionId).toBe(chain.sourceVersionId);
    expect(evidence.passage).toBe(chain.expectedPassage);
    expect(evidence.locator).toBe(`chunk:${chain.sourceChunkId}`);
    expect(evidence.classification).toBe("UNKNOWN");
    expect(evidence.availability).toBe("AVAILABLE");

    const [storedVersion] = rows<{ content_hash: string }>(
      db,
      "SELECT content_hash FROM document_versions WHERE id = ?",
      chain.sourceVersionId,
    );
    expect(evidence.contentHash).toBe(
      notNull(storedVersion, "source version hash").content_hash,
    );
    const [storedChunk] = rows<{ content: string }>(
      db,
      "SELECT content FROM document_chunks WHERE id = ?",
      chain.sourceChunkId,
    );
    expect(
      notNull(storedChunk, "source chunk row").content.slice(
        chain.spanStart,
        chain.spanEnd,
      ),
    ).toBe(evidence.passage);

    // The named target provision resolves, so identity and mapping come back.
    expect(provisionIdentity?.canonicalLabel).toBe("Section 2");
    expect(provisionIdentity?.documentId).toBe(chain.targetDocumentId);
    expect(provisionMapping?.provisionIdentityId).toBe(provisionIdentity?.id);
    expect(provisionMapping?.provisionVersionId).toBe(chain.targetProvisionId);
    expect(provisionMapping?.documentVersionId).toBe(chain.targetVersionId);
    expect(provisionMapping?.mappingType).toBe("SAME");
    expect(provisionMapping?.reviewStatus).toBe("UNREVIEWED");
    expect(assertion.targetProvisionIdentityId).toBe(provisionIdentity?.id);
    expect(claimInput.effectType).toBe("AMENDMENT");

    // Persisted through the store and read back unchanged.
    expect(await ledger.getAssertion(assertionId)).toEqual(assertion);
    const storedEvidence = await ledger.listEvidence(assertionId);
    expect(storedEvidence).toHaveLength(1);
    expect(storedEvidence[0]).toEqual(evidence);
  });

  it("step 7 — the lookup is the production factory with the source as context", async () => {
    const { documentActivityAuthorization, ledger, registry } = chain;

    // The Gate 13 adapter answers for the target from the registry alone.
    const targetDecision = documentActivityAuthorization({
      documentId: chain.targetDocumentId,
      activity: "citation_display",
      role: "TARGET",
      asOf: AS_OF,
    });
    expect(targetDecision).toEqual({
      documentId: chain.targetDocumentId,
      activity: "citation_display",
      role: "TARGET",
      decision: "AUTHORIZED",
      sourceId: SOURCE_ID,
      status: "AUTHORIZED",
      reason: "authorized",
      decisionRef: `auth_${SOURCE_ID}_citation_display_1`,
    });
    expect(registry.latest(SOURCE_ID, "citation_display")?.basis).toBe(
      "SYNTHETIC_FIXTURE",
    );

    // A lookup with no authorization input is a configuration error, refused at
    // construction rather than answered as an abstention on every call.
    expect(() =>
      createAuthorityStatusLookup(ledger, { activity: "citation_display" }),
    ).toThrow("authorization_required");
  });

  it("step 8 — before review: the projection abstains and layer 4 fails", async () => {
    const { lookup, verifier, citation, records } = chain;

    const status = await lookup({
      documentId: chain.targetDocumentId,
      provisionId: notNull(records.provisionMapping, "provision mapping")
        .provisionVersionId,
      asOf: AS_OF,
    });
    expect(status.outcome).toBe("PARTIALLY_DETERMINED");
    expect(status.state).toBe("UNKNOWN");
    expect(status.abstained).toBe(true);
    expect(status.missing).toEqual(["NO_REVIEWED_CONCLUSION"]);
    expect(status.explanation).toBe(
      "Assertions exist but no qualified review is recorded.",
    );
    expect(status.authorizationSource).toBe("document_activity");
    expect(status.versionId).toBeNull();

    const verification = await verifier.verify(citation);
    expect(verification.identityVerified).toBe(true);
    expect(verification.passageVerified).toBe(true);
    expect(verification.propositionSupported).toBe(true);
    expect(verification.supportClass).toBe("DIRECT_QUOTE");
    expect(verification.layerResults.IDENTITY.evidence).toBe(
      "matched Synthetic Target Registration Act",
    );
    expect(verification.layerResults.LOCATION.evidence).toBe("found Section 2");
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(verification.temporalValidity).toBe(false);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(verification.authorityStatus?.outcome).toBe("PARTIALLY_DETERMINED");
    expect(verification.authorityStatus?.state).toBe("UNKNOWN");
    expect(verification.authorityStatus?.abstained).toBe(true);
    expect(verification.authorityStatus?.missing).toEqual([
      "NO_REVIEWED_CONCLUSION",
    ]);
    expect(verification.states ?? []).not.toContain("VERIFIED_TEMPORAL_STATUS");

    // The claim is the only assertion, and it carries no conclusion.
    const fresh = await chain.ledger.loadStateForMany([
      chain.sourceDocumentId,
      chain.targetDocumentId,
    ]);
    expect(fresh.assertions.map((row) => row.id)).toEqual([chain.assertionId]);
    expect(fresh.reviews).toEqual([]);
  });

  it("step 9 — a CONFIRMED/ACTIVE review determines AMENDED and layer 4 passes", async () => {
    const { ledger, records, lookup, verifier, citation, assertionId } = chain;

    const confirmed = reviewOf(
      {
        assertionId,
        outcome: "CONFIRMED",
        reviewerId: REVIEWER_ID,
        reviewerCapacity: "SYNTHETIC",
        decisionDate: REVIEW_DECISION_DATE,
        scope: "SYNTH-TARGET-DOC Section 2",
        propositionReviewed:
          "Section 2 of the synthetic target imposes the registration duty.",
        conditions: [],
        evidenceRefs: [records.evidence.id],
        notes: null,
        supersedesReviewId: null,
        status: "ACTIVE",
      },
      FIXED_NOW,
    );
    await ledger.recordReview(confirmed);
    chain.confirmedReviewId = confirmed.id;

    const reviews = await ledger.listReviews(assertionId);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.id).toBe(confirmed.id);
    expect(reviews[0]?.outcome).toBe("CONFIRMED");
    expect(reviews[0]?.status).toBe("ACTIVE");
    expect(reviews[0]?.evidenceRefs).toEqual([records.evidence.id]);

    const status = await lookup({
      documentId: chain.targetDocumentId,
      provisionId: notNull(records.provisionMapping, "provision mapping")
        .provisionVersionId,
      asOf: AS_OF,
    });
    expect(status.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    // A single reviewed AMENDMENT claim effective before the as-of date.
    expect(status.state).toBe("AMENDED");
    expect(status.abstained).toBe(false);
    expect(status.missing).toEqual([]);
    expect(status.versionId).toBe(chain.targetVersionId);
    expect(status.authorizationSource).toBe("document_activity");

    const verification = await verifier.verify(citation);
    expect(verification.verificationStatus).toBe("VERIFIED");
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
    expect(verification.temporalValidity).toBe(true);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(verification.authorityStatus?.state).toBe("AMENDED");
    expect(verification.authorityStatus?.abstained).toBe(false);
    expect(verification.authorityStatus?.missing).toEqual([]);
    expect(verification.authorityStatus?.versionId).toBe(chain.targetVersionId);
    expect(verification.authorityStatus?.authorizationSource).toBe(
      "document_activity",
    );
    expect(verification.states ?? []).toContain("VERIFIED_TEMPORAL_STATUS");

    // The review that decided it is a D1 row, reloaded by the projection.
    const fresh = await ledger.loadStateForMany([
      chain.sourceDocumentId,
      chain.targetDocumentId,
    ]);
    expect(fresh.reviews.map((review) => review.id)).toEqual([confirmed.id]);
    expect(fresh.evidence.map((row) => row.id)).toEqual([chain.evidenceId]);

    // The context document is load-bearing, not decorative: the same store
    // without it under-loads the snapshot and names the evidence document as
    // absent. That is the merge this test no longer performs by hand.
    const withoutContext = createAuthorityStatusLookup(ledger, {
      activity: "citation_display",
      documentActivityAuthorization: chain.documentActivityAuthorization,
    });
    const underLoaded = await withoutContext({
      documentId: chain.targetDocumentId,
      provisionId: notNull(records.provisionMapping, "provision mapping")
        .provisionVersionId,
      asOf: AS_OF,
    });
    expect(underLoaded.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(underLoaded.state).toBe("UNKNOWN");
    expect(underLoaded.abstained).toBe(true);
    expect(underLoaded.missing).toEqual([
      `EVIDENCE_DOCUMENT_NOT_LOADED:${chain.evidenceId}`,
    ]);
  });

  it("step 10 — without the citation_display decision layer 4 fails closed", async () => {
    const { records, citation, view, db, ingested } = chain;
    const provisionVersionId = notNull(
      records.provisionMapping,
      "provision mapping",
    ).provisionVersionId;

    // The registry is append-only, so the decision is dropped by building a
    // registry that never recorded citation_display for this source: it answers
    // exactly as one whose record was removed.
    const registry = registryWith(ACTIVITIES_WITHOUT_DISPLAY);
    expect(registry.history(SOURCE_ID)).toHaveLength(
      ACTIVITIES_WITHOUT_DISPLAY.length,
    );
    expect(registry.latest(SOURCE_ID, "citation_display")).toBeNull();
    const check = registry.check(SOURCE_ID, "citation_display", {
      now: FIXED_NOW,
    });
    expect(check.allowed).toBe(false);
    expect(check.status).toBe("UNKNOWN");
    expect(check.reason).toBe("no_decision_recorded");

    const documentActivityAuthorization = authorizationOver(
      registry,
      chain.sourceOfDocument,
    );
    // The target's check is NOT_CHECKED, not merely undecided-and-allowed.
    expect(
      documentActivityAuthorization({
        documentId: chain.targetDocumentId,
        activity: "citation_display",
        role: "TARGET",
        asOf: AS_OF,
      }).decision,
    ).toBe("NOT_CHECKED");

    const ledger = new D1AuthorityStore(db);
    const lookup = createAuthorityStatusLookup(ledger, {
      activity: "citation_display",
      documentActivityAuthorization,
      contextDocumentIds: [chain.sourceDocumentId],
    });
    // The view is unchanged: the reader is not where authorization lives.
    const reread = await loadCitationCorpusView(db, {
      documentIds: [chain.sourceDocumentId, chain.targetDocumentId],
    });
    expect(reread).toEqual(view);
    expect(reread.documents).toHaveLength(ingested.counts.documents);

    const status = await lookup({
      documentId: chain.targetDocumentId,
      provisionId: provisionVersionId,
      asOf: AS_OF,
    });
    expect(status.outcome).toBe("UNKNOWN");
    expect(status.state).toBe("UNKNOWN");
    expect(status.abstained).toBe(true);
    expect(status.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    // The activity that was not checked travels with the refusal.
    expect(status.missing).toContain("activity:citation_display");
    expect(status.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(status.versionId).toBeNull();
    expect(status.authorizationSource).toBe("document_activity");

    const verifier = createCitationVerifier(view, { authority: lookup });
    const verification = await verifier.verify(citation);
    expect(verification.identityVerified).toBe(true);
    expect(verification.passageVerified).toBe(true);
    expect(verification.propositionSupported).toBe(true);
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(verification.layerResults.TEMPORAL_VALIDITY.evidence).toBe(
      "UNKNOWN/UNKNOWN: Authorization for this document has not been checked; no determination is projected.",
    );
    expect(verification.temporalValidity).toBe(false);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(verification.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(verification.authorityStatus?.missing).toContain(
      "activity:citation_display",
    );
    expect(verification.states ?? []).not.toContain("VERIFIED_TEMPORAL_STATUS");

    // Fail-closed is about authorization only: the review is still on file.
    expect(await ledger.listReviews(chain.assertionId)).toHaveLength(1);
    expect(chain.confirmedReviewId).not.toBeNull();
  });

  it("step 11 — a requested document that D1 does not hold is refused, not omitted", async () => {
    const { db, targetDocumentId } = chain;

    await expect(
      loadCitationCorpusView(db, {
        documentIds: [targetDocumentId, NOT_WRITTEN_ID],
      }),
    ).rejects.toThrow(`corpus_document_not_found:${NOT_WRITTEN_ID}`);

    // The same call without the unknown id succeeds, so the refusal is caused by
    // the missing row and not by the target document.
    const written = await loadCitationCorpusView(db, {
      documentIds: [targetDocumentId],
    });
    expect(written.documents.map((document) => document.id)).toEqual([
      targetDocumentId,
    ]);
    expect(written.documents[0]?.citationText).toBe(TARGET_CITATION);
  });
});
