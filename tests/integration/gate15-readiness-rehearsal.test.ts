// Gate 15 — end-to-end readiness rehearsal: authorise → acquire → ingest →
// extract → index → retrieve → verify, on synthetic material only.
//
// Every fixture is fictional. No Philippine law, counsel record or authorization
// cell is represented, changed or implied. The SQLite shim is supplementary
// evidence, not D1 runtime validation.
//
// The chain is exercised with the real classes — ActivityAuthorizationRegistry,
// the Gate 13 registry adapter, CorpusStore, buildSearchIndex/retrieve,
// D1AuthorityStore and the citation verifier — so a green run means those pieces
// interoperate on synthetic material. It does NOT mean the whole path is wired:
//
// - ingestion produces documents, versions and chunks but does not write the
//   authority ledger; the assertion, evidence and review verified here are seeded
//   separately, as an analysis step would record them. See 01_RESULTS.md §3.1.
// - `retrieve` performs no activity check; `citation_display` is enforced only
//   when a citation is verified, after the passage has been returned.
// - a synthetic artifact runs the same activity checks as any other (Gate 19),
//   so both fixtures carry their own fixture ingestion decisions.
// - acquisition is the manifest gate, not a transport; no network call is made.
//
// Those gaps are the rehearsal's findings, not its premises.
import { beforeAll, describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  ActivityAuthorizationRegistry,
  type ArtifactInput,
  type AuthorityLookupOptions,
  buildAcquisitionRecord,
  type CorpusState,
  CorpusStore,
  createAuthorityStatusLookup,
  createRegistryAuthorization,
  D1AuthorityStore,
  type DecisionInput,
  type DocumentActivityAuthorization,
  ingestArtifact,
  type ProjectionRequest,
  projectAuthorityState,
  sha256,
} from "../../packages/legal-ingestion/src/index";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "../../packages/legal-schema/src/index";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

// ---------------------------------------------------------------------------
// Synthetic material
// ---------------------------------------------------------------------------

const PRIMARY_SOURCE_ID = "synthetic_fixture";
/**
 * A second synthetic source with no decisions in the rehearsal registry — the
 * "other" document. Its fixture ingestion authorizations are recorded on a
 * separate registry so the rehearsal registry stays primary-only.
 */
const UNREGISTERED_SOURCE_ID = "synthetic_fixture_unregistered";

const FIXED_NOW = "2026-11-16T00:00:00Z";
const AS_OF = "2026-08-01";
const EFFECTIVE_FROM = "2025-01-01";

const INGEST_ACTIVITIES = [
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
] as const;

/** The activities this rehearsal records as authorized for the source. */
const REHEARSAL_ACTIVITIES = [
  "downloading",
  ...INGEST_ACTIVITIES,
  "citation_display",
] as const;

const DECISION_FIXTURE = {
  evidenceRef: "synthetic://gate15/authorization-evidence",
  evidenceLocation: "synthetic://gate15/authorization-evidence#activity-table",
  reviewer: "synthetic-reviewer",
  decisionDate: "2026-11-16",
} as const;

const PRIMARY_CONTENT = [
  "SYNTH-ACT-1001",
  "",
  "Section 1. This Act establishes a synthetic registration duty for covered entities.",
  "",
  "Section 2. A covered entity must register with the synthetic authority before it begins operations.",
].join("\n");

const OTHER_CONTENT = [
  "Synthetic Municipal Ferry Notice",
  "",
  "Section 1. The municipal ferry publishes its sailing schedule weekly.",
  "",
  "Section 2. Fares are posted at the terminal before departure.",
].join("\n");

const PRIMARY_ARTIFACT: ArtifactInput = {
  artifactId: "SYNTH-ACT-1001-v1",
  sourceId: PRIMARY_SOURCE_ID,
  sourceUrl: "https://synthetic.invalid/SYNTH-ACT-1001",
  mimeType: "text/plain",
  retrievedAt: "2026-11-16T00:00:00Z",
  // A fixture, and its locator says so. It is authorized by SYNTHETIC_FIXTURE
  // decisions, so the Gate 4 activity checks run for it like any other artifact.
  synthetic: true,
  content: PRIMARY_CONTENT,
  documentType: "REPUBLIC_ACT",
  identityKey: "SYNTH-ACT:1001",
  title: "Synthetic Readiness Act No. 1001",
  officialNumber: "SYNTH-ACT-1001",
  issuingBody: "Synthetic Congress",
  jurisdiction: "PH",
  promulgationDate: EFFECTIVE_FROM,
  effectivityDate: EFFECTIVE_FROM,
  legalStatus: "IN_FORCE",
  authorityLevel: "official_primary",
};

const OTHER_ARTIFACT: ArtifactInput = {
  artifactId: "SYNTH-ACT-2001-v1",
  sourceId: UNREGISTERED_SOURCE_ID,
  sourceUrl: "https://synthetic.invalid/SYNTH-ACT-2001/v1",
  mimeType: "text/plain",
  retrievedAt: "2026-11-16T00:00:00Z",
  synthetic: true,
  content: OTHER_CONTENT,
  documentType: "AGENCY_REGULATION",
  identityKey: "SYNTH-ACT:2001",
  title: "Synthetic Municipal Ferry Notice",
  officialNumber: "SYNTH-ACT-2001",
  issuingBody: "Synthetic Transport Authority",
  jurisdiction: "PH",
  approvalDate: "2024-01-01",
  effectivityDate: EFFECTIVE_FROM,
  legalStatus: "IN_FORCE",
  authorityLevel: "unofficial",
};

const INGEST_OPTIONS = {
  pipelineVersion: "gate15.0.0",
  extractorVersion: "extract.3",
  normalizerVersion: "norm.3",
  enforceActivityAuthorization: true as const,
  authorizationNow: FIXED_NOW,
  now: () => FIXED_NOW,
};

/** One recorded SYNTHETIC_FIXTURE decision for an activity of a source. */
function fixtureDecision(
  activity: DecisionInput["activity"],
  sourceId: string = PRIMARY_SOURCE_ID,
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId,
    activity,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    ...DECISION_FIXTURE,
    ...overrides,
  };
}

function registryWith(
  activities: readonly DecisionInput["activity"][],
  sourceId: string = PRIMARY_SOURCE_ID,
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const activity of activities)
    registry.record(
      fixtureDecision(activity, sourceId),
      "gate15-rehearsal",
      "synthetic fixture decision",
      "test",
      FIXED_NOW,
    );
  return registry;
}

/** The registry-backed Gate 13 adapter over a corpus state, as a caller wires it. */
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

function acquisitionInput(
  artifact: ArtifactInput,
  registry: ActivityAuthorizationRegistry,
) {
  return {
    activityAuthorization: registry,
    artifactId: artifact.artifactId,
    sourceId: artifact.sourceId,
    sourceUrl: artifact.sourceUrl,
    officialTitle: artifact.title,
    legalIdentifier: artifact.officialNumber ?? null,
    documentType: artifact.documentType,
    retrievedAt: artifact.retrievedAt,
    publicationDate: artifact.promulgationDate ?? null,
    promulgationDate: artifact.promulgationDate ?? null,
    effectivityDate: artifact.effectivityDate ?? null,
    originalFilename: `${artifact.artifactId}.txt`,
    mimeType: artifact.mimeType,
    bytes:
      typeof artifact.content === "string"
        ? new TextEncoder().encode(artifact.content)
        : artifact.content,
    acquisitionMethod: "synthetic_fixture",
    // Pass the synthetic flag so acquisition can skip the URL scheme check for fixtures
    synthetic: artifact.synthetic === true,
    // Deliberately not the authority in strict mode: the registry decides.
    authorization: {
      sourceId: artifact.sourceId,
      state: "UNKNOWN" as const,
      evidenceRef: null,
    },
    enforceActivityAuthorization: true as const,
    // Gate 19 pins the fixture basis in the pipeline; acquisition has its own
    // option and the rehearsal's decisions are SYNTHETIC_FIXTURE ones.
    acceptedAuthorizationBases: ["SYNTHETIC_FIXTURE"] as const,
    authorizationNow: FIXED_NOW,
  };
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

/** The corpus both describes: the authorized primary plus an unregistered other. */
function rehearsalCorpus(): CorpusStore {
  const store = CorpusStore.memory();
  const primary = ingest(
    store,
    PRIMARY_ARTIFACT,
    registryWith(REHEARSAL_ACTIVITIES),
  );
  if (primary.status !== "SUCCEEDED")
    throw new Error(`primary ingest failed: ${primary.reason}`);
  const other = ingest(
    store,
    OTHER_ARTIFACT,
    registryWith(INGEST_ACTIVITIES, UNREGISTERED_SOURCE_ID),
  );
  if (other.status !== "SUCCEEDED")
    throw new Error(`secondary ingest failed: ${other.reason}`);
  return store;
}

/** The document ingested from the primary artifact. */
function primaryDocument(state: CorpusState) {
  const document = state.documents.find(
    (candidate) => candidate.identityKey === PRIMARY_ARTIFACT.identityKey,
  );
  if (!document) throw new Error("primary document missing from the corpus");
  return document;
}

/** The document ingested from the unregistered-source artifact. */
function otherDocument(state: CorpusState) {
  const document = state.documents.find(
    (candidate) => candidate.identityKey === OTHER_ARTIFACT.identityKey,
  );
  if (!document) throw new Error("secondary document missing from the corpus");
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

/** The verifier's read-only view, built from the real corpus records. */
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

// ---------------------------------------------------------------------------
// D1 shim seed — the same shape as tests/authority/gate12-bridge-auth.test.ts,
// with the ids the ingestion actually produced.
// ---------------------------------------------------------------------------

const PROVISION_IDENTITY_ID = "SYNTH-PI-1";
const PROVISION_MAPPING_ID = "SYNTH-MAP-1";
const ASSERTION_ID = "SYNTH-ASSERT-1";
const EVIDENCE_ID = "SYNTH-EV-1";
const REVIEW_ID = "SYNTH-REVIEW-1";
// A hash-shaped value for the ledger's NOT NULL content hash columns.
const LEDGER_HASH = sha256("gate15-synthetic-ledger-fixture");

const CONFIRMED_REVIEW: LegalEffectReview = {
  id: REVIEW_ID,
  assertionId: ASSERTION_ID,
  outcome: "CONFIRMED",
  reviewerId: "synthetic-counsel",
  reviewerCapacity: "Counsel",
  decisionDate: "2025-03-01",
  scope: "Section 2",
  propositionReviewed: "Section 2 was enacted and is in force.",
  conditions: [],
  evidenceRefs: [EVIDENCE_ID],
  notes: null,
  supersedesReviewId: null,
  status: "ACTIVE",
  recordedAt: "2025-03-01T00:00:00Z",
};

interface LedgerSeed {
  documentId: string;
  versionId: string;
  provisionId: string;
  provisionText: string;
  /** Which instrument the assertion is derived from. */
  sourceDocumentId: string;
  otherDocumentId: string;
  otherDocumentTitle: string;
}

async function seedLedger(seed: LedgerSeed): Promise<D1AuthorityStore> {
  const sameDocument = seed.sourceDocumentId === seed.documentId;
  const db = new SqliteD1Database();
  db.applyMigrations();
  db.db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('${seed.documentId}', 'REPUBLIC_ACT', 'Synthetic Readiness Act No. 1001',
       'IN_FORCE', 'UNVERIFIED', 'official_primary'),
      ('${seed.otherDocumentId}', 'AGENCY_REGULATION',
       '${seed.otherDocumentTitle}', 'IN_FORCE', 'UNVERIFIED',
       'official_primary');

    INSERT INTO document_versions
      (id, document_id, version_number, content_hash, is_current,
       effective_from)
    VALUES
      ('${seed.versionId}', '${seed.documentId}', 1, '${LEDGER_HASH}', 1,
       '${EFFECTIVE_FROM}');

    INSERT INTO legal_provisions
      (id, document_id, version_id, provision_type, label, text, ordinal,
       legal_status)
    VALUES
      ('${seed.provisionId}', '${seed.documentId}', '${seed.versionId}',
       'SECTION', 'Section 2', '${seed.provisionText}', 1, 'IN_FORCE');
  `);

  const store = new D1AuthorityStore(db);

  const identity: ProvisionIdentity = {
    id: PROVISION_IDENTITY_ID,
    documentId: seed.documentId,
    provisionType: "SECTION",
    canonicalLabel: "Section 2",
    createdAt: "2025-01-02T00:00:00Z",
  };
  const mapping: ProvisionVersionMapping = {
    id: PROVISION_MAPPING_ID,
    provisionIdentityId: PROVISION_IDENTITY_ID,
    provisionVersionId: seed.provisionId,
    documentVersionId: seed.versionId,
    mappingType: "SAME",
    rationale: "Synthetic identity carried across the version.",
    reviewStatus: "REVIEWED",
    createdAt: "2025-01-02T00:00:00Z",
  };
  const assertion: EffectAssertion = {
    id: ASSERTION_ID,
    effectType: "ENACTMENT",
    sourceDocumentId: seed.sourceDocumentId,
    sourceVersionId: sameDocument ? seed.versionId : null,
    sourceProvisionId: sameDocument ? seed.provisionId : null,
    targetDocumentId: seed.documentId,
    targetProvisionIdentityId: PROVISION_IDENTITY_ID,
    targetVersionId: seed.versionId,
    scope: "Section 2",
    claimedDate: "2025-01-15",
    claimedEffectiveDate: "2025-02-01",
    evidenceId: EVIDENCE_ID,
    sourceLocator: "Section 2",
    assertionOrigin: "synthetic-seed",
    recordedAt: "2025-01-16T00:00:00Z",
    recordedBy: "synthetic-registrar",
    state: "PENDING_REVIEW",
    supersedesAssertionId: null,
    conflictGroupId: null,
  };
  const evidence: EffectEvidence = {
    id: EVIDENCE_ID,
    assertionId: ASSERTION_ID,
    documentVersionId: seed.versionId,
    provisionVersionId: seed.provisionId,
    artifactId: null,
    contentHash: LEDGER_HASH,
    passage: seed.provisionText,
    locator: "Section 2",
    evidenceDate: "2025-01-15",
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
    checkedAt: "2025-01-16T00:00:00Z",
  };

  await store.recordProvisionIdentity(identity);
  await store.recordProvisionMapping(mapping);
  await store.recordAssertion(assertion);
  await store.recordEvidence(evidence);
  await store.recordReview(CONFIRMED_REVIEW);
  return store;
}

function lookupFor(
  store: D1AuthorityStore,
  input: Pick<
    AuthorityLookupOptions,
    "authorizationAssertion" | "documentActivityAuthorization"
  >,
) {
  return createAuthorityStatusLookup(store, {
    activity: "citation_display",
    ...input,
  });
}

// ---------------------------------------------------------------------------
// A. The chain completes when every activity is authorized
// ---------------------------------------------------------------------------

interface Chain {
  registry: ActivityAuthorizationRegistry;
  store: CorpusStore;
  document: CorpusState["documents"][number];
  version: CorpusState["versions"][number];
  chunks: CorpusState["chunks"];
  sectionTwoChunk: CorpusState["chunks"][number];
  otherDocumentId: string;
  index: ReturnType<typeof buildSearchIndex>;
  exactResults: ReturnType<typeof retrieve>;
  contentResults: ReturnType<typeof retrieve>;
  retrieved: ReturnType<typeof retrieve>[number];
  ledger: D1AuthorityStore;
  verification: Awaited<
    ReturnType<ReturnType<typeof createCitationVerifier>["verify"]>
  >;
}

describe("Gate 15 — the chain completes when every activity is authorized", () => {
  let chain: Chain;

  beforeAll(async () => {
    // 1. Authorize: one registry, six SYNTHETIC_FIXTURE decisions for the source.
    const registry = registryWith(REHEARSAL_ACTIVITIES);

    // 2. Acquire: the registry decides `downloading`; the legacy state is not
    //    consulted in strict mode and no transport exists (nothing is fetched).
    const acquired = buildAcquisitionRecord(
      acquisitionInput(PRIMARY_ARTIFACT, registry),
    );
    if (!acquired.ok) throw new Error(`acquisition failed: ${acquired.reason}`);
    expect(acquired.record.acquisitionOutcome).toBe("ACQUIRED");

    // 3. Ingest: the pipeline re-checks all four required activities.
    const store = CorpusStore.memory();
    const primary = ingest(store, PRIMARY_ARTIFACT, registry);
    if (primary.status !== "SUCCEEDED")
      throw new Error(`primary ingest failed: ${primary.reason}`);
    const secondary = ingest(
      store,
      OTHER_ARTIFACT,
      registryWith(INGEST_ACTIVITIES, UNREGISTERED_SOURCE_ID),
    );
    if (secondary.status !== "SUCCEEDED")
      throw new Error(`secondary ingest failed: ${secondary.reason}`);

    const document = primaryDocument(store.state);
    const version = currentVersionOf(store.state, document.id);
    const chunks = store.state.chunks.filter(
      (chunk) => chunk.documentId === document.id,
    );
    const sectionTwoChunk = chunkWithLabel(
      store.state,
      document.id,
      "Section 2",
    );
    const secondaryDocument = otherDocument(store.state);

    // 4. Index: one `search_indexing` decision per document, registry-backed.
    const index = buildSearchIndex(store.state, {
      authorization: authorizationOver(registry, store.state),
    });

    // 5. Retrieve: exact identifier, then a content query.
    const exactResults = retrieve(index, {
      text: "SYNTH-ACT-1001",
      mode: "statutory",
    });
    const contentResults = retrieve(index, {
      text: "covered entity must register with the synthetic authority",
      mode: "standard",
    });
    const retrieved = contentResults[0];
    if (!retrieved) throw new Error("content query returned no passage");

    // 6. Seed the D1 shim with the ids the chain produced.
    const ledger = await seedLedger({
      documentId: document.id,
      versionId: version.id,
      provisionId: retrieved.provisionId ?? "",
      provisionText: retrieved.passage,
      sourceDocumentId: document.id,
      otherDocumentId: secondaryDocument.id,
      otherDocumentTitle: secondaryDocument.title,
    });

    const verifier = createCitationVerifier(citationView(store.state), {
      authority: lookupFor(ledger, {
        documentActivityAuthorization: authorizationOver(registry, store.state),
      }),
    });
    const verification = await verifier.verify({
      citationText: PRIMARY_ARTIFACT.officialNumber as string,
      documentId: document.id,
      passageId: retrieved.chunkId,
      proposition: retrieved.passage,
      relevantDate: AS_OF,
    });

    chain = {
      registry,
      store,
      document,
      version,
      chunks,
      sectionTwoChunk,
      otherDocumentId: secondaryDocument.id,
      index,
      exactResults,
      contentResults,
      retrieved,
      ledger,
      verification,
    };
  });

  it("step 1 — every rehearsal activity is recorded on the SYNTHETIC_FIXTURE basis", () => {
    const { registry } = chain;
    expect(registry.history(PRIMARY_SOURCE_ID)).toHaveLength(
      REHEARSAL_ACTIVITIES.length,
    );
    for (const activity of REHEARSAL_ACTIVITIES) {
      const decision = registry.latest(PRIMARY_SOURCE_ID, activity);
      expect(decision).not.toBeNull();
      expect(decision?.status).toBe("AUTHORIZED");
      expect(decision?.basis).toBe("SYNTHETIC_FIXTURE");
      expect(decision?.sourceId).toBe(PRIMARY_SOURCE_ID);
      const check = registry.check(PRIMARY_SOURCE_ID, activity, {
        now: FIXED_NOW,
      });
      expect(check.allowed).toBe(true);
      expect(check.reason).toBe("authorized");
    }
    // Nothing else was authorized: the matrix is not widened by this rehearsal.
    expect(registry.history(UNREGISTERED_SOURCE_ID)).toHaveLength(0);
  });

  it("step 2 — acquisition produced a manifest from the downloading decision", () => {
    const acquired = buildAcquisitionRecord(
      acquisitionInput(PRIMARY_ARTIFACT, chain.registry),
    );
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.record.acquisitionOutcome).toBe("ACQUIRED");
    expect(acquired.record.sourceRegistryId).toBe(PRIMARY_SOURCE_ID);
    expect(acquired.record.verificationStatus).toBe("PENDING_REVIEW");
    // The registry decision id, not the (UNKNOWN) legacy authorization state.
    expect(acquired.record.authorizationRecordRef).toMatch(
      /^auth_synthetic_fixture_downloading_1$/,
    );
    expect(acquired.record.sha256).toBe(sha256(PRIMARY_CONTENT));
  });

  it("step 3 — the corpus holds the ingested document, its current version and chunks", () => {
    const { store, document, version, chunks } = chain;
    expect(store.state.documents).toHaveLength(2);
    expect(document.identityKey).toBe("SYNTH-ACT:1001");
    expect(document.title).toBe("Synthetic Readiness Act No. 1001");
    expect(document.citationText).toBe("SYNTH-ACT-1001");
    expect(document.sourceId).toBe(PRIMARY_SOURCE_ID);
    expect(document.legalStatus).toBe("IN_FORCE");

    expect(
      store.state.versions.filter(
        (candidate) => candidate.documentId === document.id,
      ),
    ).toHaveLength(1);
    expect(version.versionNumber).toBe(1);
    expect(version.isCurrent).toBe(true);
    expect(version.effectiveFrom).toBe(EFFECTIVE_FROM);

    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.documentId).toBe(document.id);
      expect(chunk.versionId).toBe(version.id);
      expect(chunk.charStart).not.toBeNull();
      expect(chunk.charEnd).not.toBeNull();
      expect(chunk.charEnd as number).toBeGreaterThan(
        chunk.charStart as number,
      );
    }
    // The primary run records all four activity decisions, on the fixture basis.
    const run = store.state.runs.find(
      (candidate) => candidate.documentId === document.id,
    );
    expect(run?.status).toBe("SUCCEEDED");
    expect(run?.authorizationBasisDetail).toBe("SYNTHETIC_FIXTURE");
    expect(run?.authorizationDecisionRefs).toHaveLength(4);
    expect(run?.authorizationDecisionRefs?.[0]).toBe(
      "auth_synthetic_fixture_temporary_processing_1",
    );
  });

  it("step 4 — the index holds only the authorized document and names the other", () => {
    const { index, chunks, otherDocumentId } = chain;
    expect(index.total).toBe(chunks.length);
    expect(index.entries.length).toBeGreaterThan(0);
    expect(new Set(index.entries.map((entry) => entry.documentId))).toEqual(
      new Set([chain.document.id]),
    );
    expect(
      index.entries.every((entry) => entry.sourceId === PRIMARY_SOURCE_ID),
    ).toBe(true);

    expect(index.excludedDocuments).toHaveLength(1);
    expect(index.excludedDocuments[0]).toMatchObject({
      documentId: otherDocumentId,
      activity: "search_indexing",
      role: "TARGET",
      decision: "NOT_CHECKED",
      sourceId: UNREGISTERED_SOURCE_ID,
      status: null,
      reason: "no_decision_recorded",
    });
  });

  it("step 5 — both queries return the ingested document with a span and provenance", () => {
    const { exactResults, contentResults, retrieved, document, version } =
      chain;

    expect(exactResults.length).toBeGreaterThan(0);
    expect(exactResults[0]?.documentId).toBe(document.id);
    expect(exactResults[0]?.exactMatch).toBe(true);
    expect(exactResults[0]?.citationText).toBe("SYNTH-ACT-1001");

    expect(contentResults.length).toBeGreaterThan(0);
    expect(retrieved.documentId).toBe(document.id);
    expect(retrieved.chunkId).toBe(chain.sectionTwoChunk.id);
    expect(retrieved.passage).toContain(
      "must register with the synthetic authority",
    );

    for (const result of [exactResults[0], retrieved]) {
      if (!result) throw new Error("no result to assert");
      expect(result.span).not.toBeNull();
      expect(result.span?.charEnd as number).toBeGreaterThan(
        result.span?.charStart as number,
      );
      expect(result.provenance.sourceId).toBe(PRIMARY_SOURCE_ID);
      expect(result.provenance.documentId).toBe(document.id);
      expect(result.provenance.versionId).toBe(version.id);
      expect(result.provenance.chunkId).toBe(result.chunkId);
      expect(result.metadata.sourceId).toBe(PRIMARY_SOURCE_ID);
      expect(result.metadata.documentId).toBe(document.id);
    }

    expect(retrieved.provenance).toEqual({
      sourceId: PRIMARY_SOURCE_ID,
      documentId: document.id,
      versionId: version.id,
      provisionId: retrieved.provisionId,
      chunkId: retrieved.chunkId,
    });
  });

  it("step 6 — a citation built from the passage passes layer 4 on the projected authority", () => {
    const { verification } = chain;
    expect(verification.identityVerified).toBe(true);
    expect(verification.passageVerified).toBe(true);
    expect(verification.propositionSupported).toBe(true);
    expect(verification.temporalValidity).toBe(true);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("VERIFIED");

    expect(verification.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(verification.authorityStatus?.state).toBe("IN_FORCE");
    expect(verification.authorityStatus?.abstained).toBe(false);
    expect(verification.authorityStatus?.missing).toEqual([]);
    expect(verification.authorityStatus?.authorizationSource).toBe(
      "document_activity",
    );
    expect(verification.authorityStatus?.versionId).toBe(chain.version.id);
    expect(verification.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });
});

// ---------------------------------------------------------------------------
// B. Each stage refuses when its activity is not authorized
// ---------------------------------------------------------------------------

describe("Gate 15 — each stage refuses when its activity is not authorized", () => {
  it("B1 refuses at acquisition when downloading is not authorized", () => {
    const registry = registryWith([
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
      "search_indexing",
      "citation_display",
    ]);
    expect(registry.check(PRIMARY_SOURCE_ID, "downloading").allowed).toBe(
      false,
    );

    const acquired = buildAcquisitionRecord(
      acquisitionInput(PRIMARY_ARTIFACT, registry),
    );
    const store = CorpusStore.memory();

    expect(acquired.ok).toBe(false);
    if (acquired.ok) return;
    expect(acquired.reason).toBe(
      "activity_not_authorized:downloading:no_decision_recorded",
    );
    // Nothing was admitted, so nothing was ingested and nothing stored.
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.runs).toHaveLength(0);
    expect(store.state.chunks).toHaveLength(0);
  });

  it("B2 refuses at ingestion when text_extraction is not authorized", () => {
    const registry = registryWith([
      "downloading",
      "temporary_processing",
      "persistent_storage",
      "search_indexing",
    ]);
    const store = CorpusStore.memory();

    const result = ingest(store, PRIMARY_ARTIFACT, registry);

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe(
      "activity_not_authorized:text_extraction:no_decision_recorded",
    );
    expect(result.chunkCount).toBe(0);
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.versions).toHaveLength(0);
    expect(store.state.chunks).toHaveLength(0);
    const run = store.state.runs.at(-1);
    expect(run?.status).toBe("FAILED");
    expect(run?.failureReason).toBe(
      "activity_not_authorized:text_extraction:no_decision_recorded",
    );
  });

  it("B3 refuses at index build when search_indexing is not authorized", () => {
    const corpus = CorpusStore.memory();
    const ingestResult = ingest(
      corpus,
      PRIMARY_ARTIFACT,
      registryWith(REHEARSAL_ACTIVITIES),
    );
    expect(ingestResult.status).toBe("SUCCEEDED");
    expect(corpus.state.documents).toHaveLength(1);

    // Fresh registry for the stage under test: every activity but search_indexing.
    const indexRegistry = registryWith([
      "downloading",
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
      "citation_display",
    ]);
    expect(
      indexRegistry.check(PRIMARY_SOURCE_ID, "search_indexing").allowed,
    ).toBe(false);

    const index = buildSearchIndex(corpus.state, {
      authorization: authorizationOver(indexRegistry, corpus.state),
    });

    expect(index.entries).toHaveLength(0);
    expect(index.total).toBe(0);
    expect(index.docFreq.size).toBe(0);
    expect(index.excludedDocuments).toHaveLength(1);
    expect(index.excludedDocuments[0]).toMatchObject({
      documentId: primaryDocument(corpus.state).id,
      activity: "search_indexing",
      role: "TARGET",
      decision: "NOT_CHECKED",
      sourceId: PRIMARY_SOURCE_ID,
      reason: "no_decision_recorded",
    });
  });

  it("B4 abstains at projection when no authorization input is supplied", async () => {
    const corpus = rehearsalCorpus();
    const document = primaryDocument(corpus.state);
    const sectionTwo = chunkWithLabel(corpus.state, document.id, "Section 2");
    const ledger = await seedLedger({
      documentId: document.id,
      versionId: currentVersionOf(corpus.state, document.id).id,
      provisionId: sectionTwo.provisionId as string,
      provisionText: sectionTwo.content,
      sourceDocumentId: document.id,
      otherDocumentId: otherDocument(corpus.state).id,
      otherDocumentTitle: otherDocument(corpus.state).title,
    });
    const snapshot = await ledger.loadStateFor(document.id);

    // `createAuthorityStatusLookup` refuses to be constructed without an input
    // (throws `authorization_required`), so the abstention itself is asserted on
    // the projection the lookup wraps.
    expect(() =>
      createAuthorityStatusLookup(ledger, {
        activity: "citation_display",
      } as never),
    ).toThrow(/authorization_required/);

    const projection = projectAuthorityState({
      snapshot,
      documentId: document.id,
      asOf: AS_OF,
      activity: "citation_display",
    } as ProjectionRequest);

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.missing).toEqual(["AUTHORIZATION_INPUT_MISSING"]);
    expect(projection.authorization).toBe("NOT_CHECKED");
    expect(projection.authorizationSource).toBeUndefined();
    expect(projection.authorizationChecks).toBeUndefined();
    expect(projection.explanation).toBe("No authorization input was supplied.");
  });

  it("B5 abstains at projection when the target is NOT_CHECKED, and layer 4 fails", async () => {
    const corpus = rehearsalCorpus();
    const document = primaryDocument(corpus.state);
    const chunk = chunkWithLabel(corpus.state, document.id, "Section 2");
    const ledger = await seedLedger({
      documentId: document.id,
      versionId: currentVersionOf(corpus.state, document.id).id,
      provisionId: chunk.provisionId as string,
      provisionText: chunk.content,
      sourceDocumentId: document.id,
      otherDocumentId: otherDocument(corpus.state).id,
      otherDocumentTitle: otherDocument(corpus.state).title,
    });
    // Fresh registry: ingestion activities only, no citation_display decision.
    const registry = registryWith([
      "downloading",
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
      "search_indexing",
    ]);
    const authorization = authorizationOver(registry, corpus.state);

    const decision = authorization({
      documentId: document.id,
      activity: "citation_display",
      role: "TARGET",
    });
    expect(decision.decision).toBe("NOT_CHECKED");
    expect(decision.reason).toBe("no_decision_recorded");

    const snapshot = await ledger.loadStateFor(document.id);
    const projection = projectAuthorityState({
      snapshot,
      documentId: document.id,
      provisionIdentityId: PROVISION_IDENTITY_ID,
      asOf: AS_OF,
      activity: "citation_display",
      documentActivityAuthorization: authorization,
    });

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(projection.authorization).toBe("NOT_CHECKED");
    expect(projection.authorizationSource).toBe("document_activity");
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: document.id,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: PRIMARY_SOURCE_ID,
        // No decision record exists, so the adapter reports no status either.
        status: null,
        reason: "no_decision_recorded",
        decisionRef: null,
      },
    ]);

    const verifier = createCitationVerifier(citationView(corpus.state), {
      authority: lookupFor(ledger, {
        documentActivityAuthorization: authorization,
      }),
    });
    const result = await verifier.verify({
      citationText: "SYNTH-ACT-1001",
      documentId: document.id,
      passageId: chunk.id,
      proposition: chunk.content,
      relevantDate: AS_OF,
    });

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toContain(
      "AUTHORIZATION_NOT_CHECKED",
    );
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("B6 refuses at the verifier when the assertion source is authorized only for another activity", async () => {
    const corpus = rehearsalCorpus();
    const document = primaryDocument(corpus.state);
    const other = otherDocument(corpus.state);
    const chunk = chunkWithLabel(corpus.state, document.id, "Section 2");
    const ledger = await seedLedger({
      documentId: document.id,
      versionId: currentVersionOf(corpus.state, document.id).id,
      provisionId: chunk.provisionId as string,
      provisionText: chunk.content,
      sourceDocumentId: other.id,
      otherDocumentId: other.id,
      otherDocumentTitle: other.title,
    });

    // The source document's source is authorized for `downloading` only. The
    // target's source is authorized for citation_display, so the refusal cannot
    // be blamed on the target.
    const registry = registryWith(["citation_display"]);
    registry.record(
      fixtureDecision("downloading", UNREGISTERED_SOURCE_ID),
      "gate15-rehearsal",
      "synthetic fixture decision",
      "test",
      FIXED_NOW,
    );
    expect(registry.check(UNREGISTERED_SOURCE_ID, "downloading").allowed).toBe(
      true,
    );
    expect(
      registry.check(UNREGISTERED_SOURCE_ID, "citation_display").reason,
    ).toBe("no_decision_recorded");

    const authorization = authorizationOver(registry, corpus.state);
    expect(
      authorization({
        documentId: document.id,
        activity: "citation_display",
        role: "TARGET",
      }).decision,
    ).toBe("AUTHORIZED");
    const sourceDecision = authorization({
      documentId: other.id,
      activity: "citation_display",
      role: "SOURCE",
    });
    expect(sourceDecision.decision).toBe("NOT_CHECKED");
    expect(sourceDecision.sourceId).toBe(UNREGISTERED_SOURCE_ID);

    const verifier = createCitationVerifier(citationView(corpus.state), {
      authority: lookupFor(ledger, {
        documentActivityAuthorization: authorization,
      }),
    });
    const result = await verifier.verify({
      citationText: "SYNTH-ACT-1001",
      documentId: document.id,
      passageId: chunk.id,
      proposition: chunk.content,
      relevantDate: AS_OF,
    });

    expect(result.layerResults.IDENTITY.passed).toBe(true);
    expect(result.layerResults.LOCATION.passed).toBe(true);
    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toEqual([
      `SOURCE_AUTHORIZATION_NOT_CHECKED:${ASSERTION_ID}`,
    ]);
    expect(result.authorityStatus?.missing).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^SOURCE_.*:SYNTH-ASSERT-1$/),
      ]),
    );
    expect(result.authorityStatus?.authorizationSource).toBe(
      "document_activity",
    );
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });
});
