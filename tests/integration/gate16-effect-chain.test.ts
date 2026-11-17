// Gate 16 — the effect chain: authorize → ingest → claim → persist → review →
// project → verify, on synthetic material only.
//
// Every fixture is fictional. No Philippine law, counsel record or authorization
// cell is represented, changed or implied. The SQLite shim is supplementary
// evidence, not D1 runtime validation.
//
// What this closes: Gate 15 seeded the authority ledger by hand, so its
// verification could only pass against rows the rehearsal itself had written.
// Here the assertion and evidence the projection and the citation verifier
// consume are produced by `recordEffectClaim` from an **ingested** chunk and
// persisted verbatim; nothing in the ledger's authority tables is authored by
// this test.
//
// What is still not wired, stated rather than hidden:
//
// - ingestion writes documents, versions and provisions into the corpus store,
//   not into D1's `legal_documents` / `document_versions` / `legal_provisions`
//   tables. Those three tables are projected from the ingested corpus by
//   `syncCorpusRows` below, because the ledger's foreign keys and the
//   projection's version span need rows there. They are copied from the
//   ingestion output, not invented, and no authority row comes from them.
// - `recordEffectClaim` records a claim, never a review: step 5 asserts the
//   projection is PARTIALLY_DETERMINED until step 6 records one separately.
// - the pipeline skips its activity checks for artifacts flagged `synthetic`,
//   so both artifacts are ingested with the flag set false.
import { beforeAll, describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  ActivityAuthorizationRegistry,
  type ArtifactInput,
  type CorpusState,
  CorpusStore,
  createAuthorityStatusLookup,
  createRegistryAuthorization,
  D1AuthorityStore,
  type DecisionInput,
  type DocumentActivityAuthorization,
  deriveReviewId,
  type EffectClaimInput,
  type EffectClaimRecords,
  ingestArtifact,
  projectAuthorityState,
  recordEffectClaim,
} from "../../packages/legal-ingestion/src/index";
import type { LegalEffectReview } from "../../packages/legal-schema/src/index";
import {
  buildSearchIndex,
  retrieve,
} from "../../packages/legal-search/src/index";
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
const REVOCATION_DECISION_DATE = "2026-07-01";

const TARGET_CITATION = "SYNTH-TARGET-1001";

const SOURCE_IDENTITY_KEY = "SYNTH-SRC-DOC";
const TARGET_IDENTITY_KEY = "SYNTH-TARGET-DOC";

const ANALYST_ID = "SYNTH-ANALYST-1";
const REVIEWER_ID = "SYNTH-REVIEWER-1";

const DECISION_FIXTURE = {
  evidenceRef: "synthetic://gate16/authorization-evidence",
  evidenceLocation: "synthetic://gate16/authorization-evidence#activity-table",
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
  pipelineVersion: "gate16.0.0",
  extractorVersion: "extract.3",
  normalizerVersion: "norm.3",
  enforceActivityAuthorization: true as const,
  acceptedAuthorizationBases: ["SYNTHETIC_FIXTURE"] as const,
  authorizationNow: FIXED_NOW,
  now: () => FIXED_NOW,
};

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
      "gate16-effect-chain",
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

/**
 * Project the ingested documents, versions and provisions into the D1 shim.
 *
 * Ingestion has no D1 writer (the corpus store owns these rows), but the ledger
 * adapter reads the target document, its version span and its provisions from
 * D1. The values are copied from the ingestion output, parameterized, and never
 * extended: no assertion, evidence, review, identity or mapping is written here.
 */
function syncCorpusRows(db: SqliteD1Database, state: CorpusState): void {
  const insertDocument = db.db.prepare(
    `INSERT INTO legal_documents
       (id, document_type, title, citation_text, issuing_body, jurisdiction,
        promulgation_date, effectivity_date, legal_status, verification_status,
        authority_level, source_id, identity_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const document of state.documents) {
    insertDocument.run(
      document.id,
      document.documentType,
      document.title,
      document.citationText ?? null,
      document.issuingBody ?? null,
      document.jurisdiction ?? null,
      document.promulgationDate ?? null,
      document.effectivityDate ?? null,
      document.legalStatus,
      document.verificationStatus,
      document.authorityLevel,
      document.sourceId ?? null,
      document.identityKey ?? null,
      document.createdAt,
      document.updatedAt,
    );
  }

  const insertVersion = db.db.prepare(
    `INSERT INTO document_versions
       (id, document_id, version_number, content_hash, effective_from,
        effective_to, is_current, version_label, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const version of state.versions) {
    insertVersion.run(
      version.id,
      version.documentId,
      version.versionNumber,
      version.contentHash,
      version.effectiveFrom ?? null,
      version.effectiveTo ?? null,
      version.isCurrent ? 1 : 0,
      version.versionLabel ?? null,
      version.changeSummary ?? null,
      version.createdAt,
    );
  }

  const insertProvision = db.db.prepare(
    `INSERT INTO legal_provisions
       (id, document_id, version_id, provision_type, label, text, ordinal,
        legal_status, effective_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const provision of state.provisions) {
    insertProvision.run(
      provision.id,
      provision.documentId,
      provision.versionId,
      provision.provisionType,
      provision.label,
      provision.text,
      provision.ordinal,
      provision.legalStatus,
      provision.effectiveFrom ?? null,
      provision.createdAt,
    );
  }
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

function notNull<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`missing ${what}`);
  return value;
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
  ledger: D1AuthorityStore;
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
  retrieved: ReturnType<typeof retrieve>[number];
  lookup: ReturnType<typeof createAuthorityStatusLookup>;
  verifier: ReturnType<typeof createCitationVerifier>;
  citation: VerifyInput;
  confirmedReviewId: string | null;
  revocationReviewId: string | null;
}

describe("Gate 16 — the effect chain is closed without hand-seeded authority rows", () => {
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

    const sourceDocument = documentWithKey(state, SOURCE_IDENTITY_KEY);
    const targetDocument = documentWithKey(state, TARGET_IDENTITY_KEY);
    const sourceVersion = currentVersionOf(state, sourceDocument.id);
    const targetVersion = currentVersionOf(state, targetDocument.id);
    const sourceChunk = chunkWithLabel(state, sourceDocument.id, "Section 1");
    const targetChunk = chunkWithLabel(state, targetDocument.id, "Section 2");

    // 3. Retrieve: index both documents, then fetch the target's Section 2
    //    passage the citation will point at.
    const index = buildSearchIndex(state, {
      authorization: authorizationOver(registry, state),
    });
    const results = retrieve(index, {
      text: "covered entity must register with the synthetic authority",
      mode: "standard",
    });
    const retrieved = results.find(
      (result) =>
        result.documentId === targetDocument.id &&
        result.chunkId === targetChunk.id,
    );
    if (!retrieved)
      throw new Error("retrieval did not return the target chunk");

    // 4. Claim: read a span out of the ingested source chunk.
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

    // 5. Persist exactly the returned records through the D1 adapter.
    const db = new SqliteD1Database();
    db.applyMigrations();
    syncCorpusRows(db, state);
    const ledger = new D1AuthorityStore(db);
    await persistClaim(ledger, claim.records);

    // 6. Project and verify, without any review recorded.
    // Gate 18: the evidence names the source version, so the source document's
    // rows must be in scope — otherwise the projection reports
    // EVIDENCE_DOCUMENT_NOT_LOADED rather than silently skipping the check.
    const lookup = createAuthorityStatusLookup(ledger, {
      activity: "citation_display",
      documentActivityAuthorization: authorizationOver(registry, state),
      contextDocumentIds: [sourceDocument.id],
    });
    const verifier = createCitationVerifier(citationView(state), {
      authority: lookup,
    });
    const citation: VerifyInput = {
      citationText: TARGET_CITATION,
      documentId: targetDocument.id,
      passageId: targetChunk.id,
      proposition: retrieved.passage,
      relevantDate: AS_OF,
    };

    chain = {
      registry,
      state,
      ledger,
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
      retrieved,
      lookup,
      verifier,
      citation,
      confirmedReviewId: null,
      revocationReviewId: null,
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

  it("step 2 — both artifacts are in the corpus with a current version and chunks", () => {
    const { state, sourceDocumentId, targetDocumentId } = chain;
    expect(state.documents).toHaveLength(2);

    const source = state.documents.find((doc) => doc.id === sourceDocumentId);
    const target = state.documents.find((doc) => doc.id === targetDocumentId);
    expect(source?.identityKey).toBe(SOURCE_IDENTITY_KEY);
    expect(source?.sourceId).toBe(SOURCE_ID);
    expect(target?.identityKey).toBe(TARGET_IDENTITY_KEY);
    expect(target?.citationText).toBe(TARGET_CITATION);

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
    for (const chunk of state.chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.provisionId).not.toBeNull();
    }
  });

  it("step 3 — the intake turns an ingested chunk into an UNREVIEWED claim", () => {
    const { records, warnings, assertionId, claimInput } = chain;
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

    // Evidence is pinned to the ingested bytes, not to a re-typed passage.
    expect(evidence.assertionId).toBe(assertion.id);
    expect(evidence.documentVersionId).toBe(chain.sourceVersionId);
    expect(evidence.passage).toBe(chain.expectedPassage);
    expect(evidence.locator).toBe(`chunk:${chain.sourceChunkId}`);
    expect(evidence.classification).toBe("UNKNOWN");
    expect(evidence.availability).toBe("AVAILABLE");
    expect(evidence.contentHash).toBe(
      notNull(
        chain.state.versions.find(
          (version) => version.id === chain.sourceVersionId,
        ),
        "source version",
      ).contentHash,
    );

    // The named target provision resolves, so identity and mapping come back.
    expect(provisionIdentity?.canonicalLabel).toBe("Section 2");
    expect(provisionIdentity?.documentId).toBe(chain.targetDocumentId);
    expect(provisionMapping?.provisionIdentityId).toBe(provisionIdentity?.id);
    expect(provisionMapping?.reviewStatus).toBe("UNREVIEWED");
    expect(assertion.targetProvisionIdentityId).toBe(provisionIdentity?.id);
    expect(claimInput.effectType).toBe("AMENDMENT");
  });

  it("step 4 — the D1 ledger round-trips the intake records unchanged", async () => {
    const { ledger, records, assertionId } = chain;

    const storedAssertion = await ledger.getAssertion(assertionId);
    expect(storedAssertion).toEqual(records.assertion);
    expect(storedAssertion?.evidenceId).toBe(records.evidence.id);

    const storedEvidence = await ledger.listEvidence(assertionId);
    expect(storedEvidence).toHaveLength(1);
    expect(storedEvidence[0]).toEqual(records.evidence);
    expect(storedEvidence[0]?.passage).toBe(
      notNull(
        chain.state.chunks.find((chunk) => chunk.id === chain.sourceChunkId),
        "source chunk",
      ).content.slice(chain.spanStart, chain.spanEnd),
    );

    const snapshot = await ledger.loadStateFor(chain.targetDocumentId);
    expect(snapshot.provisionIdentities.map((identity) => identity.id)).toEqual(
      [notNull(records.provisionIdentity, "provision identity").id],
    );
    expect(snapshot.provisionMappings.map((mapping) => mapping.id)).toEqual([
      notNull(records.provisionMapping, "provision mapping").id,
    ]);
    expect(snapshot.reviews).toEqual([]);
  });

  it("step 5 — without a review the projection abstains and layer 4 fails", async () => {
    const { lookup, verifier, citation, assertionId, targetVersionId } = chain;

    const status = await lookup({
      documentId: chain.targetDocumentId,
      provisionId: notNull(chain.records.provisionMapping, "provision mapping")
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

    // The projection's only assertion is the intake's, and it has no evidence
    // base until a review names one.
    const snapshot = await chain.ledger.loadStateFor(chain.targetDocumentId);
    const projection = projectAuthorityState({
      snapshot,
      documentId: chain.targetDocumentId,
      provisionIdentityId: notNull(
        chain.records.provisionIdentity,
        "provision identity",
      ).id,
      asOf: AS_OF,
      activity: "citation_display",
      documentActivityAuthorization: authorizationOver(
        chain.registry,
        chain.state,
      ),
    });
    expect(projection.assertions).toEqual([assertionId]);
    expect(projection.evidence).toEqual([]);
    expect(projection.versionId).toBeNull();
    expect(projection.versionId).not.toBe(targetVersionId);

    const verification = await verifier.verify(citation);
    expect(verification.identityVerified).toBe(true);
    expect(verification.passageVerified).toBe(true);
    expect(verification.propositionSupported).toBe(true);
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(verification.temporalValidity).toBe(false);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(verification.authorityStatus?.outcome).toBe("PARTIALLY_DETERMINED");
    expect(verification.authorityStatus?.state).toBe("UNKNOWN");
    expect(verification.authorityStatus?.abstained).toBe(true);
    expect(verification.authorityStatus?.missing).toContain(
      "NO_REVIEWED_CONCLUSION",
    );
    expect(verification.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("step 6 — a separate review determines the state and layer 4 passes", async () => {
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

    // Gate 18: both documents, because the evidence names the source version.
    const snapshot = await ledger.loadStateForMany([
      chain.targetDocumentId,
      chain.sourceDocumentId,
    ]);
    const projection = projectAuthorityState({
      snapshot,
      documentId: chain.targetDocumentId,
      provisionIdentityId: notNull(
        records.provisionIdentity,
        "provision identity",
      ).id,
      asOf: AS_OF,
      activity: "citation_display",
      documentActivityAuthorization: authorizationOver(
        chain.registry,
        chain.state,
      ),
    });
    expect(projection.assertions).toEqual([assertionId]);
    expect(projection.reviews).toEqual([confirmed.id]);
    expect(projection.evidence).toEqual([records.evidence.id]);

    const verification = await verifier.verify(citation);
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
    expect(verification.temporalValidity).toBe(true);
    expect(verification.temporalSource).toBe("authority_projection");
    expect(verification.verificationStatus).toBe("VERIFIED");
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
    expect(verification.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("step 7 — a superseding rejection removes the conclusion and layer 4 fails", async () => {
    const { ledger, records, lookup, verifier, citation, assertionId } = chain;
    const confirmedId = notNull(chain.confirmedReviewId, "confirmed review");

    const revocation = reviewOf(
      {
        assertionId,
        outcome: "REJECTED",
        reviewerId: "SYNTH-REVIEWER-2",
        reviewerCapacity: "SYNTHETIC",
        decisionDate: REVOCATION_DECISION_DATE,
        scope: "SYNTH-TARGET-DOC Section 2",
        propositionReviewed:
          "Section 2 of the synthetic target imposes the registration duty.",
        conditions: [],
        evidenceRefs: [records.evidence.id],
        notes: "synthetic revocation",
        supersedesReviewId: confirmedId,
        status: "REVOKED",
      },
      FIXED_NOW,
    );
    await ledger.recordReview(revocation);
    chain.revocationReviewId = revocation.id;

    expect(revocation.id).not.toBe(confirmedId);
    const reviews = await ledger.listReviews(assertionId);
    expect(reviews.map((review) => review.status)).toEqual([
      "ACTIVE",
      "REVOKED",
    ]);
    expect(reviews[1]?.supersedesReviewId).toBe(confirmedId);

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

    const snapshot = await ledger.loadStateFor(chain.targetDocumentId);
    const projection = projectAuthorityState({
      snapshot,
      documentId: chain.targetDocumentId,
      provisionIdentityId: notNull(
        records.provisionIdentity,
        "provision identity",
      ).id,
      asOf: AS_OF,
      activity: "citation_display",
      documentActivityAuthorization: authorizationOver(
        chain.registry,
        chain.state,
      ),
    });
    expect(projection.assertions).toEqual([assertionId]);
    expect(projection.reviews).toEqual([]);
    expect(projection.evidence).toEqual([]);

    const verification = await verifier.verify(citation);
    expect(verification.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(verification.temporalValidity).toBe(false);
    expect(verification.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(verification.authorityStatus?.outcome).toBe("PARTIALLY_DETERMINED");
    expect(verification.authorityStatus?.missing).toEqual([
      "NO_REVIEWED_CONCLUSION",
    ]);
    expect(verification.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("step 8 — a chunk from the wrong document is refused and persists nothing", async () => {
    const { ledger, state, claimInput, assertionId } = chain;

    const before = await ledger.listAssertionsFor(chain.targetDocumentId);
    expect(before.map((assertion) => assertion.id)).toEqual([assertionId]);

    const wrongSource: EffectClaimInput = {
      ...claimInput,
      scope: "SYNTH- negative case: evidence chunk belongs to the target.",
      evidence: { chunkId: chain.targetChunkId },
    };
    const result = recordEffectClaim(state, wrongSource);
    expect(result).toEqual({ ok: false, reason: "chunk_not_of_source" });

    const after = await ledger.listAssertionsFor(chain.targetDocumentId);
    expect(after.map((assertion) => assertion.id)).toEqual([assertionId]);
    expect(await ledger.listEvidence(assertionId)).toHaveLength(1);
    expect(await ledger.listReviews(assertionId)).toHaveLength(2);
    expect(chain.assertionId).toBe(assertionId);
  });
});
