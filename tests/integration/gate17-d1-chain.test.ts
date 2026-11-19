// Gate 17 — the last edge: ingest → write → load from D1 → claim → review →
// project → verify, with no hand-built corpus row anywhere.
//
// Gate 16 proved the effect chain, but its `syncCorpusRows` helper copied
// documents, versions and provisions into D1 by hand. This test removes that
// helper: the only writer of the five corpus tables is `writeCorpusToD1`, and
// every corpus record the projection and the verifier consume afterwards is
// read back out of D1 by `D1AuthorityStore.loadStateFor`.
//
// Synthetic only: `SYNTH-*` ids, `.invalid` URLs, a fixed clock, a fixed as-of
// date and the in-memory SQLite shim. No network, no real document, no counsel
// record. The shim is supplementary evidence, not D1 runtime validation.
//
// What is still not wired, stated rather than hidden:
//
// - the citation corpus view (layers 1–3: identity, location, support) is built
//   from the ingested corpus, because no production D1 → `CitationCorpusView`
//   reader exists. Those are ingestion outputs, not hand-built rows, and step 4
//   checks the D1 rows they correspond to. Layer 4, the authority projection,
//   reads D1 only.
// - the registry is append-only, so step 9 "drops" the `citation_display`
//   decision by building the registry from the five remaining activities: a
//   registry that never recorded that activity answers exactly as one whose
//   record was removed. Nothing is deleted from the recorded history.
// - `recordEffectClaim` records a claim, never a review: step 7 asserts the
//   projection abstains until step 8 records one separately.
import { beforeAll, describe, expect, it } from "vitest";
import type {
  AuthorityStatusLookup,
  AuthorityStatusView,
  CitationCorpusView,
} from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import type {
  ArtifactInput,
  AuthoritySnapshot,
  CorpusState,
  CorpusWriteReport,
  DecisionInput,
  DocumentActivityAuthorization,
  EffectClaimInput,
  EffectClaimRecords,
} from "../../packages/legal-ingestion/src/index";
import {
  ActivityAuthorizationRegistry,
  CorpusStore,
  createRegistryAuthorization,
  D1AuthorityStore,
  deriveReviewId,
  ingestArtifact,
  projectAuthorityState,
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

const SOURCE_IDENTITY_KEY = "SYNTH-SRC-DOC";
const TARGET_IDENTITY_KEY = "SYNTH-TARGET-DOC";

const ANALYST_ID = "SYNTH-ANALYST-1";
const REVIEWER_ID = "SYNTH-REVIEWER-1";

const DECISION_FIXTURE = {
  evidenceRef: "synthetic://gate17/authorization-evidence",
  evidenceLocation: "synthetic://gate17/authorization-evidence#activity-table",
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

/** The same set minus the one activity step 9 removes. */
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
  sourceUrl: "synthetic://SYNTH-SRC-DOC",
  mimeType: "text/plain",
  retrievedAt: FIXED_NOW,
  // A fixture, and its locator says so: the Gate 4 activity checks run for it too.
  synthetic: true,
  content: SOURCE_CONTENT,
  documentType: "REPUBLIC_ACT",
  identityKey: SOURCE_IDENTITY_KEY,
  title: "Synthetic Source Amendment Act",
  officialNumber: "SYNTH-SRC-3001",
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
  sourceUrl: "synthetic://SYNTH-TARGET-DOC",
  mimeType: "text/plain",
  retrievedAt: FIXED_NOW,
  synthetic: true,
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
  pipelineVersion: "gate17.0.0",
  extractorVersion: "extract.3",
  normalizerVersion: "norm.3",
  enforceActivityAuthorization: true as const,
  authorizationNow: FIXED_NOW,
  now: () => FIXED_NOW,
};

/**
 * The proposition the citation is offered to support. It is the target's
 * Section 2 body verbatim, so support is decided on the passage itself rather
 * than on a paraphrase that a lexical proxy could not judge.
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
      "gate17-d1-chain",
      "synthetic fixture decision",
      "test",
      FIXED_NOW,
    );
  return registry;
}

/** The registry-backed Gate 13 adapter over the corpus, as a caller wires it. */
function authorizationOver(
  registry: ActivityAuthorizationRegistry,
  state: CorpusState,
): DocumentActivityAuthorization {
  return createRegistryAuthorization({
    registry,
    sourceOfDocument: (documentId) =>
      state.documents.find((document) => document.id === documentId)
        ?.sourceId ?? null,
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

function documentWithKey(state: CorpusState, identityKey: string) {
  const document = state.documents.find(
    (candidate) => candidate.identityKey === identityKey,
  );
  if (!document) throw new Error(`document ${identityKey} missing`);
  return document;
}

function currentVersionOf(state: CorpusState, documentId: string) {
  const version = state.versions.find(
    (candidate) => candidate.documentId === documentId && candidate.isCurrent,
  );
  if (!version) throw new Error(`no current version for ${documentId}`);
  return version;
}

/** The chunk whose provision carries `label`. */
function chunkWithLabel(state: CorpusState, documentId: string, label: string) {
  const chunk = state.chunks.find((candidate) => {
    if (candidate.documentId !== documentId) return false;
    const provision = state.provisions.find(
      (candidateProvision) => candidateProvision.id === candidate.provisionId,
    );
    return provision?.label === label;
  });
  if (!chunk) throw new Error(`no ${label} chunk for ${documentId}`);
  return chunk;
}

/** The verifier's read-only view, built from the ingested corpus records. */
function citationView(state: CorpusState): CitationCorpusView {
  return {
    documents: state.documents.map((document) => ({
      id: document.id,
      title: document.title,
      citationText: document.citationText,
      docketNumber: document.docketNumber,
      identityKey: document.identityKey,
      legalStatus: document.legalStatus,
      effectivityDate: document.effectivityDate,
      repealDate: document.repealDate,
      promulgationDate: document.promulgationDate,
    })),
    versions: state.versions.map((version) => ({
      id: version.id,
      documentId: version.documentId,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      isCurrent: version.isCurrent,
    })),
    provisions: state.provisions.map((provision) => ({
      id: provision.id,
      documentId: provision.documentId,
      versionId: provision.versionId,
      label: provision.label,
      text: provision.text,
      legalStatus: provision.legalStatus,
      effectiveFrom: provision.effectiveFrom,
      effectiveTo: provision.effectiveTo,
    })),
    chunks: state.chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      versionId: chunk.versionId,
      provisionId: chunk.provisionId,
      content: chunk.content,
    })),
  };
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

/** A direct SELECT, used only to check what the writer stored. */
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

/**
 * The projection snapshot a caller builds from D1 alone.
 *
 * `loadStateFor` answers for one document, so a caller that has a source and a
 * target merges the two answers: documents, versions, provisions, identities and
 * mappings from both (deduplicated by id), and the target's assertions,
 * evidence and reviews, which are the rows that describe an effect on it.
 *
 * Nothing here is copied from the corpus or from the intake records: both halves
 * are read back through `D1AuthorityStore`.
 */
async function loadMergedSnapshot(
  db: SqliteD1Database,
  sourceDocumentId: string,
  targetDocumentId: string,
): Promise<AuthoritySnapshot> {
  const store = new D1AuthorityStore(db);
  const source = await store.loadStateFor(sourceDocumentId);
  const target = await store.loadStateFor(targetDocumentId);

  const mergeById = <T extends { id: string }>(...lists: T[][]): T[] => {
    const merged = new Map<string, T>();
    for (const list of lists)
      for (const item of list)
        if (!merged.has(item.id)) merged.set(item.id, item);
    return [...merged.values()];
  };

  return {
    documents: mergeById(source.documents, target.documents),
    versions: mergeById(source.versions, target.versions),
    provisions: mergeById(source.provisions, target.provisions),
    provisionIdentities: mergeById(
      source.provisionIdentities,
      target.provisionIdentities,
    ),
    provisionMappings: mergeById(
      source.provisionMappings,
      target.provisionMappings,
    ),
    assertions: target.assertions,
    evidence: target.evidence,
    reviews: target.reviews,
  };
}

/**
 * The verifier's authority lookup over the merged D1 snapshot.
 *
 * `createAuthorityStatusLookup` takes a `D1AuthorityStore` and therefore one
 * document; this adapter keeps its shape but projects the merged snapshot, so
 * the source document is present when the projection resolves the assertion's
 * source and the evidence's document.
 */
function mergedAuthorityLookup(
  db: SqliteD1Database,
  documentIds: { sourceDocumentId: string; targetDocumentId: string },
  registry: ActivityAuthorizationRegistry,
  state: CorpusState,
): AuthorityStatusLookup {
  const documentActivityAuthorization = authorizationOver(registry, state);
  return async (request) => {
    const snapshot = await loadMergedSnapshot(
      db,
      documentIds.sourceDocumentId,
      documentIds.targetDocumentId,
    );
    const mapping = request.provisionId
      ? snapshot.provisionMappings.find(
          (candidate) => candidate.provisionVersionId === request.provisionId,
        )
      : undefined;
    const projection = projectAuthorityState({
      snapshot,
      documentId: request.documentId,
      provisionIdentityId: mapping ? mapping.provisionIdentityId : undefined,
      asOf: request.asOf,
      activity: "citation_display",
      documentActivityAuthorization,
    });
    const status: AuthorityStatusView = {
      outcome: projection.outcome,
      state: projection.state,
      explanation: projection.explanation,
      abstained: projection.abstained,
      missing: projection.missing,
      versionId: projection.versionId,
      authorizationSource: projection.authorizationSource,
    };
    return status;
  };
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

type VerifyInput = Parameters<
  ReturnType<typeof createCitationVerifier>["verify"]
>[0];

interface Chain {
  registry: ActivityAuthorizationRegistry;
  state: CorpusState;
  db: SqliteD1Database;
  ledger: D1AuthorityStore;
  report: CorpusWriteReport;
  sourceDocumentId: string;
  targetDocumentId: string;
  sourceVersionId: string;
  targetVersionId: string;
  sourceChunkId: string;
  targetChunkId: string;
  spanStart: number;
  spanEnd: number;
  expectedPassage: string;
  claimInput: EffectClaimInput;
  records: EffectClaimRecords;
  warnings: string[];
  assertionId: string;
  merged: AuthoritySnapshot;
  lookup: AuthorityStatusLookup;
  verifier: ReturnType<typeof createCitationVerifier>;
  citation: VerifyInput;
  confirmedReviewId: string | null;
}

describe("Gate 17 — the chain is closed from D1 without any hand-built row", () => {
  let chain: Chain;

  beforeAll(async () => {
    // 1. Authorize: six SYNTHETIC_FIXTURE decisions for the one source.
    const registry = registryWith(CHAIN_ACTIVITIES);

    // 2. Ingest: both artifacts on the non-synthetic path, so the activity
    //    gate actually runs for downloading's successors.
    const store = CorpusStore.memory();
    const sourceIngest = ingest(store, SOURCE_ARTIFACT, registry);
    if (sourceIngest.status !== "SUCCEEDED")
      throw new Error(`source ingest failed: ${sourceIngest.reason}`);
    const targetIngest = ingest(store, TARGET_ARTIFACT, registry);
    if (targetIngest.status !== "SUCCEEDED")
      throw new Error(`target ingest failed: ${targetIngest.reason}`);
    const state = store.state;
    if (state.documents.length !== 2 || state.versions.length !== 2)
      throw new Error("ingestion did not produce the expected corpus shape");

    const sourceDocument = documentWithKey(state, SOURCE_IDENTITY_KEY);
    const targetDocument = documentWithKey(state, TARGET_IDENTITY_KEY);
    const sourceVersion = currentVersionOf(state, sourceDocument.id);
    const targetVersion = currentVersionOf(state, targetDocument.id);
    const sourceChunk = chunkWithLabel(state, sourceDocument.id, "Section 1");
    const targetChunk = chunkWithLabel(state, targetDocument.id, "Section 2");

    // 3. Write: the writer, not a test helper, puts the corpus into D1. This is
    //    the only INSERT into the five corpus tables anywhere in this file.
    const db = new SqliteD1Database();
    db.applyMigrations();
    const report = await writeCorpusToD1(db, state, { now: FIXED_NOW });

    // 4. Read back: the projection's corpus rows come from D1, not the corpus.
    const ledger = new D1AuthorityStore(db);

    // 5. Claim: read a span out of the ingested source chunk.
    const phrase =
      "Synthetic Target Registration Act is amended by inserting a new synthetic registration duty.";
    const spanStart = sourceChunk.content.indexOf(phrase);
    if (spanStart < 0)
      throw new Error("span phrase missing from the ingested source chunk");
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
        chunkId: sourceChunk.id,
        charStart: spanStart,
        charEnd: spanEnd,
      },
      analyst: { id: ANALYST_ID, recordedAt: FIXED_NOW },
    };

    const claim = recordEffectClaim(state, claimInput);
    if (!claim.ok) throw new Error(`claim refused: ${claim.reason}`);
    await persistClaim(ledger, claim.records);

    // 6. Project: the merged snapshot, read from D1 with no review recorded yet.
    const merged = await loadMergedSnapshot(
      db,
      sourceDocument.id,
      targetDocument.id,
    );

    const documentIds = {
      sourceDocumentId: sourceDocument.id,
      targetDocumentId: targetDocument.id,
    };
    const lookup = mergedAuthorityLookup(db, documentIds, registry, state);
    const verifier = createCitationVerifier(citationView(state), {
      authority: lookup,
    });
    const citation: VerifyInput = {
      citationText: TARGET_CITATION,
      documentId: targetDocument.id,
      passageId: targetChunk.id,
      proposition: PROPOSITION,
      relevantDate: AS_OF,
    };

    chain = {
      registry,
      state,
      db,
      ledger,
      report,
      sourceDocumentId: sourceDocument.id,
      targetDocumentId: targetDocument.id,
      sourceVersionId: sourceVersion.id,
      targetVersionId: targetVersion.id,
      sourceChunkId: sourceChunk.id,
      targetChunkId: targetChunk.id,
      spanStart,
      spanEnd,
      expectedPassage: phrase,
      claimInput,
      records: claim.records,
      warnings: claim.warnings,
      assertionId: claim.records.assertion.id,
      merged,
      lookup,
      verifier,
      citation,
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
  });

  it("step 2 — both artifacts are ingested as real corpus rows", () => {
    const { state, sourceDocumentId, targetDocumentId } = chain;
    expect(state.documents).toHaveLength(2);
    expect(state.versions).toHaveLength(2);

    const source = state.documents.find((doc) => doc.id === sourceDocumentId);
    const target = state.documents.find((doc) => doc.id === targetDocumentId);
    expect(source?.identityKey).toBe(SOURCE_IDENTITY_KEY);
    expect(source?.sourceId).toBe(SOURCE_ID);
    expect(target?.identityKey).toBe(TARGET_IDENTITY_KEY);
    expect(target?.citationText).toBe(TARGET_CITATION);

    // Every version is a first version, current, and effective as declared.
    for (const [documentId, effectiveFrom] of [
      [sourceDocumentId, SOURCE_EFFECTIVITY],
      [targetDocumentId, TARGET_EFFECTIVITY],
    ] as const) {
      const versions = state.versions.filter(
        (version) => version.documentId === documentId,
      );
      expect(versions).toHaveLength(1);
      expect(versions[0]?.versionNumber).toBe(1);
      expect(versions[0]?.isCurrent).toBe(true);
      expect(versions[0]?.effectiveFrom).toBe(effectiveFrom);
      expect(versions[0]?.effectiveTo).toBeNull();
    }

    expect(
      state.chunks.filter((chunk) => chunk.documentId === sourceDocumentId),
    ).toHaveLength(2);
    expect(
      state.chunks.filter((chunk) => chunk.documentId === targetDocumentId),
    ).toHaveLength(2);
    // Both runs succeeded on the authorized path, so the gate actually ran.
    expect(state.runs.map((run) => run.status)).toEqual([
      "SUCCEEDED",
      "SUCCEEDED",
    ]);
  });

  it("step 3 — the writer inserts the whole corpus once, with no hand-copied extra", () => {
    const { db, state, report } = chain;

    // Counts "as produced": the report must agree with the corpus it wrote.
    expect(report.inserted).toEqual({
      documents: state.documents.length,
      versions: state.versions.length,
      provisions: state.provisions.length,
      chunks: state.chunks.length,
      manifestations: state.manifestations.length,
    });
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
    expect(idsIn(db, "legal_documents")).toEqual(
      state.documents.map((document) => document.id).sort(),
    );
    expect(idsIn(db, "document_versions")).toEqual(
      state.versions.map((version) => version.id).sort(),
    );
    expect(idsIn(db, "legal_provisions")).toEqual(
      state.provisions.map((provision) => provision.id).sort(),
    );
    expect(idsIn(db, "document_chunks")).toEqual(
      state.chunks.map((chunk) => chunk.id).sort(),
    );
    expect(idsIn(db, "source_manifestations")).toEqual(
      state.manifestations.map((manifestation) => manifestation.id).sort(),
    );

    // A direct SELECT proves the document count, not just the report.
    expect(countRows(db, "legal_documents")).toBe(2);
    expect(countRows(db, "legal_documents")).toBe(report.inserted.documents);
    expect(
      rows<{ id: string }>(db, "SELECT id FROM legal_documents"),
    ).toHaveLength(2);
  });

  it("step 4 — loadStateFor returns the ingested rows, ids and hashes included", async () => {
    const { db, ledger, state, sourceDocumentId, targetDocumentId } = chain;

    // These rows were not copied by any test helper: the only INSERTs into the
    // five corpus tables are the writer's single batch proved in step 3. Every
    // field below therefore travels D1 row → store → snapshot.
    const loadedSource = await ledger.loadStateFor(sourceDocumentId);
    const loadedTarget = await ledger.loadStateFor(targetDocumentId);

    for (const [loaded, documentId, identityKey, citationText] of [
      [loadedSource, sourceDocumentId, SOURCE_IDENTITY_KEY, "SYNTH-SRC-3001"],
      [loadedTarget, targetDocumentId, TARGET_IDENTITY_KEY, TARGET_CITATION],
    ] as const) {
      const ingested = notNull(
        state.documents.find((document) => document.id === documentId),
        `ingested document ${documentId}`,
      );
      const ingestedVersion = notNull(
        state.versions.find((version) => version.documentId === documentId),
        `ingested version for ${documentId}`,
      );

      // Document, exactly as ingested.
      expect(loaded.documents).toEqual([
        {
          id: ingested.id,
          documentType: ingested.documentType,
          title: ingested.title,
        },
      ]);

      // Version identity and span from the ledger view...
      expect(loaded.versions).toEqual([
        {
          id: ingestedVersion.id,
          documentId,
          effectiveFrom: ingestedVersion.effectiveFrom,
          effectiveTo: ingestedVersion.effectiveTo,
        },
      ]);

      // ...and the hash, which the ledger view does not carry, read directly.
      const [storedVersion] = rows<{
        content_hash: string;
        is_current: number;
        version_number: number;
      }>(
        db,
        "SELECT content_hash, is_current, version_number FROM document_versions WHERE id = ?",
        ingestedVersion.id,
      );
      expect(storedVersion?.content_hash).toBe(ingestedVersion.contentHash);
      expect(storedVersion?.is_current).toBe(1);
      expect(storedVersion?.version_number).toBe(1);

      // Provisions: same ids, labels and text as the ingested rows.
      // `loadStateFor` orders provisions by ordinal, then id.
      const ingestedProvisions = state.provisions
        .filter((provision) => provision.documentId === documentId)
        .sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
      expect(ingestedProvisions).toHaveLength(2);
      expect(
        loaded.provisions.map((provision) => ({
          id: provision.id,
          documentId: provision.documentId,
          versionId: provision.versionId,
          label: provision.label,
          text: provision.text,
        })),
      ).toEqual(
        ingestedProvisions.map((provision) => ({
          id: provision.id,
          documentId: provision.documentId,
          versionId: provision.versionId,
          label: provision.label,
          text: provision.text,
        })),
      );

      // The identity fields the verifier's layers 1–3 rely on are D1's too.
      const [storedDocument] = rows<{
        identity_key: string;
        citation_text: string;
        legal_status: string;
      }>(
        db,
        "SELECT identity_key, citation_text, legal_status FROM legal_documents WHERE id = ?",
        documentId,
      );
      expect(storedDocument?.identity_key).toBe(identityKey);
      expect(storedDocument?.citation_text).toBe(citationText);
      expect(storedDocument?.legal_status).toBe("IN_FORCE");
    }

    // The ledger's own views are disjoint per document, as loadStateFor defines.
    expect(loadedSource.documents.map((document) => document.id)).toEqual([
      sourceDocumentId,
    ]);
    expect(loadedTarget.documents.map((document) => document.id)).toEqual([
      targetDocumentId,
    ]);
    expect(loadedSource.provisionIdentities).toEqual([]);
    expect(loadedSource.assertions).toEqual([]);
  });

  it("step 5 — the intake turns an ingested chunk into persisted ledger records", async () => {
    const { ledger, state, records, warnings, assertionId, claimInput } = chain;
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
    expect(assertion.evidenceId).toBe(evidence.id);

    // Evidence is pinned to the source version's stored hash and to a span of
    // the ingested chunk, and that chunk is the row now sitting in D1.
    expect(evidence.assertionId).toBe(assertion.id);
    expect(evidence.documentVersionId).toBe(chain.sourceVersionId);
    expect(evidence.passage).toBe(chain.expectedPassage);
    expect(evidence.locator).toBe(`chunk:${chain.sourceChunkId}`);
    expect(evidence.classification).toBe("UNKNOWN");
    expect(evidence.availability).toBe("AVAILABLE");
    expect(evidence.contentHash).toBe(
      notNull(
        state.versions.find((version) => version.id === chain.sourceVersionId),
        "source version",
      ).contentHash,
    );

    const [storedChunk] = rows<{ content: string }>(
      chain.db,
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
    expect(provisionMapping?.reviewStatus).toBe("UNREVIEWED");
    expect(assertion.targetProvisionIdentityId).toBe(provisionIdentity?.id);
    expect(claimInput.effectType).toBe("AMENDMENT");

    // Persisted through the store and read back unchanged.
    expect(await ledger.getAssertion(assertionId)).toEqual(assertion);
    const storedEvidence = await ledger.listEvidence(assertionId);
    expect(storedEvidence).toHaveLength(1);
    expect(storedEvidence[0]).toEqual(evidence);

    const targetState = await ledger.loadStateFor(chain.targetDocumentId);
    expect(targetState.provisionIdentities.map((row) => row.id)).toEqual([
      notNull(provisionIdentity, "provision identity").id,
    ]);
    expect(targetState.provisionMappings.map((row) => row.id)).toEqual([
      notNull(provisionMapping, "provision mapping").id,
    ]);
    expect(targetState.reviews).toEqual([]);
  });

  it("step 6 — the merged D1 snapshot holds both documents, so both gates can run", async () => {
    const { merged, state, records, assertionId } = chain;

    // Both halves came from loadStateFor, so both documents are present.
    expect(merged.documents.map((document) => document.id).sort()).toEqual(
      [chain.sourceDocumentId, chain.targetDocumentId].sort(),
    );
    expect(merged.documents).toHaveLength(2);

    // Their versions and provisions merged without loss or duplication.
    expect(merged.versions.map((version) => version.id).sort()).toEqual(
      state.versions.map((version) => version.id).sort(),
    );
    expect(merged.versions).toHaveLength(2);
    expect(merged.provisions.map((provision) => provision.id).sort()).toEqual(
      state.provisions.map((provision) => provision.id).sort(),
    );
    expect(merged.provisions).toHaveLength(4);

    // The target's claim rows, and only those.
    expect(merged.provisionIdentities.map((row) => row.id)).toEqual([
      notNull(records.provisionIdentity, "provision identity").id,
    ]);
    expect(merged.provisionMappings.map((row) => row.id)).toEqual([
      notNull(records.provisionMapping, "provision mapping").id,
    ]);
    expect(merged.assertions.map((row) => row.id)).toEqual([assertionId]);
    expect(merged.evidence.map((row) => row.id)).toEqual([records.evidence.id]);
    expect(merged.reviews).toEqual([]);

    // The source version an evidence row points at resolves inside the snapshot,
    // which is what lets the projection authorize the evidence's document.
    const evidenceVersion = notNull(
      merged.versions.find(
        (version) => version.id === records.evidence.documentVersionId,
      ),
      "evidence version in the merged snapshot",
    );
    expect(evidenceVersion.documentId).toBe(chain.sourceDocumentId);
    expect(
      merged.documents.some(
        (document) => document.id === evidenceVersion.documentId,
      ),
    ).toBe(true);
  });

  it("step 7 — no review yet: the projection abstains and layer 4 fails", async () => {
    const { lookup, verifier, citation, records, assertionId } = chain;

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

    // The claim is still the only assertion, and it carries no conclusion.
    const fresh = await loadMergedSnapshot(
      chain.db,
      chain.sourceDocumentId,
      chain.targetDocumentId,
    );
    expect(fresh.assertions.map((row) => row.id)).toEqual([assertionId]);
    expect(fresh.reviews).toEqual([]);
  });

  it("step 8 — a CONFIRMED/ACTIVE review determines AMENDED and layer 4 passes", async () => {
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
    const fresh = await loadMergedSnapshot(
      chain.db,
      chain.sourceDocumentId,
      chain.targetDocumentId,
    );
    expect(fresh.reviews.map((review) => review.id)).toEqual([confirmed.id]);
    expect(fresh.evidence.map((row) => row.id)).toEqual([records.evidence.id]);
  });

  it("step 9 — dropping the citation_display decision fails layer 4 closed", async () => {
    const { records, citation, state, db } = chain;

    // The registry is append-only, so the decision is dropped by building a
    // registry that never recorded citation_display for this source. The check
    // below is what a registry with the record removed answers: not decided.
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

    const lookup = mergedAuthorityLookup(
      db,
      {
        sourceDocumentId: chain.sourceDocumentId,
        targetDocumentId: chain.targetDocumentId,
      },
      registry,
      state,
    );
    const verifier = createCitationVerifier(citationView(state), {
      authority: lookup,
    });

    const status = await lookup({
      documentId: chain.targetDocumentId,
      provisionId: notNull(records.provisionMapping, "provision mapping")
        .provisionVersionId,
      asOf: AS_OF,
    });
    expect(status.outcome).toBe("UNKNOWN");
    expect(status.state).toBe("UNKNOWN");
    expect(status.abstained).toBe(true);
    expect(status.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    // The activity that was not checked travels with the refusal.
    expect(status.missing).toContain("activity:citation_display");
    expect(status.versionId).toBeNull();
    expect(status.authorizationSource).toBe("document_activity");

    const verification = await verifier.verify(citation);
    expect(verification.identityVerified).toBe(true);
    expect(verification.passageVerified).toBe(true);
    expect(verification.propositionSupported).toBe(true);
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(verification.temporalValidity).toBe(false);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(verification.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(verification.authorityStatus?.state).toBe("UNKNOWN");
    expect(verification.authorityStatus?.missing).toContain(
      "activity:citation_display",
    );
    expect(verification.states ?? []).not.toContain("VERIFIED_TEMPORAL_STATUS");

    // Fail-closed is about authorization only: the review is still on file.
    expect(await chain.ledger.listReviews(chain.assertionId)).toHaveLength(1);
  });
});
