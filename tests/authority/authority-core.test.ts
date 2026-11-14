// Gate 8 — synthetic authority core: ledger, projection and citation resolution.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import {
  AuthorityLedger,
  CitationResolver,
  listActiveReviews,
  projectAuthorityState,
} from "../../packages/legal-ingestion/src/index";

type Snapshot = ReturnType<AuthorityLedger["snapshot"]>;
type LedgerAssertion = Snapshot["assertions"][number];
type Review = NonNullable<ReturnType<AuthorityLedger["getReview"]>>;
type ReviewOutcome = Review["outcome"];
type EvidenceAvailability = Snapshot["evidence"][number]["availability"];

interface AmendmentOptions {
  effective: string | null;
  availability?: EvidenceAvailability;
  review?: ReviewOutcome | null;
  conditions?: string[];
  reviewId?: string;
  reviewerId?: string;
  decisionDate?: string;
  propositionReviewed?: string;
  supersedesReviewId?: string | null;
}

function seed() {
  const ledger = new AuthorityLedger();

  ledger.addDocument({
    id: "SYNTH-ACT-0001",
    documentType: "SYNTHETIC_STATUTE",
    title: "Synthetic Act One",
  });
  ledger.addDocument({
    id: "SYNTH-ACT-0002",
    documentType: "SYNTHETIC_STATUTE",
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
    rationale: "Synthetic continuity.",
    reviewStatus: "REVIEWED",
    createdAt: "2026-01-01T00:00:00Z",
  });

  return { ledger };
}

function addAmendment(ledger: AuthorityLedger, opts: AmendmentOptions): void {
  const assertion: LedgerAssertion = {
    id: "synth-assert-0001",
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: "SYNTH-ACT-0002",
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: "SYNTH-ACT-0001",
    targetProvisionIdentityId: "SYNTH-PROV-0001",
    targetVersionId: "SYNTH-ACT-0001-v1",
    scope: "SYNTH-ACT-0001 Section 2",
    claimedDate: "2026-06-01",
    claimedEffectiveDate: opts.effective,
    evidenceId: "synth-evidence-0001",
    sourceLocator: "Section 3",
    assertionOrigin: "synthetic-fixture",
    recordedAt: "2026-06-01T00:00:00Z",
    recordedBy: "synth-fixture-loader",
    state: "UNREVIEWED",
    supersedesAssertionId: null,
    conflictGroupId: null,
  };
  ledger.addAssertion(assertion);

  ledger.addEvidence({
    id: "synth-evidence-0001",
    assertionId: "synth-assert-0001",
    documentVersionId: null,
    provisionVersionId: null,
    artifactId: null,
    contentHash: null,
    passage: null,
    locator: null,
    evidenceDate: null,
    classification: "OFFICIAL_PRIMARY",
    availability: opts.availability ?? "AVAILABLE",
    checkedAt: "2026-11-14T00:00:00Z",
  });

  if (opts.review) {
    ledger.addReview({
      id: opts.reviewId ?? "synth-review-0001",
      assertionId: "synth-assert-0001",
      outcome: opts.review,
      reviewerId: opts.reviewerId ?? "synth-reviewer-01",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: opts.decisionDate ?? "2026-06-15",
      scope: "synthetic scope",
      propositionReviewed:
        opts.propositionReviewed ?? "Synthetic amendment proposition",
      conditions: opts.conditions ?? [],
      evidenceRefs: ["synth-evidence-0001"],
      notes: "Synthetic fixture. Not a real counsel determination.",
      supersedesReviewId: opts.supersedesReviewId ?? null,
      status: "ACTIVE",
      recordedAt: "2026-06-15T00:00:00Z",
    });
  }
}

function addSecondReview(
  ledger: AuthorityLedger,
  overrides: Partial<Review> & { id: string },
): void {
  const original = ledger.getReview("synth-review-0001");
  if (original === null) throw new Error("seed review missing");
  ledger.addReview({ ...original, ...overrides });
}

function project(
  ledger: AuthorityLedger,
  asOf: string,
  authorization: "AUTHORIZED" | "UNAUTHORIZED" | "NOT_CHECKED" = "NOT_CHECKED",
) {
  return projectAuthorityState({
    snapshot: ledger.snapshot(),
    documentId: "SYNTH-ACT-0001",
    asOf,
    authorization,
  });
}

const baseDocuments = [
  {
    id: "SYNTH-ACT-0001",
    documentType: "SYNTHETIC_STATUTE",
    citationText: "SYNTH-ACT-0001",
    aliases: ["Synthetic Act One"],
    provisions: [
      { provisionIdentityId: "SYNTH-PROV-0001", label: "Section 2" },
    ],
  },
  {
    id: "SYNTH-ACT-0002",
    documentType: "SYNTHETIC_STATUTE",
    citationText: "SYNTH-ACT-0002",
    aliases: ["Synthetic Act Two"],
  },
];

describe("authority ledger validation", () => {
  it("rejects a duplicate assertion id", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01" });
    expect(() => addAmendment(ledger, { effective: "2026-07-01" })).toThrow(
      /duplicate_assertion_id/,
    );
  });

  it("rejects a conditional confirmation with no conditions", () => {
    const { ledger } = seed();
    expect(() =>
      addAmendment(ledger, {
        effective: "2026-07-01",
        review: "CONFIRMED_WITH_CONDITIONS",
      }),
    ).toThrow(/conditions_required/);
  });

  it("rejects a duplicate review", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01", review: "CONFIRMED" });
    const original = ledger.getReview("synth-review-0001");
    expect(original).not.toBeNull();
    expect(() =>
      ledger.addReview({ ...original!, id: "synth-review-0002" }),
    ).toThrow(/duplicate_review/);
  });

  it("excludes a review superseded by another active review", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01", review: "CONFIRMED" });
    addSecondReview(ledger, {
      id: "synth-review-0002",
      reviewerId: "synth-reviewer-02",
      decisionDate: "2026-06-16",
      supersedesReviewId: "synth-review-0001",
    });

    const active = listActiveReviews(ledger.snapshot(), "synth-assert-0001");
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("synth-review-0002");
  });
});

describe("authority projection", () => {
  it("abstains when no assertion exists", () => {
    const { ledger } = seed();
    const projection = project(ledger, "2026-06-30");
    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("NO_ASSERTION");
    expect(projection.abstained).toBe(true);
  });

  it("partially determines an unreviewed assertion", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01" });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("PARTIALLY_DETERMINED");
    expect(projection.missing).toContain("NO_REVIEWED_CONCLUSION");
  });

  it("determines a confirmed but not yet effective amendment", () => {
    const { ledger } = seed();
    addAmendment(ledger, {
      effective: "2026-07-01",
      review: "CONFIRMED",
    });
    const projection = project(ledger, "2026-06-30");
    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("NOT_YET_EFFECTIVE");
  });

  it("applies a confirmed amendment on its effective date", () => {
    const { ledger } = seed();
    addAmendment(ledger, {
      effective: "2026-07-01",
      review: "CONFIRMED",
    });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
  });

  it("abstains when the only review rejects the assertion", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01", review: "REJECTED" });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("NO_CONFIRMED_EFFECT");
  });

  it("reports a conflict between confirmed and rejected reviews", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: "2026-07-01", review: "CONFIRMED" });
    addSecondReview(ledger, {
      id: "synth-review-0002",
      outcome: "REJECTED",
      reviewerId: "synth-reviewer-02",
      decisionDate: "2026-06-16",
    });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("CONFLICTED");
    expect(projection.missing).toContain("CONFLICTING_REVIEWS");
  });

  it("denies a confirmed effect whose evidence is unavailable", () => {
    const { ledger } = seed();
    addAmendment(ledger, {
      effective: "2026-07-01",
      availability: "UNAVAILABLE",
      review: "CONFIRMED",
    });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("EVIDENCE_UNAVAILABLE");
  });

  it("denies a confirmed effect with no effective date", () => {
    const { ledger } = seed();
    addAmendment(ledger, { effective: null, review: "CONFIRMED" });
    const projection = project(ledger, "2026-07-01");
    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("UNKNOWN_EFFECTIVE_DATE");
  });

  it("returns unauthorized without abstaining", () => {
    const { ledger } = seed();
    addAmendment(ledger, {
      effective: "2026-07-01",
      review: "CONFIRMED",
    });
    const projection = project(ledger, "2026-07-01", "UNAUTHORIZED");
    expect(projection.outcome).toBe("UNAUTHORIZED");
    expect(projection.abstained).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const { ledger } = seed();
    addAmendment(ledger, {
      effective: "2026-07-01",
      review: "CONFIRMED",
    });
    const request = {
      snapshot: ledger.snapshot(),
      documentId: "SYNTH-ACT-0001",
      asOf: "2026-07-01",
      authorization: "NOT_CHECKED" as const,
    };
    expect(projectAuthorityState(request)).toEqual(
      projectAuthorityState(request),
    );
  });
});

describe("citation resolver", () => {
  it("resolves an exact canonical identifier", () => {
    const resolver = new CitationResolver(baseDocuments);
    expect(resolver.resolve("SYNTH-ACT-0001").status).toBe("EXACT");
  });

  it("resolves an alias", () => {
    const resolver = new CitationResolver(baseDocuments);
    expect(resolver.resolve("Synthetic Act One").status).toBe("ALIAS");
  });

  it("refuses to guess between ambiguous aliases", () => {
    const resolver = new CitationResolver([
      ...baseDocuments,
      {
        id: "SYNTH-ACT-0003",
        documentType: "SYNTHETIC_STATUTE",
        citationText: "SYNTH-ACT-0003",
        aliases: ["Synthetic Act One"],
      },
    ]);
    expect(resolver.resolve("Synthetic Act One").status).toBe(
      "MULTIPLE_CANDIDATES",
    );
  });

  it("rejects blank input", () => {
    const resolver = new CitationResolver(baseDocuments);
    expect(resolver.resolve("   ").status).toBe("INVALID_FORMAT");
  });

  it("rejects an unsupported citation type", () => {
    const resolver = new CitationResolver(baseDocuments);
    expect(resolver.resolve("the quick brown fox").status).toBe(
      "UNSUPPORTED_TYPE",
    );
  });

  it("returns a partial result for a bare provision", () => {
    const resolver = new CitationResolver(baseDocuments);
    expect(resolver.resolve("Section 2").status).toBe("PARTIAL");
  });

  it("resolves a provision with document context", () => {
    const resolver = new CitationResolver(baseDocuments);
    const resolution = resolver.resolve("Section 2", {
      documentId: "SYNTH-ACT-0001",
    });
    expect(resolution.status).toBe("EXACT");
    expect(resolution.candidates[0]?.provisionIdentityId).toBe(
      "SYNTH-PROV-0001",
    );
  });

  it("does not invent a missing provision", () => {
    const resolver = new CitationResolver(baseDocuments);
    const resolution = resolver.resolve("Section 9", {
      documentId: "SYNTH-ACT-0001",
    });
    expect(["NO_MATCH", "PARTIAL"]).toContain(resolution.status);
    expect(
      resolution.candidates.map((candidate) => candidate.provisionIdentityId),
    ).not.toContain("SYNTH-PROV-0001");
  });
});
