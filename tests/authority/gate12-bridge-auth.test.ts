// Gate 12 — end-to-end bridge: authorization reaches the citation verifier.
// Supplementary evidence only: SQLite shim, NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  type AuthorizationInput,
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
/** A second instrument that claims an effect on doc1 but is not the target. */
const SOURCE_DOCUMENT_ID = "doc2";

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

interface SeedOptions {
  /**
   * The instrument the assertion is derived from. `doc2` is a separate
   * document in the ledger with no assertion of its own.
   */
  sourceDocumentId?: string;
}

function assertionFor(sourceDocumentId: string): EffectAssertion {
  const sameDocument = sourceDocumentId === DOCUMENT_ID;
  return {
    id: "a1",
    effectType: "ENACTMENT",
    sourceDocumentId,
    sourceVersionId: sameDocument ? "v1" : null,
    sourceProvisionId: sameDocument ? "p1" : null,
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
}

async function seed(options: SeedOptions = {}): Promise<D1AuthorityStore> {
  const sourceDocumentId = options.sourceDocumentId ?? DOCUMENT_ID;
  const db = new SqliteD1Database();
  db.applyMigrations();
  db.db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('${DOCUMENT_ID}', 'REPUBLIC_ACT', 'Synthetic Bridge Act', 'UNKNOWN',
       'UNVERIFIED', 'official_primary'),
      ('${SOURCE_DOCUMENT_ID}', 'REPUBLIC_ACT', 'Synthetic Amending Act',
       'UNKNOWN', 'UNVERIFIED', 'official_primary');

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
  await store.recordAssertion(assertionFor(sourceDocumentId));
  await store.recordEvidence(EVIDENCE);
  await store.recordReview(CONFIRMED);
  return store;
}

function verifierFor(
  store: D1AuthorityStore,
  authorization: AuthorizationInput,
) {
  return createCitationVerifier(corpus, {
    authority: createAuthorityStatusLookup(store, { authorization }),
  });
}

const CITATION = {
  citationText: "SYNTH-BRIDGE-0001",
  documentId: DOCUMENT_ID,
  passageId: "c1",
  proposition: "Synthetic passage about bridge registration",
  relevantDate: "2026-08-01",
};

describe("Gate 12 bridge — authorization gating reaches the verifier", () => {
  it("fails layer 4 when authorization was not checked", async () => {
    const store = await seed();

    const result = await verifierFor(store, "NOT_CHECKED").verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toContain(
      "AUTHORIZATION_NOT_CHECKED",
    );
    expect(result.temporalValidity).toBe(false);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("fails layer 4 when processing is unauthorized", async () => {
    const store = await seed();

    const result = await verifierFor(store, "UNAUTHORIZED").verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNAUTHORIZED");
    expect(result.authorityStatus?.missing).toEqual(["NOT_AUTHORIZED"]);
    expect(result.temporalValidity).toBe(false);
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("still passes layer 4 when the target is authorized", async () => {
    const store = await seed();

    const result = await verifierFor(store, "AUTHORIZED").verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
    expect(result.temporalValidity).toBe(true);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(result.authorityStatus?.state).toBe("IN_FORCE");
    expect(result.authorityStatus?.abstained).toBe(false);
    expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("does not let an unchecked source ground a determination for an authorized target", async () => {
    const store = await seed({ sourceDocumentId: SOURCE_DOCUMENT_ID });

    const result = await verifierFor(store, (documentId) =>
      documentId === DOCUMENT_ID ? "AUTHORIZED" : "NOT_CHECKED",
    ).verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toContain(
      "SOURCE_AUTHORIZATION_NOT_CHECKED:a1",
    );
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });
});
