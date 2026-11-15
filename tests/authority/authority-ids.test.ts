// Deterministic authority record ids — canonical JSON and derived ids.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import {
  AuthorityLedger,
  canonicalJson,
  D1AuthorityStore,
  deriveAssertionId,
  deriveAuthorityId,
  deriveEvidenceId,
  deriveProvisionIdentityId,
  deriveProvisionMappingId,
  deriveReviewId,
} from "../../packages/legal-ingestion/src/index";
import type {
  EffectAssertion,
  EffectEvidence,
  LegalEffectReview,
  ProvisionVersionMapping,
} from "../../packages/legal-schema/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

type AssertionFields = Omit<
  EffectAssertion,
  "id" | "recordedAt" | "recordedBy"
>;
type EvidenceFields = Omit<EffectEvidence, "id" | "checkedAt">;
type ReviewFields = Omit<LegalEffectReview, "id" | "recordedAt">;
type MappingFields = Omit<ProvisionVersionMapping, "id" | "createdAt">;

/** Identity fields of a synthetic assertion, in a fixed source order. */
function assertionFields(): AssertionFields {
  return {
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: "SYNTH-ACT-0001",
    sourceVersionId: "SYNTH-ACT-0001-v1",
    sourceProvisionId: "SYNTH-SEC-0001",
    targetDocumentId: "SYNTH-ACT-0001",
    targetProvisionIdentityId: "SYNTH-PROV-0001",
    targetVersionId: "SYNTH-ACT-0001-v1",
    scope: "Section 2",
    claimedDate: "2026-06-15",
    claimedEffectiveDate: "2026-07-01",
    evidenceId: "SYNTH-EV-0001",
    sourceLocator: "Section 2",
    assertionOrigin: "synthetic-seed",
    state: "PENDING_REVIEW",
    supersedesAssertionId: null,
    conflictGroupId: null,
  };
}

/** The same fields, written in a different key order on purpose. */
function assertionFieldsReordered(): AssertionFields {
  return {
    conflictGroupId: null,
    supersedesAssertionId: null,
    state: "PENDING_REVIEW",
    assertionOrigin: "synthetic-seed",
    sourceLocator: "Section 2",
    evidenceId: "SYNTH-EV-0001",
    claimedEffectiveDate: "2026-07-01",
    claimedDate: "2026-06-15",
    scope: "Section 2",
    targetVersionId: "SYNTH-ACT-0001-v1",
    targetProvisionIdentityId: "SYNTH-PROV-0001",
    targetDocumentId: "SYNTH-ACT-0001",
    sourceProvisionId: "SYNTH-SEC-0001",
    sourceVersionId: "SYNTH-ACT-0001-v1",
    sourceDocumentId: "SYNTH-ACT-0001",
    effectType: "PARTIAL_AMENDMENT",
  };
}

/** Identity fields of synthetic evidence supporting an assertion. */
function evidenceFields(): EvidenceFields {
  return {
    assertionId: "SYNTH-LEA-0001",
    documentVersionId: "SYNTH-ACT-0001-v1",
    provisionVersionId: "SYNTH-SEC-0001",
    artifactId: "SYNTH-ART-0001",
    contentHash: HASH,
    passage: "Synthetic provision text.",
    locator: "Section 2",
    evidenceDate: "2026-06-15",
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
  };
}

/** Identity fields of a synthetic provision-version mapping. */
function mappingFields(): MappingFields {
  return {
    provisionIdentityId: "SYNTH-PI-0001",
    provisionVersionId: "SYNTH-SEC-0001",
    documentVersionId: "SYNTH-ACT-0001-v1",
    mappingType: "SAME",
    rationale: "Synthetic continuity.",
    reviewStatus: "UNREVIEWED",
  };
}

function reviewFields(): ReviewFields {
  return {
    assertionId: "SYNTH-LEA-0001",
    outcome: "CONFIRMED",
    reviewerId: "synthetic-counsel-1",
    reviewerCapacity: "Counsel",
    decisionDate: "2026-07-15",
    scope: "Section 2",
    propositionReviewed: "Section 2 is partially amended.",
    conditions: [],
    evidenceRefs: ["SYNTH-LEE-0001"],
    notes: null,
    supersedesReviewId: null,
    status: "ACTIVE",
  };
}

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/** SQLite shim plus the minimum document/version/provision rows, as in the
 * D1 adapter suite. Supplementary evidence only: not D1 runtime validation. */
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

describe("deterministic authority ids", () => {
  it("is deterministic: the same fields built twice yield the same assertion id", () => {
    const first = deriveAssertionId(assertionFields());
    const second = deriveAssertionId(assertionFields());

    expect(first).toBe(second);
    expect(first).toMatch(/^lea_[0-9a-f]{32}$/);

    // The wrapper hashes the identity fields only — lifecycle `state` and
    // review-time `conflictGroupId` are not among them.
    const identity: Record<string, unknown> = { ...assertionFields() };
    delete identity.state;
    delete identity.conflictGroupId;
    expect(deriveAuthorityId("lea", identity)).toBe(first);
  });

  it("ignores object key insertion order in canonicalJson and in derived ids", () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');

    expect(canonicalJson(assertionFields())).toBe(
      canonicalJson(assertionFieldsReordered()),
    );
    expect(deriveAssertionId(assertionFieldsReordered())).toBe(
      deriveAssertionId(assertionFields()),
    );
  });

  it("is sensitive to identity fields: claimedEffectiveDate, targetProvisionIdentityId and effectType", () => {
    const base = deriveAssertionId(assertionFields());

    const laterEffective = deriveAssertionId({
      ...assertionFields(),
      claimedEffectiveDate: "2026-08-01",
    });
    const otherTarget = deriveAssertionId({
      ...assertionFields(),
      targetProvisionIdentityId: "SYNTH-PROV-0002",
    });
    const otherEffect = deriveAssertionId({
      ...assertionFields(),
      effectType: "REPEAL",
    });

    expect(laterEffective).not.toBe(base);
    expect(otherTarget).not.toBe(base);
    expect(otherEffect).not.toBe(base);
    expect(new Set([base, laterEffective, otherTarget, otherEffect]).size).toBe(
      4,
    );
  });

  it("is insensitive to lifecycle state: assertion state is excluded from the id", () => {
    // Identity is the claim, not where it sits in review. UNREVIEWED →
    // PENDING_REVIEW → CONFLICTED/SUPERSEDED must not mint a new id, or the
    // append-only store would fork the claim's history instead of rejecting a
    // re-derivation as duplicate_authority_record.
    const base = deriveAssertionId(assertionFields());

    expect(base).toMatch(/^lea_[0-9a-f]{32}$/);
    expect(
      deriveAssertionId({ ...assertionFields(), state: "UNREVIEWED" }),
    ).toBe(base);
    expect(
      deriveAssertionId({ ...assertionFields(), state: "CONFLICTED" }),
    ).toBe(base);
    expect(
      deriveAssertionId({ ...assertionFields(), state: "SUPERSEDED" }),
    ).toBe(base);
  });

  it("is insensitive to review-time conflict grouping: a different conflictGroupId gives the same assertion id", () => {
    // conflictGroupId is grouping metadata assigned during review, not the
    // claim. Grouping a claim later must not mint a new id.
    const base = deriveAssertionId(assertionFields());

    expect(
      deriveAssertionId({
        ...assertionFields(),
        conflictGroupId: "SYNTH-CG-1",
      }),
    ).toBe(base);
    expect(
      deriveAssertionId({
        ...assertionFields(),
        conflictGroupId: "SYNTH-CG-2",
      }),
    ).toBe(base);
  });

  it("treats lineage as identity: a different supersedesAssertionId gives a different assertion id", () => {
    const original = deriveAssertionId({
      ...assertionFields(),
      supersedesAssertionId: null,
    });
    const superseding = deriveAssertionId({
      ...assertionFields(),
      supersedesAssertionId: "SYNTH-LEA-0000",
    });

    expect(superseding).not.toBe(original);
    expect(
      deriveAssertionId({
        ...assertionFields(),
        supersedesAssertionId: "SYNTH-LEA-9999",
      }),
    ).not.toBe(superseding);
  });

  it("is insensitive to lifecycle availability: evidence differing only in availability derives the same id", () => {
    // Evidence moves NOT_RECEIVED → AVAILABLE over time. Hashing availability
    // would fork the same evidence at the first change.
    const base = deriveEvidenceId(evidenceFields());

    expect(base).toMatch(/^lee_[0-9a-f]{32}$/);
    expect(
      deriveEvidenceId({ ...evidenceFields(), availability: "NOT_RECEIVED" }),
    ).toBe(base);
    expect(
      deriveEvidenceId({ ...evidenceFields(), availability: "UNAVAILABLE" }),
    ).toBe(base);
  });

  it("is sensitive to evidence classification: a different classification derives a different id", () => {
    // classification is the substantive classification of the evidence, so it
    // stays hashed.
    const base = deriveEvidenceId(evidenceFields());

    expect(
      deriveEvidenceId({ ...evidenceFields(), classification: "UNOFFICIAL" }),
    ).not.toBe(base);
    expect(
      deriveEvidenceId({ ...evidenceFields(), classification: "INFERENCE" }),
    ).not.toBe(base);
  });

  it("is insensitive to lifecycle reviewStatus: mapping review status is excluded from the id", () => {
    // Same rule for mapping edges: UNREVIEWED → REVIEWED/CONFLICTED is a
    // review outcome, not a different edge.
    const base = deriveProvisionMappingId(mappingFields());

    expect(base).toMatch(/^pm_[0-9a-f]{32}$/);
    expect(
      deriveProvisionMappingId({
        ...mappingFields(),
        reviewStatus: "REVIEWED",
      }),
    ).toBe(base);
    expect(
      deriveProvisionMappingId({
        ...mappingFields(),
        reviewStatus: "CONFLICTED",
      }),
    ).toBe(base);
  });

  it("is sensitive to mapping identity fields: provisionVersionId, documentVersionId, mappingType and rationale", () => {
    const base = deriveProvisionMappingId(mappingFields());

    const otherVersion = deriveProvisionMappingId({
      ...mappingFields(),
      provisionVersionId: "SYNTH-SEC-0002",
    });
    const otherDocumentVersion = deriveProvisionMappingId({
      ...mappingFields(),
      documentVersionId: "SYNTH-ACT-0001-v2",
    });
    const otherMappingType = deriveProvisionMappingId({
      ...mappingFields(),
      mappingType: "RENUMBERED",
    });
    const otherRationale = deriveProvisionMappingId({
      ...mappingFields(),
      rationale: "Synthetic renumbering.",
    });

    expect(otherVersion).not.toBe(base);
    expect(otherDocumentVersion).not.toBe(base);
    expect(otherMappingType).not.toBe(base);
    expect(otherRationale).not.toBe(base);
  });

  it("is insensitive to provenance: recordedAt and recordedBy do not change the assertion id", () => {
    // Typed variables first: a full EffectAssertion is assignable to the
    // wrapper's Omit<..., "id" | "recordedAt" | "recordedBy"> parameter, and
    // this avoids excess-property checks on an object literal.
    const first: EffectAssertion = {
      id: "SYNTH-LEA-0001",
      ...assertionFields(),
      recordedAt: "2026-06-16T00:00:00Z",
      recordedBy: "synthetic-registrar-a",
    };
    const second: EffectAssertion = {
      id: "SYNTH-LEA-0002",
      ...assertionFields(),
      recordedAt: "2026-09-30T11:22:33Z",
      recordedBy: "synthetic-registrar-b",
    };

    expect(deriveAssertionId(first)).toBe(deriveAssertionId(second));
    expect(deriveAssertionId(first)).toBe(deriveAssertionId(assertionFields()));
  });

  it("separates reviews by reviewer and decisionDate but not by recordedAt", () => {
    const base = deriveReviewId(reviewFields());
    const otherReviewer = deriveReviewId({
      ...reviewFields(),
      reviewerId: "synthetic-counsel-2",
    });
    const otherDecisionDate = deriveReviewId({
      ...reviewFields(),
      decisionDate: "2026-07-20",
    });

    expect(base).toMatch(/^ler_[0-9a-f]{32}$/);
    expect(otherReviewer).not.toBe(base);
    expect(otherDecisionDate).not.toBe(base);

    const recordedEarly: LegalEffectReview = {
      id: "SYNTH-LER-0001",
      ...reviewFields(),
      recordedAt: "2026-07-15T00:00:00Z",
    };
    const recordedLate: LegalEffectReview = {
      id: "SYNTH-LER-0002",
      ...reviewFields(),
      recordedAt: "2026-07-16T09:30:00Z",
    };
    expect(deriveReviewId(recordedEarly)).toBe(deriveReviewId(recordedLate));
    expect(deriveReviewId(recordedEarly)).toBe(base);
  });

  it("is insensitive to lifecycle status: review status is excluded from the id", () => {
    // Identity is the decision, not where it sits in its lifecycle. ACTIVE →
    // SUPERSEDED/REVOKED must not mint a new id, or the append-only store would
    // fork the decision's history instead of rejecting a re-derivation as
    // duplicate_authority_record.
    const base = deriveReviewId({ ...reviewFields(), status: "ACTIVE" });

    expect(base).toMatch(/^ler_[0-9a-f]{32}$/);
    expect(deriveReviewId({ ...reviewFields(), status: "REVOKED" })).toBe(base);
    expect(deriveReviewId({ ...reviewFields(), status: "SUPERSEDED" })).toBe(
      base,
    );
  });

  it("treats supersession as identity: a different supersedesReviewId gives a different id", () => {
    // Retirement is still separable without hashing `status`: a revocation is a
    // new review row carrying its own supersedesReviewId, so it derives a
    // different id from the row it retires.
    const original = deriveReviewId({
      ...reviewFields(),
      supersedesReviewId: null,
    });
    const revocation = deriveReviewId({
      ...reviewFields(),
      status: "REVOKED",
      supersedesReviewId: "SYNTH-LER-0001",
    });

    expect(revocation).not.toBe(original);
    expect(
      deriveReviewId({
        ...reviewFields(),
        supersedesReviewId: "SYNTH-LER-0002",
      }),
    ).not.toBe(
      deriveReviewId({
        ...reviewFields(),
        supersedesReviewId: "SYNTH-LER-0001",
      }),
    );
  });

  it("treats the decision as identity: a different outcome gives a different id", () => {
    const confirmed = deriveReviewId({
      ...reviewFields(),
      outcome: "CONFIRMED",
    });
    const rejected = deriveReviewId({ ...reviewFields(), outcome: "REJECTED" });

    expect(rejected).not.toBe(confirmed);
  });

  it("keeps array order significant: conditions ['a','b'] and ['b','a'] give different review ids", () => {
    const forward = deriveReviewId({
      ...reviewFields(),
      outcome: "CONFIRMED_WITH_CONDITIONS",
      conditions: ["a", "b"],
    });
    const reversed = deriveReviewId({
      ...reviewFields(),
      outcome: "CONFIRMED_WITH_CONDITIONS",
      conditions: ["b", "a"],
    });

    expect(canonicalJson(["a", "b"])).not.toBe(canonicalJson(["b", "a"]));
    expect(forward).not.toBe(reversed);
  });

  it("round-trips derived ids through the ledger and rejects the SQLite-shim replay as a duplicate", async () => {
    const ledger = new AuthorityLedger();
    ledger.addDocument({
      id: "SYNTH-ACT-0001",
      documentType: "SYNTHETIC_STATUTE",
      title: "Synthetic Act One",
    });
    ledger.addVersion({
      id: "SYNTH-ACT-0001-v1",
      documentId: "SYNTH-ACT-0001",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });
    ledger.addProvision({
      id: "SYNTH-SEC-0001",
      documentId: "SYNTH-ACT-0001",
      versionId: "SYNTH-ACT-0001-v1",
      label: "Section 2",
      text: "Synthetic provision text.",
    });

    const identityId = deriveProvisionIdentityId({
      documentId: "SYNTH-ACT-0001",
      provisionType: "SECTION",
      canonicalLabel: "Section 2",
    });
    ledger.addProvisionIdentity({
      id: identityId,
      documentId: "SYNTH-ACT-0001",
      provisionType: "SECTION",
      canonicalLabel: "Section 2",
      createdAt: "2026-01-01T00:00:00Z",
    });

    const mappingId = deriveProvisionMappingId({
      provisionIdentityId: identityId,
      provisionVersionId: "SYNTH-SEC-0001",
      documentVersionId: "SYNTH-ACT-0001-v1",
      mappingType: "SAME",
      rationale: "Synthetic continuity.",
      reviewStatus: "REVIEWED",
    });
    ledger.addProvisionMapping({
      id: mappingId,
      provisionIdentityId: identityId,
      provisionVersionId: "SYNTH-SEC-0001",
      documentVersionId: "SYNTH-ACT-0001-v1",
      mappingType: "SAME",
      rationale: "Synthetic continuity.",
      reviewStatus: "REVIEWED",
      createdAt: "2026-01-01T00:00:00Z",
    });

    const fields = {
      ...assertionFields(),
      targetProvisionIdentityId: identityId,
    };
    const assertion: EffectAssertion = {
      id: deriveAssertionId(fields),
      ...fields,
      recordedAt: "2026-06-16T00:00:00Z",
      recordedBy: "synthetic-registrar",
    };
    ledger.addAssertion(assertion);

    expect(identityId).toMatch(/^pi_[0-9a-f]{32}$/);
    expect(mappingId).toMatch(/^pm_[0-9a-f]{32}$/);
    expect(ledger.getAssertion(assertion.id)).toEqual(assertion);

    const { store } = fresh();
    const d1Identity = {
      id: deriveProvisionIdentityId({
        documentId: "doc1",
        provisionType: "SECTION",
        canonicalLabel: "Section 2",
      }),
      documentId: "doc1",
      provisionType: "SECTION",
      canonicalLabel: "Section 2",
      createdAt: "2026-01-02T00:00:00Z",
    };
    await store.recordProvisionIdentity(d1Identity);

    const d1MappingId = deriveProvisionMappingId({
      provisionIdentityId: d1Identity.id,
      provisionVersionId: "p1",
      documentVersionId: "v1",
      mappingType: "SAME",
      rationale: "Synthetic continuity.",
      reviewStatus: "REVIEWED",
    });
    await store.recordProvisionMapping({
      id: d1MappingId,
      provisionIdentityId: d1Identity.id,
      provisionVersionId: "p1",
      documentVersionId: "v1",
      mappingType: "SAME",
      rationale: "Synthetic continuity.",
      reviewStatus: "REVIEWED",
      createdAt: "2026-01-02T00:00:00Z",
    });

    const d1Fields = {
      effectType: "PARTIAL_AMENDMENT" as const,
      sourceDocumentId: "doc1",
      sourceVersionId: "v1",
      sourceProvisionId: "p1",
      targetDocumentId: "doc1",
      targetProvisionIdentityId: d1Identity.id,
      targetVersionId: "v1",
      scope: "Section 2",
      claimedDate: "2026-06-15",
      claimedEffectiveDate: "2026-07-01",
      evidenceId: "ev1",
      sourceLocator: "Section 2",
      assertionOrigin: "synthetic-seed",
      state: "PENDING_REVIEW" as const,
      supersedesAssertionId: null,
      conflictGroupId: null,
    };
    const d1Assertion: EffectAssertion = {
      id: deriveAssertionId(d1Fields),
      ...d1Fields,
      recordedAt: "2026-06-16T00:00:00Z",
      recordedBy: "synthetic-registrar",
    };
    await store.recordAssertion(d1Assertion);

    await expect(store.recordAssertion(d1Assertion)).rejects.toThrow(
      "duplicate_authority_record",
    );

    // A lifecycle change is not a new claim: re-deriving after the assertion
    // moves PENDING_REVIEW → CONFLICTED yields the same id, so the store rejects
    // the transition as a duplicate rather than recording a second row.
    const transitioned: EffectAssertion = {
      ...d1Assertion,
      id: deriveAssertionId({ ...d1Fields, state: "CONFLICTED" }),
      state: "CONFLICTED",
      recordedAt: "2026-07-01T00:00:00Z",
      recordedBy: "synthetic-registrar-two",
    };
    expect(transitioned.id).toBe(d1Assertion.id);
    await expect(store.recordAssertion(transitioned)).rejects.toThrow(
      "duplicate_authority_record",
    );
  });

  it("rejects unsupported values with unsupported_canonical_value", () => {
    expect(() => canonicalJson(() => "synthetic")).toThrow(
      /unsupported_canonical_value/,
    );
    expect(() => canonicalJson({ value: 10n })).toThrow(
      /unsupported_canonical_value/,
    );
    expect(() => canonicalJson({ value: Symbol("synthetic") })).toThrow(
      /unsupported_canonical_value/,
    );
    expect(() => deriveAuthorityId("lea", { value: 10n })).toThrow(
      /unsupported_canonical_value/,
    );
  });

  it("names the constructor in the error for a non-plain object", () => {
    expect(() => canonicalJson(new Date(0))).toThrow(
      /unsupported_canonical_value.*Date/,
    );
    expect(() => canonicalJson({ value: new Date(0) })).toThrow(
      /unsupported_canonical_value.*Date/,
    );
    expect(() => canonicalJson(new Map())).toThrow(
      /unsupported_canonical_value.*Map/,
    );
  });

  it("rejects negative zero but accepts a real zero", () => {
    // JSON.stringify(-0) is "0", so -0 would hash identically to 0.
    expect(() => canonicalJson(-0)).toThrow(/unsupported_canonical_value/);
    expect(() => canonicalJson({ value: -0 })).toThrow(
      /unsupported_canonical_value/,
    );

    expect(canonicalJson(0)).toBe("0");
    expect(canonicalJson({ value: 0 })).toBe('{"value":0}');
  });

  it("rejects a sparse array but encodes an explicit undefined as null", () => {
    // A hole and an explicit undefined would both become null.
    // biome-ignore lint/suspicious/noSparseArray: deliberately sparse input.
    const sparse = [1, , 3];
    expect(() => canonicalJson(sparse)).toThrow(/unsupported_canonical_value/);

    expect(canonicalJson([1, undefined, 3])).toBe("[1,null,3]");
  });
});
