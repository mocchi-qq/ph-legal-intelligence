import { describe, expect, it } from "vitest";
import {
  AuthorityLedger,
  CitationResolver,
  listActiveReviews,
  projectAuthorityState,
} from "../../packages/legal-ingestion/src/index";

type ReviewOption =
  | "CONFIRMED"
  | "CONFIRMED_WITH_CONDITIONS"
  | "REJECTED"
  | "INCONCLUSIVE"
  | null;

interface EffectOptions {
  effective?: string | null;
  availability?: "AVAILABLE" | "UNAVAILABLE" | "NOT_RECEIVED";
  review?: ReviewOption;
  outcomeDate?: string;
}

const DOCUMENT_TYPE = "SYNTHETIC_STATUTE";
const ASSERTION_ID = "synth-assert-0001";

function seed(): AuthorityLedger {
  const ledger = new AuthorityLedger();
  ledger.addDocument({
    id: "SYNTH-ACT-0001",
    documentType: DOCUMENT_TYPE,
    title: "Synthetic Act One",
  });
  ledger.addDocument({
    id: "SYNTH-ACT-0002",
    documentType: DOCUMENT_TYPE,
    title: "Synthetic Act Two",
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
  ledger.addProvisionIdentity({
    id: "SYNTH-PROV-0001",
    documentId: "SYNTH-ACT-0001",
    provisionType: "SECTION",
    canonicalLabel: "Section 2",
    createdAt: "2026-01-01T00:00:00Z",
  });
  ledger.addProvisionMapping({
    id: "SYNTH-MAP-0001",
    provisionIdentityId: "SYNTH-PROV-0001",
    provisionVersionId: "SYNTH-SEC-0001",
    documentVersionId: "SYNTH-ACT-0001-v1",
    mappingType: "SAME",
    rationale: "Synthetic identity carried across the version.",
    reviewStatus: "REVIEWED",
    createdAt: "2026-01-01T00:00:00Z",
  });
  return ledger;
}

function addEffect(ledger: AuthorityLedger, options: EffectOptions = {}): void {
  const {
    effective = "2026-07-01",
    availability = "AVAILABLE",
    review = "CONFIRMED",
    outcomeDate = "2026-06-15",
  } = options;

  ledger.addAssertion({
    id: ASSERTION_ID,
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: "SYNTH-ACT-0002",
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: "SYNTH-ACT-0001",
    targetProvisionIdentityId: "SYNTH-PROV-0001",
    targetVersionId: "SYNTH-ACT-0001-v1",
    scope: "Synthetic scope",
    claimedDate: "2026-06-01",
    claimedEffectiveDate: effective,
    evidenceId: "synth-evidence-0001",
    sourceLocator: "Section 3",
    assertionOrigin: "synthetic-fixture",
    recordedAt: "2026-06-01T00:00:00Z",
    recordedBy: "synth-fixture-loader",
    state: "UNREVIEWED",
    supersedesAssertionId: null,
    conflictGroupId: null,
  });

  ledger.addEvidence({
    id: "synth-evidence-0001",
    assertionId: ASSERTION_ID,
    documentVersionId: "SYNTH-ACT-0001-v1",
    provisionVersionId: "SYNTH-SEC-0001",
    artifactId: null,
    contentHash: null,
    passage: "Synthetic passage.",
    locator: "Section 3",
    evidenceDate: null,
    classification: "OFFICIAL_PRIMARY",
    availability,
    checkedAt: "2026-11-14T00:00:00Z",
  });

  if (review !== null) {
    ledger.addReview({
      id: "synth-review-0001",
      assertionId: ASSERTION_ID,
      outcome: review,
      reviewerId: "synth-reviewer-01",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: outcomeDate,
      scope: "synthetic scope",
      propositionReviewed: "Synthetic amendment proposition",
      conditions: [],
      evidenceRefs: ["synth-evidence-0001"],
      notes: "Synthetic fixture. Not a real counsel determination.",
      supersedesReviewId: null,
      status: "ACTIVE",
      recordedAt: "2026-06-15T00:00:00Z",
    });
  }
}

function project(ledger: AuthorityLedger, asOf: string) {
  return projectAuthorityState({
    snapshot: ledger.snapshot(),
    documentId: "SYNTH-ACT-0001",
    provisionIdentityId: "SYNTH-PROV-0001",
    asOf,
    activity: "citation_display",
    authorizationAssertion: {
      activity: "citation_display",
      decision: "AUTHORIZED",
    },
  });
}

const RESOLVER_DOCUMENTS = [
  {
    id: "SYNTH-ACT-0001",
    documentType: DOCUMENT_TYPE,
    citationText: "SYNTH-ACT-0001",
    aliases: ["Synthetic Act One"],
    provisions: [
      { provisionIdentityId: "SYNTH-PROV-0001", label: "Section 2" },
    ],
  },
  {
    id: "SYNTH-ACT-0002",
    documentType: DOCUMENT_TYPE,
    citationText: "SYNTH-ACT-0002",
    aliases: ["Synthetic Act Two"],
  },
];

describe("AuthorityLedger", () => {
  it("rejects a duplicate assertion id", () => {
    const ledger = seed();
    addEffect(ledger);
    expect(() => addEffect(ledger)).toThrow(/duplicate_assertion_id/);
  });

  it("requires conditions for a conditional confirmation", () => {
    expect(() =>
      addEffect(seed(), { review: "CONFIRMED_WITH_CONDITIONS" }),
    ).toThrow(/conditions_required/);
  });

  it("rejects a duplicate review", () => {
    const ledger = seed();
    addEffect(ledger);
    expect(() =>
      ledger.addReview({
        id: "synth-review-0002",
        assertionId: ASSERTION_ID,
        outcome: "CONFIRMED",
        reviewerId: "synth-reviewer-01",
        reviewerCapacity: "synthetic-legal-reviewer",
        decisionDate: "2026-06-15",
        scope: "synthetic scope",
        propositionReviewed: "Synthetic amendment proposition",
        conditions: [],
        evidenceRefs: ["synth-evidence-0001"],
        notes: "Synthetic fixture. Not a real counsel determination.",
        supersedesReviewId: null,
        status: "ACTIVE",
        recordedAt: "2026-06-15T00:00:00Z",
      }),
    ).toThrow(/duplicate_review/);
  });

  it("excludes a superseded review from the active set", () => {
    const ledger = seed();
    addEffect(ledger);
    ledger.addReview({
      id: "synth-review-0002",
      assertionId: ASSERTION_ID,
      outcome: "CONFIRMED",
      reviewerId: "synth-reviewer-02",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: "2026-06-20",
      scope: "synthetic scope",
      propositionReviewed: "Synthetic amendment proposition",
      conditions: [],
      evidenceRefs: ["synth-evidence-0001"],
      notes: "Synthetic superseding fixture.",
      supersedesReviewId: "synth-review-0001",
      status: "ACTIVE",
      recordedAt: "2026-06-20T00:00:00Z",
    });

    expect(listActiveReviews(ledger.snapshot(), ASSERTION_ID)).toHaveLength(1);
  });
});

describe("projectAuthorityState", () => {
  it("returns NO_ASSERTION for a document with no assertions", () => {
    const ledger = new AuthorityLedger();
    ledger.addDocument({
      id: "SYNTH-ACT-0001",
      documentType: DOCUMENT_TYPE,
      title: "Synthetic Act One",
    });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("NO_ASSERTION");
  });

  it("returns PARTIALLY_DETERMINED while no review exists", () => {
    const ledger = seed();
    addEffect(ledger, { review: null });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("PARTIALLY_DETERMINED");
    expect(projection.missing).toContain("NO_REVIEWED_CONCLUSION");
  });

  it("reports NOT_YET_EFFECTIVE before the claimed effective date", () => {
    const ledger = seed();
    addEffect(ledger);

    const projection = project(ledger, "2026-06-30");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("NOT_YET_EFFECTIVE");
  });

  it("reports PARTIALLY_AMENDED on the effective date", () => {
    const ledger = seed();
    addEffect(ledger);

    expect(project(ledger, "2026-07-01").state).toBe("PARTIALLY_AMENDED");
  });

  it("returns UNKNOWN when the only review rejects the effect", () => {
    const ledger = seed();
    addEffect(ledger, { review: "REJECTED" });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("NO_CONFIRMED_EFFECT");
  });

  it("returns CONFLICTED when active reviews disagree", () => {
    const ledger = seed();
    addEffect(ledger);
    ledger.addReview({
      id: "synth-review-0002",
      assertionId: ASSERTION_ID,
      outcome: "REJECTED",
      reviewerId: "synth-reviewer-02",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: "2026-06-20",
      scope: "synthetic scope",
      propositionReviewed: "Synthetic amendment proposition",
      conditions: [],
      evidenceRefs: ["synth-evidence-0001"],
      notes: "Synthetic conflicting fixture.",
      supersedesReviewId: null,
      status: "ACTIVE",
      recordedAt: "2026-06-20T00:00:00Z",
    });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("CONFLICTED");
    expect(projection.missing).toContain("CONFLICTING_REVIEWS");
  });

  it("returns CONFLICTED when confirmed reviews claim different effective dates", () => {
    const ledger = seed();
    addEffect(ledger);

    ledger.addAssertion({
      id: "synth-assert-0002",
      effectType: "PARTIAL_AMENDMENT",
      sourceDocumentId: "SYNTH-ACT-0002",
      sourceVersionId: null,
      sourceProvisionId: null,
      targetDocumentId: "SYNTH-ACT-0001",
      targetProvisionIdentityId: "SYNTH-PROV-0001",
      targetVersionId: "SYNTH-ACT-0001-v1",
      scope: "Synthetic scope",
      claimedDate: "2026-06-02",
      claimedEffectiveDate: "2026-09-01",
      evidenceId: "synth-evidence-0002",
      sourceLocator: "Section 4",
      assertionOrigin: "synthetic-fixture",
      recordedAt: "2026-06-02T00:00:00Z",
      recordedBy: "synth-fixture-loader",
      state: "UNREVIEWED",
      supersedesAssertionId: null,
      conflictGroupId: null,
    });
    ledger.addEvidence({
      id: "synth-evidence-0002",
      assertionId: "synth-assert-0002",
      documentVersionId: "SYNTH-ACT-0001-v1",
      provisionVersionId: "SYNTH-SEC-0001",
      artifactId: null,
      contentHash: null,
      passage: "Synthetic passage two.",
      locator: "Section 4",
      evidenceDate: null,
      classification: "OFFICIAL_PRIMARY",
      availability: "AVAILABLE",
      checkedAt: "2026-11-14T00:00:00Z",
    });
    ledger.addReview({
      id: "synth-review-0002",
      assertionId: "synth-assert-0002",
      outcome: "CONFIRMED",
      reviewerId: "synth-reviewer-02",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: "2026-06-20",
      scope: "synthetic scope",
      propositionReviewed: "Synthetic amendment proposition two",
      conditions: [],
      evidenceRefs: ["synth-evidence-0002"],
      notes: "Synthetic second fixture.",
      supersedesReviewId: null,
      status: "ACTIVE",
      recordedAt: "2026-06-20T00:00:00Z",
    });

    const projection = project(ledger, "2026-10-01");

    expect(projection.outcome).toBe("CONFLICTED");
    expect(projection.missing).toContain("CONFLICTING_EFFECTIVE_DATES");
  });

  it("returns INSUFFICIENT_EVIDENCE when evidence is unavailable", () => {
    const ledger = seed();
    addEffect(ledger, { availability: "UNAVAILABLE" });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("EVIDENCE_UNAVAILABLE");
  });

  it("returns INSUFFICIENT_EVIDENCE when the effective date is unknown", () => {
    const ledger = seed();
    addEffect(ledger, { effective: null });

    const projection = project(ledger, "2026-08-01");

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("UNKNOWN_EFFECTIVE_DATE");
  });

  it("returns UNAUTHORIZED without abstaining", () => {
    const ledger = seed();
    addEffect(ledger);

    const projection = projectAuthorityState({
      snapshot: ledger.snapshot(),
      documentId: "SYNTH-ACT-0001",
      provisionIdentityId: "SYNTH-PROV-0001",
      asOf: "2026-08-01",
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "UNAUTHORIZED",
      },
    });

    expect(projection.outcome).toBe("UNAUTHORIZED");
    expect(projection.abstained).toBe(false);
  });

  it("returns UNKNOWN for a calendar date that does not exist", () => {
    const ledger = seed();
    addEffect(ledger);

    const projection = project(ledger, "2026-02-31");

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("INVALID_DATE");
  });

  it("is deterministic across identical calls", () => {
    const ledger = seed();
    addEffect(ledger);

    expect(project(ledger, "2026-08-01")).toEqual(
      project(ledger, "2026-08-01"),
    );
  });
});

describe("CitationResolver", () => {
  it("resolves a canonical identifier exactly", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    expect(resolver.resolve("SYNTH-ACT-0001").status).toBe("EXACT");
  });

  it("resolves an alias", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    expect(resolver.resolve("Synthetic Act One").status).toBe("ALIAS");
  });

  it("reports multiple candidates for a shared alias", () => {
    const resolver = new CitationResolver([
      ...RESOLVER_DOCUMENTS,
      {
        id: "SYNTH-ACT-0003",
        documentType: DOCUMENT_TYPE,
        citationText: "SYNTH-ACT-0003",
        aliases: ["Synthetic Act One"],
      },
    ]);

    expect(resolver.resolve("Synthetic Act One").status).toBe(
      "MULTIPLE_CANDIDATES",
    );
  });

  it("rejects empty input", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    expect(resolver.resolve("   ").status).toBe("INVALID_FORMAT");
  });

  it("rejects unsupported citation text", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    expect(resolver.resolve("the quick brown fox").status).toBe(
      "UNSUPPORTED_TYPE",
    );
  });

  it("resolves a provision label within a document context", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    const resolution = resolver.resolve("Section 2", {
      documentId: "SYNTH-ACT-0001",
    });

    expect(resolution.status).toBe("EXACT");
    expect(resolution.candidates[0]?.provisionIdentityId).toBe(
      "SYNTH-PROV-0001",
    );
  });
});

// Gate 8 integrity fixtures — all synthetic, no real law is represented.
type LedgerSnapshot = ReturnType<AuthorityLedger["snapshot"]>;
type AssertionRecord = LedgerSnapshot["assertions"][number];
type ReviewRecord = LedgerSnapshot["reviews"][number];

const G8_PROPOSITION = "Synthetic amendment proposition";

interface AssertionFact {
  id: string;
  effective: string | null;
  evidenceId: string;
  provisionIdentityId?: string | null;
  effectType?: AssertionRecord["effectType"];
  supersedesAssertionId?: string | null;
  versionId?: string | null;
}

function addAssertionFact(ledger: AuthorityLedger, input: AssertionFact): void {
  ledger.addAssertion({
    id: input.id,
    effectType: input.effectType ?? "PARTIAL_AMENDMENT",
    sourceDocumentId: "SYNTH-ACT-0002",
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: "SYNTH-ACT-0001",
    targetProvisionIdentityId:
      input.provisionIdentityId === undefined
        ? "SYNTH-PROV-0001"
        : input.provisionIdentityId,
    targetVersionId:
      input.versionId === undefined ? "SYNTH-ACT-0001-v1" : input.versionId,
    scope: "Synthetic scope",
    claimedDate: "2026-06-01",
    claimedEffectiveDate: input.effective,
    evidenceId: input.evidenceId,
    sourceLocator: "Section 3",
    assertionOrigin: "synthetic-fixture",
    recordedAt: "2026-06-01T00:00:00Z",
    recordedBy: "synth-fixture-loader",
    state: "UNREVIEWED",
    supersedesAssertionId: input.supersedesAssertionId ?? null,
    conflictGroupId: null,
  });
}

function addEvidenceFact(
  ledger: AuthorityLedger,
  input: {
    id: string;
    assertionId: string;
    availability?: LedgerSnapshot["evidence"][number]["availability"];
  },
): void {
  ledger.addEvidence({
    id: input.id,
    assertionId: input.assertionId,
    documentVersionId: "SYNTH-ACT-0001-v1",
    provisionVersionId: "SYNTH-SEC-0001",
    artifactId: null,
    contentHash: null,
    passage: "Synthetic passage.",
    locator: "Section 3",
    evidenceDate: null,
    classification: "OFFICIAL_PRIMARY",
    availability: input.availability ?? "AVAILABLE",
    checkedAt: "2026-11-14T00:00:00Z",
  });
}

function addReviewFact(
  ledger: AuthorityLedger,
  input: {
    id: string;
    assertionId: string;
    decisionDate: string;
    evidenceRefs: string[];
    status?: ReviewRecord["status"];
    outcome?: ReviewRecord["outcome"];
    reviewerId?: string;
    supersedesReviewId?: string | null;
  },
): void {
  ledger.addReview({
    id: input.id,
    assertionId: input.assertionId,
    outcome: input.outcome ?? "CONFIRMED",
    reviewerId: input.reviewerId ?? `reviewer-for-${input.id}`,
    reviewerCapacity: "synthetic-legal-reviewer",
    decisionDate: input.decisionDate,
    scope: "synthetic scope",
    propositionReviewed: G8_PROPOSITION,
    conditions: [],
    evidenceRefs: input.evidenceRefs,
    notes: "Synthetic fixture. Not a real counsel determination.",
    supersedesReviewId: input.supersedesReviewId ?? null,
    status: input.status ?? "ACTIVE",
    recordedAt: `${input.decisionDate}T00:00:00Z`,
  });
}

function projectDocument(ledger: AuthorityLedger, asOf: string) {
  return projectAuthorityState({
    snapshot: ledger.snapshot(),
    documentId: "SYNTH-ACT-0001",
    asOf,
    activity: "citation_display",
    authorizationAssertion: {
      activity: "citation_display",
      decision: "AUTHORIZED",
    },
  });
}

describe("authority integrity — review revocation", () => {
  it("lets a revoked superseding review deactivate the review it supersedes", () => {
    const ledger = seed();
    addEffect(ledger);
    addReviewFact(ledger, {
      id: "synth-review-0002",
      assertionId: ASSERTION_ID,
      decisionDate: "2026-06-20",
      evidenceRefs: ["synth-evidence-0001"],
      status: "REVOKED",
      supersedesReviewId: "synth-review-0001",
    });

    expect(listActiveReviews(ledger.snapshot(), ASSERTION_ID)).toEqual([]);

    const projection = project(ledger, "2026-08-01");
    expect(projection.outcome).not.toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.outcome).toBe("PARTIALLY_DETERMINED");
    expect(projection.missing).toContain("NO_REVIEWED_CONCLUSION");
  });
});

describe("authority integrity — evidence binding", () => {
  it("rejects evidence owned by another assertion", () => {
    const ledger = seed();
    addEffect(ledger);

    // A2 points at A1's evidence; the review falls back to the assertion's
    // own evidenceId, so the ownership mismatch surfaces in the projection.
    addAssertionFact(ledger, {
      id: "synth-assert-0002",
      effective: "2026-09-01",
      evidenceId: "synth-evidence-0001",
    });
    addReviewFact(ledger, {
      id: "synth-review-0002",
      assertionId: "synth-assert-0002",
      decisionDate: "2026-06-20",
      evidenceRefs: [],
    });

    const projection = project(ledger, "2026-10-01");

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("EVIDENCE_UNAVAILABLE");
  });

  it("rejects a review whose evidenceRefs name missing evidence", () => {
    const ledger = seed();
    addEffect(ledger);
    const snapshot = ledger.snapshot();
    const review = snapshot.reviews.find(
      (candidate) => candidate.id === "synth-review-0001",
    );
    expect(review).toBeDefined();
    review!.evidenceRefs = ["synth-evidence-0001", "synth-evidence-missing"];

    const projection = projectAuthorityState({
      snapshot,
      documentId: "SYNTH-ACT-0001",
      provisionIdentityId: "SYNTH-PROV-0001",
      asOf: "2026-08-01",
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "AUTHORIZED",
      },
    });

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("EVIDENCE_UNAVAILABLE");
  });
});

describe("authority integrity — conflict grouping", () => {
  it("does not conflict amendments on different provision identities", () => {
    const ledger = seed();
    ledger.addProvisionIdentity({
      id: "SYNTH-PROV-0002",
      documentId: "SYNTH-ACT-0001",
      provisionType: "SECTION",
      canonicalLabel: "Section 3",
      createdAt: "2026-01-01T00:00:00Z",
    });
    addAssertionFact(ledger, {
      id: "synth-assert-0001",
      effective: "2026-03-01",
      evidenceId: "synth-evidence-0001",
      provisionIdentityId: "SYNTH-PROV-0001",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0001",
      assertionId: "synth-assert-0001",
    });
    addReviewFact(ledger, {
      id: "synth-review-0001",
      assertionId: "synth-assert-0001",
      decisionDate: "2026-06-15",
      evidenceRefs: ["synth-evidence-0001"],
    });
    addAssertionFact(ledger, {
      id: "synth-assert-0002",
      effective: "2026-09-01",
      evidenceId: "synth-evidence-0002",
      provisionIdentityId: "SYNTH-PROV-0002",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0002",
      assertionId: "synth-assert-0002",
    });
    addReviewFact(ledger, {
      id: "synth-review-0002",
      assertionId: "synth-assert-0002",
      decisionDate: "2026-06-16",
      evidenceRefs: ["synth-evidence-0002"],
    });

    const projection = projectDocument(ledger, "2026-10-01");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.missing).not.toContain("CONFLICTING_EFFECTIVE_DATES");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
  });
});

describe("authority integrity — assertion supersession", () => {
  it("excludes an assertion superseded by another assertion", () => {
    const ledger = seed();
    addAssertionFact(ledger, {
      id: "synth-assert-0001",
      effective: "2026-03-01",
      evidenceId: "synth-evidence-0001",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0001",
      assertionId: "synth-assert-0001",
    });
    addReviewFact(ledger, {
      id: "synth-review-0001",
      assertionId: "synth-assert-0001",
      decisionDate: "2026-06-15",
      evidenceRefs: ["synth-evidence-0001"],
    });
    addAssertionFact(ledger, {
      id: "synth-assert-0002",
      effective: "2026-04-01",
      evidenceId: "synth-evidence-0002",
      supersedesAssertionId: "synth-assert-0001",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0002",
      assertionId: "synth-assert-0002",
    });
    addReviewFact(ledger, {
      id: "synth-review-0002",
      assertionId: "synth-assert-0002",
      decisionDate: "2026-06-16",
      evidenceRefs: ["synth-evidence-0002"],
    });

    const projection = project(ledger, "2026-05-01");

    expect(projection.outcome).not.toBe("CONFLICTED");
    expect(projection.missing).not.toContain("CONFLICTING_EFFECTIVE_DATES");
    expect(projection.assertions).toEqual(["synth-assert-0002"]);
    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
  });
});

describe("authority integrity — version validity", () => {
  it("drops a target version that does not cover the as-of date", () => {
    const ledger = seed();
    ledger.addVersion({
      id: "SYNTH-ACT-0001-v-expired",
      documentId: "SYNTH-ACT-0001",
      effectiveFrom: "2025-01-01",
      effectiveTo: "2026-02-01",
    });
    addAssertionFact(ledger, {
      id: "synth-assert-0001",
      effective: "2026-07-01",
      evidenceId: "synth-evidence-0001",
      versionId: "SYNTH-ACT-0001-v-expired",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0001",
      assertionId: "synth-assert-0001",
    });
    addReviewFact(ledger, {
      id: "synth-review-0001",
      assertionId: "synth-assert-0001",
      decisionDate: "2026-06-15",
      evidenceRefs: ["synth-evidence-0001"],
    });

    const projection = project(ledger, "2026-12-31");

    expect(projection.versionId).toBeNull();
    expect(projection.missing).toContain("VERSION_NOT_IN_EFFECT");
  });
});

describe("authority integrity — add-time evidence refs", () => {
  it("rejects a review that references unknown evidence", () => {
    const ledger = seed();
    addEffect(ledger);

    expect(() =>
      addReviewFact(ledger, {
        id: "synth-review-0002",
        assertionId: ASSERTION_ID,
        decisionDate: "2026-06-20",
        evidenceRefs: ["synth-evidence-unknown"],
      }),
    ).toThrow(/unknown_evidence_ref/);
  });
});

describe("authority integrity — same-day correction", () => {
  it("accepts a same-day review with a different outcome", () => {
    const ledger = seed();
    addEffect(ledger);

    expect(() =>
      addReviewFact(ledger, {
        id: "synth-review-0002",
        assertionId: ASSERTION_ID,
        decisionDate: "2026-06-15",
        evidenceRefs: ["synth-evidence-0001"],
        outcome: "REJECTED",
        reviewerId: "synth-reviewer-01",
      }),
    ).not.toThrow();
  });
});

describe("authority integrity — cross-entity consistency", () => {
  it("rejects a target provision identity owned by another document", () => {
    const ledger = seed();
    ledger.addProvisionIdentity({
      id: "SYNTH-PROV-0002",
      documentId: "SYNTH-ACT-0001",
      provisionType: "SECTION",
      canonicalLabel: "Section 4",
      createdAt: "2026-01-01T00:00:00Z",
    });

    expect(() =>
      ledger.addAssertion({
        id: "synth-assert-0002",
        effectType: "PARTIAL_AMENDMENT",
        sourceDocumentId: "SYNTH-ACT-0002",
        sourceVersionId: null,
        sourceProvisionId: null,
        targetDocumentId: "SYNTH-ACT-0002",
        targetProvisionIdentityId: "SYNTH-PROV-0002",
        targetVersionId: null,
        scope: "Synthetic scope",
        claimedDate: "2026-06-01",
        claimedEffectiveDate: "2026-07-01",
        evidenceId: "synth-evidence-0002",
        sourceLocator: "Section 3",
        assertionOrigin: "synthetic-fixture",
        recordedAt: "2026-06-01T00:00:00Z",
        recordedBy: "synth-fixture-loader",
        state: "UNREVIEWED",
        supersedesAssertionId: null,
        conflictGroupId: null,
      }),
    ).toThrow(/provision_identity_document_mismatch/);
  });

  it("rejects evidence whose provision version and document version disagree", () => {
    const ledger = seed();
    addAssertionFact(ledger, {
      id: "synth-assert-0002",
      effective: "2026-07-01",
      evidenceId: "synth-evidence-0002",
    });
    addEvidenceFact(ledger, {
      id: "synth-evidence-0002",
      assertionId: "synth-assert-0002",
    });
    ledger.addVersion({
      id: "SYNTH-ACT-0002-v1",
      documentId: "SYNTH-ACT-0002",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });

    expect(() =>
      ledger.addEvidence({
        id: "synth-evidence-0003",
        assertionId: "synth-assert-0002",
        documentVersionId: "SYNTH-ACT-0002-v1",
        provisionVersionId: "SYNTH-SEC-0001",
        artifactId: null,
        contentHash: null,
        passage: "Synthetic passage.",
        locator: "Section 3",
        evidenceDate: null,
        classification: "OFFICIAL_PRIMARY",
        availability: "AVAILABLE",
        checkedAt: "2026-11-14T00:00:00Z",
      }),
    ).toThrow(/evidence_version_mismatch/);
  });
});

import { parsePhilippineCitation } from "../../packages/legal-ingestion/src/citation-resolver";

describe("CitationResolver grammar and identity", () => {
  it("does not read a word fragment as a statute", () => {
    const parsed = parsePhilippineCitation("para 5");

    expect(parsed?.citationType).not.toBe("STATUTE");
    expect(parsed?.components.instrumentKind).not.toBe("REPUBLIC_ACT");
  });

  it("keeps a parenthetical subdivision on the provision label", () => {
    expect(
      parsePhilippineCitation("Section 2(a)")?.components.provisionLabel,
    ).toBe("2(a)");
  });

  it("captures a dotted provision label after an instrument", () => {
    const parsed = parsePhilippineCitation("RA 1234, s. 2.1");

    expect(parsed?.components.provisionLabel).toBe("2.1");
  });

  it("reports multiple candidates for a shared alias", () => {
    const resolver = new CitationResolver([
      {
        id: "SYNTH-A",
        documentType: DOCUMENT_TYPE,
        citationText: "SYNTH-A",
        aliases: ["Shared Alias"],
      },
      {
        id: "SYNTH-B",
        documentType: DOCUMENT_TYPE,
        citationText: "SYNTH-B",
        aliases: ["Shared Alias"],
      },
    ]);

    expect(resolver.resolve("Shared Alias").status).toBe("MULTIPLE_CANDIDATES");
  });

  it("distinguishes Section 2(a) from Section 2A within a document", () => {
    const resolver = new CitationResolver([
      {
        id: "SYNTH-DOC-PROVISIONS",
        documentType: DOCUMENT_TYPE,
        citationText: "SYNTH-DOC-PROVISIONS",
        provisions: [
          { provisionIdentityId: "SYNTH-PROV-2A", label: "Section 2(a)" },
          { provisionIdentityId: "SYNTH-PROV-2A-PLAIN", label: "Section 2A" },
        ],
      },
    ]);

    const resolution = resolver.resolve("Section 2(a)", {
      documentId: "SYNTH-DOC-PROVISIONS",
    });

    expect(resolution.status).toBe("EXACT");
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.candidates[0]?.provisionIdentityId).toBe("SYNTH-PROV-2A");
  });

  it("matches a G.R. number only through the GR identity key", () => {
    const resolver = new CitationResolver([
      {
        id: "SYNTH-CASE-999001",
        documentType: "SYNTHETIC_CASE",
        citationText: "G.R. No. 999001",
        identityKey: "GR:999001",
      },
    ]);

    expect(resolver.resolve("G.R. No. 999001").status).toBe("EXACT");
  });

  it("does not match a bare number against another instrument's identity", () => {
    const resolver = new CitationResolver([
      {
        id: "SYNTH-ACT-0012",
        documentType: DOCUMENT_TYPE,
        citationText: "PD 12",
        identityKey: "PD:12",
      },
    ]);

    expect(resolver.resolve("RA 12").status).toBe("NO_MATCH");
  });

  it("reports an unknown context document instead of a missing provision", () => {
    const resolver = new CitationResolver(RESOLVER_DOCUMENTS);

    const resolution = resolver.resolve("Section 2", {
      documentId: "SYNTH-DOC-UNKNOWN",
    });

    expect(resolution.status).toBe("NO_MATCH");
    expect(resolution.provenance).toContain("document_not_found");
  });
});
