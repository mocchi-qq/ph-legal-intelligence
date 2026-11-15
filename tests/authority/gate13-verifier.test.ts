// Gate 13 — verifier bridge: the activity an authorization decision was made for
// reaches citation verification, and layer 4 stays a pure predicate over the
// projected status.
// Supplementary evidence only: SQLite shim, NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  type Activity,
  ActivityAuthorizationRegistry,
  type ActivityStatus,
  createAuthorityStatusLookup,
  createRegistryAuthorization,
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
const SOURCE_ID = "SYNTH-SRC-1";
const SOURCE_DOCUMENT_SOURCE_ID = "SYNTH-SRC-2";

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

function assertionFor(
  index: number,
  sourceDocumentId: string,
): EffectAssertion {
  const fromTarget = sourceDocumentId === DOCUMENT_ID;
  return {
    id: `a${index}`,
    effectType: "ENACTMENT",
    sourceDocumentId,
    sourceVersionId: fromTarget ? "v1" : null,
    sourceProvisionId: fromTarget ? "p1" : null,
    targetDocumentId: DOCUMENT_ID,
    targetProvisionIdentityId: "pi1",
    targetVersionId: "v1",
    scope: "Section 2",
    claimedDate: "2026-06-15",
    claimedEffectiveDate: "2026-07-01",
    evidenceId: `ev${index}`,
    sourceLocator: "Section 2",
    assertionOrigin: "synthetic-seed",
    recordedAt: "2026-06-16T00:00:00Z",
    recordedBy: "synthetic-registrar",
    state: "PENDING_REVIEW",
    supersedesAssertionId: null,
    conflictGroupId: null,
  };
}

function evidenceFor(index: number): EffectEvidence {
  return {
    id: `ev${index}`,
    assertionId: `a${index}`,
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
}

function reviewFor(index: number): LegalEffectReview {
  return {
    id: `r${index}`,
    assertionId: `a${index}`,
    outcome: "CONFIRMED",
    reviewerId: "counsel-1",
    reviewerCapacity: "Counsel",
    decisionDate: "2026-07-15",
    scope: "Section 2",
    propositionReviewed: "Section 2 was enacted and is in force.",
    conditions: [],
    evidenceRefs: [`ev${index}`],
    notes: null,
    supersedesReviewId: null,
    status: "ACTIVE",
    recordedAt: "2026-07-15T00:00:00Z",
  };
}

/**
 * Seed one confirmed effect per entry of `sources`. `doc1` is the target; `doc2`
 * is a separate instrument with no version or provision of its own.
 */
async function seed(
  sources: string[] = [DOCUMENT_ID],
): Promise<D1AuthorityStore> {
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
  for (const [index, sourceDocumentId] of sources.entries()) {
    const position = index + 1;
    await store.recordAssertion(assertionFor(position, sourceDocumentId));
    await store.recordEvidence(evidenceFor(position));
    await store.recordReview(reviewFor(position));
  }
  return store;
}

/** documentId -> sourceId. No other document has a resolvable source. */
function sourceOfDocument(documentId: string): string | null {
  if (documentId === DOCUMENT_ID) return SOURCE_ID;
  if (documentId === SOURCE_DOCUMENT_ID) return SOURCE_DOCUMENT_SOURCE_ID;
  return null;
}

/** Record one synthetic decision in the real Gate 4 registry. */
function record(
  registry: ActivityAuthorizationRegistry,
  sourceId: string,
  activity: Activity,
  status: ActivityStatus,
): void {
  registry.record(
    {
      sourceId,
      activity,
      status,
      basis: "SYNTHETIC_FIXTURE",
      evidenceRef: `synthetic://gate13/${sourceId}/${activity}`,
      reviewer: "synthetic-reviewer",
      decisionDate: "2026-01-05",
    },
    "synthetic-actor",
    `synthetic ${status} decision for ${activity}`,
    "test",
  );
}

function verifierFor(
  store: D1AuthorityStore,
  registry: ActivityAuthorizationRegistry,
) {
  return createCitationVerifier(corpus, {
    authority: createAuthorityStatusLookup(store, {
      activity: "citation_display",
      documentActivityAuthorization: createRegistryAuthorization({
        registry,
        sourceOfDocument,
      }),
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

describe("Gate 13 verifier — the decision's activity reaches layer 4", () => {
  it("passes when the target is authorized for citation_display", async () => {
    const store = await seed();
    const registry = new ActivityAuthorizationRegistry();
    record(registry, SOURCE_ID, "citation_display", "AUTHORIZED");

    const result = await verifierFor(store, registry).verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
    expect(result.temporalValidity).toBe(true);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(result.authorityStatus?.state).toBe("IN_FORCE");
    expect(result.authorityStatus?.abstained).toBe(false);
    expect(result.authorityStatus?.missing).toEqual([]);
    expect(result.authorityStatus?.authorizationSource).toBe(
      "document_activity",
    );
    expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("fails when only viewing is authorized and the lookup asks for citation_display", async () => {
    const store = await seed();
    const registry = new ActivityAuthorizationRegistry();
    record(registry, SOURCE_ID, "viewing", "AUTHORIZED");

    const result = await verifierFor(store, registry).verify(CITATION);

    // The decision is real, but it answers a different question.
    expect(registry.latest(SOURCE_ID, "viewing")?.status).toBe("AUTHORIZED");
    expect(registry.latest(SOURCE_ID, "citation_display")).toBeNull();

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.state).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    // The projection's own reason is preserved in the layer evidence.
    const explanation =
      "Authorization for this document has not been checked; no determination is projected.";
    expect(result.layerResults.TEMPORAL_VALIDITY.evidence).toBe(
      `UNKNOWN/UNKNOWN: ${explanation}`,
    );
    expect(result.authorityStatus?.explanation).toBe(explanation);
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("fails closed when the target has no recorded decision at all", async () => {
    const store = await seed();
    const registry = new ActivityAuthorizationRegistry();

    const result = await verifierFor(store, registry).verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    expect(result.authorityStatus?.missing).toContain(
      "AUTHORIZATION_NOT_CHECKED",
    );
    expect(result.authorityStatus?.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("refuses a target prohibited for citation_display", async () => {
    const store = await seed();
    const registry = new ActivityAuthorizationRegistry();
    record(registry, SOURCE_ID, "citation_display", "PROHIBITED");

    const result = await verifierFor(store, registry).verify(CITATION);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNAUTHORIZED");
    expect(result.authorityStatus?.abstained).toBe(false);
    expect(result.authorityStatus?.missing).toEqual([
      "NOT_AUTHORIZED",
      "activity:citation_display",
    ]);
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("excludes a source authorized only for viewing and says so", async () => {
    const store = await seed([SOURCE_DOCUMENT_ID]);
    const registry = new ActivityAuthorizationRegistry();
    record(registry, SOURCE_ID, "citation_display", "AUTHORIZED");
    record(registry, SOURCE_DOCUMENT_SOURCE_ID, "viewing", "AUTHORIZED");

    const result = await verifierFor(store, registry).verify(CITATION);

    expect(registry.check(SOURCE_DOCUMENT_SOURCE_ID, "viewing").allowed).toBe(
      true,
    );
    expect(
      registry.check(SOURCE_DOCUMENT_SOURCE_ID, "citation_display").allowed,
    ).toBe(false);

    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(false);
    expect(result.temporalValidity).toBe(false);
    expect(result.authorityStatus?.outcome).toBe("UNKNOWN");
    expect(result.authorityStatus?.abstained).toBe(true);
    // `viewing` was decided; `citation_display` was not, so the registry yields
    // the not-checked variant rather than the not-authorized one.
    expect(result.authorityStatus?.missing).toEqual([
      "SOURCE_AUTHORIZATION_NOT_CHECKED:a1",
    ]);
    expect(result.states).not.toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("still determines from an authorized source while reporting the excluded one", async () => {
    const store = await seed([SOURCE_DOCUMENT_ID, DOCUMENT_ID]);
    const registry = new ActivityAuthorizationRegistry();
    record(registry, SOURCE_ID, "citation_display", "AUTHORIZED");
    record(
      registry,
      SOURCE_DOCUMENT_SOURCE_ID,
      "citation_display",
      "PROHIBITED",
    );

    const result = await verifierFor(store, registry).verify(CITATION);

    // The determination is real, and the basis it was built from is incomplete
    // in exactly one documented way.
    expect(result.layerResults.TEMPORAL_VALIDITY.passed).toBe(true);
    expect(result.temporalValidity).toBe(true);
    expect(result.temporalSource).toBe("authority_projection");
    expect(result.authorityStatus?.outcome).toBe(
      "DETERMINED_WITH_REVIEWED_EVIDENCE",
    );
    expect(result.authorityStatus?.state).toBe("IN_FORCE");
    expect(result.authorityStatus?.abstained).toBe(false);
    expect(result.authorityStatus?.missing).toEqual([
      "SOURCE_NOT_AUTHORIZED:a1",
    ]);
    expect(result.authorityStatus?.authorizationSource).toBe(
      "document_activity",
    );
    expect(result.states).toContain("VERIFIED_TEMPORAL_STATUS");
  });

  it("throws authorization_required when constructed with no authorization input", async () => {
    const store = await seed();

    expect(() => createAuthorityStatusLookup(store, {} as never)).toThrow(
      "authorization_required",
    );
  });
});
