// Gate 10 — D1 authority ledger adapter against the SQLite shim.
// Supplementary evidence only: this is NOT D1 runtime validation.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import type { CitationCorpusView } from "../../packages/citation-engine/src/index";
import { createCitationVerifier } from "../../packages/citation-engine/src/index";
import {
  D1AuthorityStore,
  projectAuthorityState,
} from "../../packages/legal-ingestion/src/index";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionIdentity,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function fresh(): { db: SqliteD1Database; store: D1AuthorityStore } {
  const db = new SqliteD1Database();
  db.applyMigrations();
  db.db.exec(`
    INSERT INTO legal_documents
      (id, document_type, title, legal_status, verification_status,
       authority_level)
    VALUES
      ('doc1', 'REPUBLIC_ACT', 'Synthetic Act', 'UNKNOWN', 'UNVERIFIED',
       'official_primary');

    INSERT INTO document_versions
      (id, document_id, version_number, content_hash, is_current,
       effective_from)
    VALUES
      ('v1', 'doc1', 1, '${HASH}', 1, '2026-01-01');

    INSERT INTO legal_provisions
      (id, document_id, version_id, provision_type, label, text, ordinal,
       legal_status)
    VALUES
      ('p1', 'doc1', 'v1', 'SECTION', 'Section 2', 'Synthetic.', 1,
       'UNKNOWN');
  `);
  return { db, store: new D1AuthorityStore(db) };
}

const IDENTITY: ProvisionIdentity = {
  id: "pi1",
  documentId: "doc1",
  provisionType: "SECTION",
  canonicalLabel: "Section 2",
  createdAt: "2026-01-02T00:00:00Z",
};

const ASSERTION: EffectAssertion = {
  id: "a1",
  effectType: "PARTIAL_AMENDMENT",
  sourceDocumentId: "doc1",
  sourceVersionId: "v1",
  sourceProvisionId: "p1",
  targetDocumentId: "doc1",
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
  passage: "Synthetic amending passage.",
  locator: "Section 2",
  evidenceDate: "2026-06-15",
  classification: "OFFICIAL_PRIMARY",
  availability: "AVAILABLE",
  checkedAt: "2026-06-16T00:00:00Z",
};

const REVIEW: LegalEffectReview = {
  id: "r1",
  assertionId: "a1",
  outcome: "CONFIRMED",
  reviewerId: "counsel-1",
  reviewerCapacity: "Counsel",
  decisionDate: "2026-07-15",
  scope: "Section 2",
  propositionReviewed: "Section 2 is partially amended.",
  conditions: [],
  evidenceRefs: ["ev1"],
  notes: null,
  supersedesReviewId: null,
  status: "ACTIVE",
  recordedAt: "2026-07-15T00:00:00Z",
};

async function seed(store: D1AuthorityStore): Promise<void> {
  await store.recordProvisionIdentity(IDENTITY);
  await store.recordAssertion(ASSERTION);
  await store.recordEvidence(EVIDENCE);
  await store.recordReview(REVIEW);
}

describe("D1AuthorityStore", () => {
  it("loads a snapshot and projects the reviewed state", async () => {
    const { store } = fresh();
    await seed(store);

    const snapshot = await store.loadStateFor("doc1");
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0]).toEqual({
      id: "doc1",
      documentType: "REPUBLIC_ACT",
      title: "Synthetic Act",
    });
    expect(snapshot.versions).toHaveLength(1);
    expect(snapshot.versions[0]).toEqual({
      id: "v1",
      documentId: "doc1",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });
    expect(snapshot.provisions).toHaveLength(1);
    expect(snapshot.provisions[0]).toEqual({
      id: "p1",
      documentId: "doc1",
      versionId: "v1",
      label: "Section 2",
      text: "Synthetic.",
    });
    expect(snapshot.provisionIdentities).toEqual([IDENTITY]);
    expect(snapshot.assertions).toEqual([ASSERTION]);
    expect(snapshot.evidence).toEqual([EVIDENCE]);
    expect(snapshot.reviews).toEqual([REVIEW]);

    expect(await store.getAssertion("a1")).toEqual(ASSERTION);
    expect(await store.getAssertion("missing")).toBeNull();
    expect(await store.listAssertionsFor("doc1")).toEqual([ASSERTION]);
    expect(await store.listEvidence("a1")).toEqual([EVIDENCE]);
    expect(await store.listReviews("a1")).toEqual([REVIEW]);

    const projection = projectAuthorityState({
      snapshot,
      documentId: "doc1",
      asOf: "2026-08-01",
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "AUTHORIZED",
      },
    });
    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
    expect(projection.assertions).toEqual(["a1"]);
    expect(projection.reviews).toEqual(["r1"]);
    expect(projection.evidence).toEqual(["ev1"]);
    expect(projection.abstained).toBe(false);
  });

  it("returns an empty snapshot for an unknown document", async () => {
    const { store } = fresh();
    const snapshot = await store.loadStateFor("missing");
    expect(snapshot.documents).toEqual([]);
    expect(snapshot.assertions).toEqual([]);
    expect(snapshot.evidence).toEqual([]);
    expect(snapshot.reviews).toEqual([]);
  });

  it("rejects a duplicate assertion as duplicate_authority_record", async () => {
    const { store } = fresh();
    await seed(store);
    await expect(store.recordAssertion(ASSERTION)).rejects.toThrow(
      "duplicate_authority_record",
    );
  });

  it("rejects a duplicate provision identity", async () => {
    const { store } = fresh();
    await store.recordProvisionIdentity(IDENTITY);
    await expect(store.recordProvisionIdentity(IDENTITY)).rejects.toThrow(
      /duplicate_authority_record/,
    );
  });

  it("loads a cross-document supersession so the projection excludes the superseded assertion", async () => {
    const { db, store } = fresh();
    db.db.exec(`
      INSERT INTO legal_documents
        (id, document_type, title, legal_status, verification_status,
         authority_level)
      VALUES
        ('doc2', 'REPUBLIC_ACT', 'Synthetic Amending Act', 'UNKNOWN',
         'UNVERIFIED', 'official_primary');

      INSERT INTO document_versions
        (id, document_id, version_number, content_hash, is_current,
         effective_from)
      VALUES
        ('v2', 'doc2', 1, '${HASH}', 1, '2026-01-01');

      INSERT INTO legal_provisions
        (id, document_id, version_id, provision_type, label, text, ordinal,
         legal_status)
      VALUES
        ('p2', 'doc2', 'v2', 'SECTION', 'Section 1', 'Synthetic amend.', 1,
         'UNKNOWN');
    `);

    const superseding: EffectAssertion = {
      ...ASSERTION,
      id: "a2",
      effectType: "REPEAL",
      sourceDocumentId: "doc2",
      sourceVersionId: "v2",
      sourceProvisionId: "p2",
      targetDocumentId: "doc2",
      targetProvisionIdentityId: null,
      targetVersionId: "v2",
      scope: "Section 1",
      claimedDate: "2026-09-01",
      claimedEffectiveDate: "2026-10-01",
      evidenceId: "ev2",
      state: "UNREVIEWED",
      supersedesAssertionId: "a1",
    };

    await seed(store);
    await store.recordAssertion(superseding);
    await store.recordEvidence({
      ...EVIDENCE,
      id: "ev2",
      assertionId: "a2",
      documentVersionId: "v2",
      provisionVersionId: "p2",
      passage: "Synthetic repealing passage.",
      evidenceDate: "2026-09-01",
      checkedAt: "2026-09-02T00:00:00Z",
    });
    await store.recordReview({
      ...REVIEW,
      id: "r2",
      assertionId: "a2",
      decisionDate: "2026-09-15",
      propositionReviewed: "Section 2 is repealed.",
      evidenceRefs: ["ev2"],
      recordedAt: "2026-09-15T00:00:00Z",
    });

    const snapshot = await store.loadStateFor("doc1");
    expect(snapshot.assertions.map((assertion) => assertion.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(
      snapshot.assertions.find((assertion) => assertion.id === "a1"),
    ).toEqual(ASSERTION);
    // Out-of-scope rows carry no evidence or reviews into the snapshot.
    expect(snapshot.evidence.map((evidence) => evidence.id)).toEqual(["ev1"]);
    expect(snapshot.reviews.map((review) => review.id)).toEqual(["r1"]);

    const projection = projectAuthorityState({
      snapshot,
      documentId: "doc1",
      asOf: "2026-12-01",
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "AUTHORIZED",
      },
    });
    expect(projection.assertions).not.toContain("a1");
    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("NO_ASSERTION");
  });

  it("is append-only: UPDATE on assertions is refused by the trigger", async () => {
    const { db, store } = fresh();
    await seed(store);
    expect(() =>
      db.db
        .prepare(
          "UPDATE legal_effect_assertions SET scope = 'rewritten' WHERE id = ?",
        )
        .run("a1"),
    ).toThrow(/append-only/);
  });

  it("D1 snapshot drives verifier layer 4 and revocation flips it", async () => {
    const { store } = fresh();
    await seed(store);

    // The verifier is storage-free, so the synthetic corpus is described here.
    const view: CitationCorpusView = {
      documents: [
        {
          id: "doc1",
          title: "Synthetic Act",
          citationText: "SYNTH-ACT-0001",
          legalStatus: "UNKNOWN",
          promulgationDate: null,
        },
      ],
      versions: [
        {
          id: "v1",
          documentId: "doc1",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          isCurrent: true,
        },
      ],
      provisions: [
        {
          id: "p1",
          documentId: "doc1",
          versionId: "v1",
          label: "Section 2",
          text: "Synthetic passage about registration.",
          legalStatus: "UNKNOWN",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
        },
      ],
      chunks: [
        {
          id: "c1",
          documentId: "doc1",
          versionId: "v1",
          provisionId: "p1",
          content: "Synthetic passage about registration.",
        },
      ],
    };

    // A corpus provision id is the concrete provision version; the projection is
    // keyed by the stable provision identity, so resolve the identity for this
    // document and label before projecting.
    const verifier = createCitationVerifier(view, {
      authority: async ({ documentId, provisionId, asOf }) => {
        const snapshot = await store.loadStateFor(documentId);
        const provision = view.provisions.find(
          (candidate) => candidate.id === provisionId,
        );
        const identity = provision
          ? snapshot.provisionIdentities.find(
              (candidate) =>
                candidate.documentId === provision.documentId &&
                candidate.canonicalLabel === provision.label,
            )
          : undefined;
        const projection = projectAuthorityState({
          snapshot,
          documentId,
          ...(identity ? { provisionIdentityId: identity.id } : {}),
          asOf,
          activity: "citation_display",
          authorizationAssertion: {
            activity: "citation_display",
            decision: "AUTHORIZED",
          },
        });
        return {
          outcome: projection.outcome,
          state: projection.state,
          explanation: projection.explanation,
          abstained: projection.abstained,
        };
      },
    });

    const citation = {
      citationText: "SYNTH-ACT-0001",
      documentId: "doc1",
      passageId: "c1",
      proposition: "Synthetic passage about registration",
      relevantDate: "2026-08-01",
    };

    const first = await verifier.verify(citation);
    expect(first.temporalValidity).toBe(true);
    expect(first.temporalSource).toBe("authority_projection");

    // Revocation is a new append-only review row that supersedes r1. `REVOKED`
    // is a review status, not a review outcome, so the row carries the reviewed
    // disposition (REJECTED) alongside the terminal status.
    const revocation: LegalEffectReview = {
      id: "r2",
      assertionId: "a1",
      outcome: "REJECTED",
      reviewerId: "counsel-1",
      reviewerCapacity: "Counsel",
      decisionDate: "2026-08-02",
      scope: "Section 2",
      propositionReviewed: "Section 2 is partially amended.",
      conditions: [],
      evidenceRefs: ["ev1"],
      notes: "Revoked on re-review.",
      supersedesReviewId: REVIEW.id,
      status: "REVOKED",
      recordedAt: "2026-08-02T00:00:00Z",
    };
    await store.recordReview(revocation);

    const second = await verifier.verify(citation);
    expect(second.temporalValidity).toBe(false);
    expect(second.temporalSource).toBe("authority_projection");
  });
});
