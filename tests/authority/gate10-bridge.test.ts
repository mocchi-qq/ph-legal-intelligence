// Gate 10 — end-to-end bridge: citation verifier → D1 authority ledger.
// Supplementary evidence only: SQLite shim, NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  createAuthorityStatusLookup,
  D1AuthorityStore,
} from "../../packages/legal-ingestion/src/index";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
  ProvisionVersionMapping,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DOCUMENT_ID = "doc1";

/** The corpus is a read-only view; the ledger is the source of temporal truth. */
const corpus: CitationCorpusView = {
  documents: [
    {
      id: DOCUMENT_ID,
      title: "Synthetic Bridge Act",
      citationText: "SYNTH-BRIDGE-0001",
      legalStatus: "UNKNOWN",
    },
  ],
  versions: [
    {
      id: "v1",
      documentId: DOCUMENT_ID,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      isCurrent: true,
    },
  ],
  provisions: [
    {
      id: "p1",
      documentId: DOCUMENT_ID,
      versionId: "v1",
      label: "Section 2",
      text: "Synthetic passage about bridge registration.",
      legalStatus: "UNKNOWN",
    },
  ],
  chunks: [
    {
      id: "c1",
      documentId: DOCUMENT_ID,
      versionId: "v1",
      provisionId: "p1",
      content: "Synthetic passage about bridge registration.",
    },
  ],
};

const IDENTITY: ProvisionIdentity = {
  id: "pi1",
  documentId: DOCUMENT_ID,
  provisionType: "SECTION",
  canonicalLabel: "Section 2",
  createdAt: "2026-01-02T00:00:00Z",
};

const MAPPING: ProvisionVersionMapping = {
  id: "m1",
  provisionIdentityId: "pi1",
  provisionVersionId: "p1",
  documentVersionId: "v1",
  mappingType: "SAME",
  rationale: "Synthetic identity carried across the version.",
  reviewStatus: "REVIEWED",
  createdAt: "2026-01-02T00:00:00Z",
};

const ASSERTION: EffectAssertion = {
  id: "a1",
  effectType: "ENACTMENT",
  sourceDocumentId: DOCUMENT_ID,
  sourceVersionId: "v1",
  sourceProvisionId: "p1",
  targetDocumentId: DOCUMENT_ID,
  targetProvisionIdentityId: "pi1",
  targetVersionId: "v1",
  scope: "Section 2",
  claimedDate: "2026-06-15",
  claimedEffectiveDate: "2026-07-01",
  evidenceId: "ev1",
  sourceLocator: "Section 2",
  assertionOrigin: "synthetic-seed",
  recordedAt: "2026-06-16T00:00:00Z",
  recordedBy: "synthetic-registrar",
  state: "PENDING_REVIEW",
  supersedesAssertionId: null,
  conflictGroupId: null,
};

const EVIDENCE: EffectEvidence = {
  id: "ev1",
  assertionId: "a1",
  documentVersionId: "v1",
  provisionVersionId: "p1",
  artifactId: null,
  contentHash: HASH,
  passage: "Synthetic enactment passage.",
  locator: "Section 2",
  evidenceDate: "2026-06-15",
  classification: "OFFICIAL_PRIMARY",
  availability: "AVAILABLE",
  checkedAt: "2026-06-16T00:00:00Z",
};

const CONFIRMED: LegalEffectReview = {
  id: "r1",
  assertionId: "a1",
  outcome: "CONFIRMED",
  reviewerId: "counsel-1",
  reviewerCapacity: "Counsel",
  decisionDate: "2026-07-15",
  scope: "Section 2",
  propositionReviewed: "Section 2 was enacted and is in force.",
  conditions: [],
  evidenceRefs: ["ev1"],
  notes: null,
  supersedesReviewId: null,
  status: "ACTIVE",
  recordedAt: "2026-07-15T00:00:00Z",
};

const REVOKED: LegalEffectReview = {
  id: "r2",
  assertionId: "a1",
  outcome: "REJECTED",
  reviewerId: "counsel-2",
  reviewerCapacity: "Counsel",
  decisionDate: "2026-09-15",
  scope: "Section 2",
  propositionReviewed: "Section 2 was enacted and is in force.",
  conditions: [],
  evidenceRefs: ["ev1"],
  notes: "Synthetic revocation. Not a real counsel determination.",
  supersedesReviewId: "r1",
  status: "REVOKED",
  recordedAt: "2026-09-15T00:00:00Z",
};

async function seed(): Promise<D1AuthorityStore> {
  const db = new SqliteD1Database();
  db.applyMigrations();
  db.db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('${DOCUMENT_ID}', 'REPUBLIC_ACT', 'Synthetic Bridge Act', 'UNKNOWN',
       'UNVERIFIED', 'official_primary');

    INSERT INTO document_versions
      (id, document_id, version_number, content_hash, is_current,
       effective_from)
    VALUES
      ('v1', '${DOCUMENT_ID}', 1, '${HASH}', 1, '2026-01-01');

    INSERT INTO legal_provisions
      (id, document_id, version_id, provision_type, label, text, ordinal,
       legal_status)
    VALUES
      ('p1', '${DOCUMENT_ID}', 'v1', 'SECTION', 'Section 2',
       'Synthetic passage about bridge registration.', 1, 'UNKNOWN');
  `);

  const store = new D1AuthorityStore(db);
  await store.recordProvisionIdentity(IDENTITY);
  await store.recordProvisionMapping(MAPPING);
  await store.recordAssertion(ASSERTION);
  await store.recordEvidence(EVIDENCE);
  await store.recordReview(CONFIRMED);
  return store;
}

function verifierFor(store: D1AuthorityStore) {
  return createCitationVerifier(corpus, {
    authority: createAuthorityStatusLookup(store, {
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "AUTHORIZED",
      },
    }),
  });
}

const CITATION = {
  citationText: "SYNTH-BRIDGE-0001",
  documentId: DOCUMENT_ID,
  passageId: "c1",
  proposition: "Synthetic passage about bridge registration",
  relevantDate: "2026-08-01",
};

describe("Gate 10 bridge — ledger to citation temporal validity", () => {
  it("passes through the reviewed projection for a mapped provision", async () => {
    const store = await seed();

    const result = await verifierFor(store).verify(CITATION);

    expect(result.temporalValidity).toBe(true);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(result.authorityStatus?.state).toBe("IN_FORCE");
    expect(result.authorityStatus?.abstained).toBe(false);
    expect(result.authorityStatus?.missing).toEqual([]);
    expect(result.authorityStatus?.versionId).toBe("v1");
    expect(result.layerResults.TEMPORAL_VALIDITY.evidence).toContain(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("fails once a revoked review supersedes the confirmed one", async () => {
    const store = await seed();
    const before = await verifierFor(store).verify(CITATION);
    expect(before.temporalValidity).toBe(true);

    await store.recordReview(REVOKED);

    const after = await verifierFor(store).verify(CITATION);

    expect(after.temporalValidity).toBe(false);
    expect(after.temporalSource).toBe("authority_projection");
    expect(after.authorityStatus?.outcome).not.toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(after.authorityStatus?.abstained).toBe(true);
    expect(after.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });
});
