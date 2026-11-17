// Gate 18 — the authority lookup's context documents.
// Supplementary evidence only: the SQLite shim is NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
//
// Why this option exists. `createAuthorityStatusLookup` used to load only the
// document being asked about. The projection resolves the document behind an
// evidence record as a third party (Gate 13, the EVIDENCE role) by finding that
// evidence's version in the snapshot; when the version was absent it resolved
// nothing, so a storage gap silently skipped an authorization check and the
// review was accepted.
//
// Gate 18 closes that with two changes: the projection now refuses to skip the
// check (`EVIDENCE_DOCUMENT_NOT_LOADED`), and `contextDocumentIds` gives a
// caller the way to load the named documents. The tests below show all four
// outcomes on one fixture: under-loaded -> named and abstained; evidence
// document loaded but not authorized -> `EVIDENCE_AUTHORIZATION_NOT_CHECKED`;
// loaded and authorized -> determined; and no authorization input at all ->
// refused at construction.
import { describe, expect, it } from "vitest";
import type {
  CorpusState,
  DecisionInput,
  DocumentActivityAuthorization,
} from "../../packages/legal-ingestion/src/index";
import {
  ActivityAuthorizationRegistry,
  createAuthorityStatusLookup,
  createRegistryAuthorization,
  D1AuthorityStore,
  writeCorpusToD1,
} from "../../packages/legal-ingestion/src/index";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
} from "../../packages/legal-schema/src/index";
import {
  AuthorityLevel,
  DocumentType,
  LegalStatus,
  VerificationStatus,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const FIXED_NOW = "2026-11-17T00:00:00Z";
const AS_OF = "2026-08-01";
const CREATED_AT = "2026-01-01T00:00:00Z";
const HASH = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const SOURCE_ID = "SYNTH-SOURCE-A";
const OTHER_SOURCE_ID = "SYNTH-SOURCE-C";

const SOURCE_DOC = "SYNTH-DOC-A";
const TARGET_DOC = "SYNTH-DOC-B";
const EVIDENCE_DOC = "SYNTH-DOC-C";
const SOURCE_VERSION = "SYNTH-VER-A";
const TARGET_VERSION = "SYNTH-VER-B";
const EVIDENCE_VERSION = "SYNTH-VER-C";
const TARGET_PROVISION = "SYNTH-PROV-B";

const ACTIVITY = "citation_display" as const;

function corpus(): CorpusState {
  const document = (id: string, sourceId: string, title: string) => ({
    id,
    documentType: DocumentType.REPUBLIC_ACT,
    title,
    shortTitle: null,
    docketNumber: null,
    issuingBody: "Synthetic Legislature",
    jurisdiction: "PH",
    promulgationDate: "2025-01-01",
    legalStatus: LegalStatus.IN_FORCE,
    verificationStatus: VerificationStatus.VERIFIED,
    authorityLevel: AuthorityLevel.OFFICIAL_PRIMARY,
    sourceId,
    identityKey: `SYNTHETIC:${id}`,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  const version = (id: string, documentId: string, contentHash: string) => ({
    id,
    documentId,
    versionNumber: 1,
    versionLabel: "Original",
    contentHash,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    isCurrent: true,
    createdAt: CREATED_AT,
  });

  return {
    documents: [
      document(SOURCE_DOC, SOURCE_ID, "Synthetic Source Act"),
      document(TARGET_DOC, SOURCE_ID, "Synthetic Target Act"),
      document(EVIDENCE_DOC, OTHER_SOURCE_ID, "Synthetic Evidence Act"),
    ],
    versions: [
      version(SOURCE_VERSION, SOURCE_DOC, HASH),
      version(TARGET_VERSION, TARGET_DOC, HASH),
      version(EVIDENCE_VERSION, EVIDENCE_DOC, HASH),
    ],
    manifestations: [],
    provisions: [
      {
        id: TARGET_PROVISION,
        documentId: TARGET_DOC,
        versionId: TARGET_VERSION,
        provisionType: "SECTION",
        label: "Section 1",
        heading: null,
        text: "Section 1. This synthetic provision states the duty.",
        ordinal: 1,
        legalStatus: LegalStatus.IN_FORCE,
        createdAt: CREATED_AT,
      },
    ],
    chunks: [],
    relationships: [],
    runs: [],
    pendingRelationships: [],
  };
}

function decision(sourceId: string): DecisionInput {
  return {
    sourceId,
    activity: ACTIVITY,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    evidenceRef: "synthetic://gate18/authorization-evidence",
    evidenceLocation:
      "synthetic://gate18/authorization-evidence#activity-table",
    reviewer: "synthetic-reviewer",
    decisionDate: FIXED_NOW.slice(0, 10),
  };
}

function registry(...sourceIds: string[]): ActivityAuthorizationRegistry {
  const recorded = new ActivityAuthorizationRegistry();
  for (const sourceId of sourceIds)
    recorded.record(
      decision(sourceId),
      "gate18-lookup-context",
      "synthetic fixture decision",
      "test",
      FIXED_NOW,
    );
  return recorded;
}

/** Source every fixture document belongs to; the evidence doc is elsewhere. */
function authorizationOver(
  recorded: ActivityAuthorizationRegistry,
): DocumentActivityAuthorization {
  return createRegistryAuthorization({
    registry: recorded,
    sourceOfDocument: (documentId) =>
      documentId === EVIDENCE_DOC ? OTHER_SOURCE_ID : SOURCE_ID,
    now: FIXED_NOW,
  });
}

const IDENTITY: ProvisionIdentity = {
  id: "SYNTH-PI-B",
  documentId: TARGET_DOC,
  provisionType: "SECTION",
  canonicalLabel: "Section 1",
  createdAt: CREATED_AT,
};

const ASSERTION: EffectAssertion = {
  id: "SYNTH-ASSERT-1",
  effectType: "PARTIAL_AMENDMENT",
  sourceDocumentId: SOURCE_DOC,
  sourceVersionId: SOURCE_VERSION,
  sourceProvisionId: null,
  targetDocumentId: TARGET_DOC,
  targetProvisionIdentityId: IDENTITY.id,
  targetVersionId: TARGET_VERSION,
  scope: "Section 1",
  claimedDate: "2025-06-15",
  claimedEffectiveDate: "2025-07-01",
  evidenceId: "SYNTH-EVID-1",
  sourceLocator: "Section 1",
  assertionOrigin: "synthetic-fixture",
  recordedAt: FIXED_NOW,
  recordedBy: "synthetic-analyst",
  state: "PENDING_REVIEW",
  supersedesAssertionId: null,
  conflictGroupId: null,
};

const EVIDENCE: EffectEvidence = {
  id: "SYNTH-EVID-1",
  assertionId: ASSERTION.id,
  documentVersionId: EVIDENCE_VERSION,
  provisionVersionId: null,
  artifactId: null,
  contentHash: HASH,
  passage: "Synthetic evidence passage.",
  locator: "Section 1",
  evidenceDate: "2025-06-15",
  classification: "OFFICIAL_PRIMARY",
  availability: "AVAILABLE",
  checkedAt: FIXED_NOW,
};

const REVIEW: LegalEffectReview = {
  id: "SYNTH-REVIEW-1",
  assertionId: ASSERTION.id,
  outcome: "CONFIRMED",
  reviewerId: "synthetic-counsel-1",
  reviewerCapacity: "Counsel",
  decisionDate: "2026-06-01",
  scope: "Section 1",
  propositionReviewed: "Section 1 of the target is partially amended.",
  conditions: [],
  evidenceRefs: [EVIDENCE.id],
  notes: null,
  supersedesReviewId: null,
  status: "ACTIVE",
  recordedAt: "2026-06-01T00:00:00Z",
};

async function seeded(): Promise<{
  db: SqliteD1Database;
  store: D1AuthorityStore;
}> {
  const db = new SqliteD1Database();
  db.applyMigrations();
  const report = await writeCorpusToD1(db, corpus());
  expect(report.conflicts).toEqual([]);

  const store = new D1AuthorityStore(db);
  await store.recordProvisionIdentity(IDENTITY);
  await store.recordProvisionMapping({
    id: "SYNTH-MAP-B",
    provisionIdentityId: IDENTITY.id,
    provisionVersionId: TARGET_PROVISION,
    documentVersionId: TARGET_VERSION,
    mappingType: "SAME",
    rationale: "Synthetic mapping for the lookup context test.",
    reviewStatus: "REVIEWED",
    createdAt: CREATED_AT,
  });
  await store.recordAssertion(ASSERTION);
  await store.recordEvidence(EVIDENCE);
  await store.recordReview(REVIEW);
  return { db, store };
}

function evidenceCodes(missing: string[]): string[] {
  return missing.filter((code) => code.startsWith("EVIDENCE_"));
}

describe("Gate 18 — the lookup's context documents", () => {
  it("names the under-loaded evidence document instead of skipping the check", async () => {
    const { store } = await seeded();
    const lookup = createAuthorityStatusLookup(store, {
      activity: ACTIVITY,
      documentActivityAuthorization: authorizationOver(registry(SOURCE_ID)),
    });

    const status = await lookup({
      documentId: TARGET_DOC,
      provisionId: TARGET_PROVISION,
      asOf: AS_OF,
    });

    // The evidence version is not in the snapshot. Before Gate 18 the review
    // was accepted here with no evidence code at all; now the gap is named and
    // the projection abstains.
    expect(status.missing).toContain(
      `EVIDENCE_DOCUMENT_NOT_LOADED:${EVIDENCE.id}`,
    );
    expect(evidenceCodes(status.missing).length).toBe(1);
    expect(status.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(status.abstained).toBe(true);
  });

  it("names the unauthorized evidence document once its rows are in scope", async () => {
    const { store } = await seeded();
    const lookup = createAuthorityStatusLookup(store, {
      activity: ACTIVITY,
      documentActivityAuthorization: authorizationOver(registry(SOURCE_ID)),
      contextDocumentIds: [EVIDENCE_DOC],
    });

    const status = await lookup({
      documentId: TARGET_DOC,
      provisionId: TARGET_PROVISION,
      asOf: AS_OF,
    });

    expect(status.missing).toContain(
      `EVIDENCE_AUTHORIZATION_NOT_CHECKED:${EVIDENCE.id}`,
    );
    expect(evidenceCodes(status.missing).length).toBe(1);
    expect(status.abstained).toBe(true);
  });

  it("still determines the state when the evidence document is authorized", async () => {
    const { store } = await seeded();
    const lookup = createAuthorityStatusLookup(store, {
      activity: ACTIVITY,
      documentActivityAuthorization: authorizationOver(
        registry(SOURCE_ID, OTHER_SOURCE_ID),
      ),
      contextDocumentIds: [EVIDENCE_DOC],
    });

    const status = await lookup({
      documentId: TARGET_DOC,
      provisionId: TARGET_PROVISION,
      asOf: AS_OF,
    });

    expect(evidenceCodes(status.missing)).toEqual([]);
    expect(status.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(status.state).toBe("PARTIALLY_AMENDED");
    expect(status.abstained).toBe(false);
  });

  it("keeps the no-authorization refusal at construction", async () => {
    const { store } = await seeded();
    expect(() =>
      createAuthorityStatusLookup(store, {
        activity: ACTIVITY,
        contextDocumentIds: [EVIDENCE_DOC],
      }),
    ).toThrow("authorization_required");
  });
});
