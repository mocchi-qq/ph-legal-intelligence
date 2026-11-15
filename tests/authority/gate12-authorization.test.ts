// Gate 12 — authorization is checked, not assumed.
// Every fixture is fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import { AuthorityLedger } from "../../packages/legal-ingestion/src/authority-ledger";
import {
  type DocumentActivityDecision,
  type DocumentActivityRequest,
  type ProjectionAuthorizationDecision,
  type ProjectionRequest,
  projectAuthorityState,
} from "../../packages/legal-ingestion/src/index";
import { queryAuthorityAsOf } from "../../packages/legal-ingestion/src/temporal-query";

const TARGET_DOCUMENT_ID = "SYNTH-ACT-0001";
const TARGET_PROVISION_IDENTITY_ID = "SYNTH-PROV-0001";
const TARGET_VERSION_ID = "SYNTH-ACT-0001-v1";
const SOURCE_DOCUMENT_ID = "SYNTH-ACT-0002";
const OTHER_SOURCE_DOCUMENT_ID = "SYNTH-ACT-0003";

function seed(): AuthorityLedger {
  const ledger = new AuthorityLedger();

  ledger.addDocument({
    id: TARGET_DOCUMENT_ID,
    documentType: "SYNTHETIC_STATUTE",
    title: "Synthetic Act One",
  });
  ledger.addDocument({
    id: SOURCE_DOCUMENT_ID,
    documentType: "SYNTHETIC_STATUTE",
    title: "Synthetic Act Two",
  });
  ledger.addDocument({
    id: OTHER_SOURCE_DOCUMENT_ID,
    documentType: "SYNTHETIC_STATUTE",
    title: "Synthetic Act Three",
  });
  ledger.addVersion({
    id: TARGET_VERSION_ID,
    documentId: TARGET_DOCUMENT_ID,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  });
  ledger.addProvision({
    id: "SYNTH-SEC-0001",
    documentId: TARGET_DOCUMENT_ID,
    versionId: TARGET_VERSION_ID,
    label: "Section 2",
    text: "Synthetic provision text.",
  });
  ledger.addProvisionIdentity({
    id: TARGET_PROVISION_IDENTITY_ID,
    documentId: TARGET_DOCUMENT_ID,
    provisionType: "SECTION",
    canonicalLabel: "Section 2",
    createdAt: "2026-01-01T00:00:00Z",
  });
  ledger.addProvisionMapping({
    id: "SYNTH-MAP-0001",
    provisionIdentityId: TARGET_PROVISION_IDENTITY_ID,
    provisionVersionId: "SYNTH-SEC-0001",
    documentVersionId: TARGET_VERSION_ID,
    mappingType: "SAME",
    rationale: "Synthetic continuity.",
    reviewStatus: "REVIEWED",
    createdAt: "2026-01-01T00:00:00Z",
  });

  return ledger;
}

interface EffectOptions {
  id: string;
  sourceDocumentId?: string;
  claimedEffectiveDate?: string | null;
  review?: "CONFIRMED" | "REJECTED" | null;
  supersedesAssertionId?: string | null;
}

/** One reviewed PARTIAL_AMENDMENT effect, its evidence and its confirmation. */
function addEffect(ledger: AuthorityLedger, opts: EffectOptions): void {
  const effective = opts.claimedEffectiveDate ?? "2026-07-01";
  const evidenceId = `synth-evidence-${opts.id}`;

  ledger.addAssertion({
    id: opts.id,
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: opts.sourceDocumentId ?? SOURCE_DOCUMENT_ID,
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: TARGET_DOCUMENT_ID,
    targetProvisionIdentityId: TARGET_PROVISION_IDENTITY_ID,
    targetVersionId: TARGET_VERSION_ID,
    scope: "Synthetic scope",
    claimedDate: "2026-06-01",
    claimedEffectiveDate: effective,
    evidenceId,
    sourceLocator: "Section 3",
    assertionOrigin: "synthetic-fixture",
    recordedAt: "2026-06-01T00:00:00Z",
    recordedBy: "synth-fixture-loader",
    state: "UNREVIEWED",
    supersedesAssertionId: opts.supersedesAssertionId ?? null,
    conflictGroupId: null,
  });

  ledger.addEvidence({
    id: evidenceId,
    assertionId: opts.id,
    documentVersionId: null,
    provisionVersionId: null,
    artifactId: null,
    contentHash: null,
    passage: "Synthetic passage.",
    locator: "Section 3",
    evidenceDate: null,
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
    checkedAt: "2026-11-14T00:00:00Z",
  });

  if (opts.review) {
    ledger.addReview({
      id: `synth-review-${opts.id}`,
      assertionId: opts.id,
      outcome: opts.review,
      reviewerId: "synth-reviewer-01",
      reviewerCapacity: "synthetic-legal-reviewer",
      decisionDate: "2026-06-15",
      scope: "synthetic scope",
      propositionReviewed: "Synthetic amendment proposition",
      conditions: [],
      evidenceRefs: [evidenceId],
      notes: "Synthetic fixture. Not a real counsel determination.",
      supersedesReviewId: null,
      status: "ACTIVE",
      recordedAt: "2026-06-15T00:00:00Z",
    });
  }
}

/** A caller assertion for the projection's own activity. */
function asserted(
  decision: ProjectionAuthorizationDecision,
): Pick<ProjectionRequest, "authorizationAssertion"> {
  return { authorizationAssertion: { activity: "citation_display", decision } };
}

function requestWith(
  ledger: AuthorityLedger,
  input: Pick<
    ProjectionRequest,
    "authorizationAssertion" | "documentActivityAuthorization"
  >,
  asOf = "2026-07-01",
): ProjectionRequest {
  return {
    snapshot: ledger.snapshot(),
    documentId: TARGET_DOCUMENT_ID,
    asOf,
    activity: "citation_display",
    ...input,
  };
}

function request(
  ledger: AuthorityLedger,
  decision: ProjectionAuthorizationDecision,
  asOf = "2026-07-01",
): ProjectionRequest {
  return requestWith(ledger, asserted(decision), asOf);
}

/**
 * A full document/activity decision, as a registry adapter would answer it. These
 * fixtures resolve from the requested document id alone, so `sourceId`, `status`
 * and `decisionRef` stay null: nothing here is a recorded decision.
 */
function decisionFor(
  check: DocumentActivityRequest,
  decision: ProjectionAuthorizationDecision,
): DocumentActivityDecision {
  return {
    documentId: check.documentId,
    activity: check.activity,
    role: check.role,
    decision,
    sourceId: null,
    status: null,
    reason:
      decision === "AUTHORIZED"
        ? "synthetic_authorized"
        : decision === "UNAUTHORIZED"
          ? "synthetic_unauthorized"
          : "synthetic_not_checked",
    decisionRef: null,
  };
}

/** Target is authorized; only the second source document is not. */
function notCheckedSourceResolver(
  check: DocumentActivityRequest,
): DocumentActivityDecision {
  return decisionFor(
    check,
    check.documentId === TARGET_DOCUMENT_ID ||
      check.documentId === SOURCE_DOCUMENT_ID
      ? "AUTHORIZED"
      : "NOT_CHECKED",
  );
}

/** Target is authorized; only the second source document is denied. */
function unauthorizedSourceResolver(
  check: DocumentActivityRequest,
): DocumentActivityDecision {
  return decisionFor(
    check,
    check.documentId === TARGET_DOCUMENT_ID ||
      check.documentId === SOURCE_DOCUMENT_ID
      ? "AUTHORIZED"
      : "UNAUTHORIZED",
  );
}

describe("Gate 12 — target authorization gating", () => {
  it("abstains when authorization was never checked", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "NOT_CHECKED"));

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.outcome).not.toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    expect(projection.abstained).toBe(true);
    expect(projection.authorization).toBe("NOT_CHECKED");
  });

  it("keeps the unauthorized answer unchanged", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "UNAUTHORIZED"));

    expect(projection.outcome).toBe("UNAUTHORIZED");
    expect(projection.state).toBe("UNKNOWN");
    // Gate 13 adds the activity the denial applies to; the Gate 12 code stays.
    expect(projection.missing).toEqual([
      "NOT_AUTHORIZED",
      "activity:citation_display",
    ]);
    expect(projection.abstained).toBe(false);
  });

  it("reproduces the pre-change result for a scalar AUTHORIZED, plus the Gate 13 trace", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "AUTHORIZED"));

    expect(projection).toEqual({
      outcome: "DETERMINED_WITH_REVIEWED_EVIDENCE",
      documentId: TARGET_DOCUMENT_ID,
      provisionIdentityId: null,
      versionId: TARGET_VERSION_ID,
      asOf: "2026-07-01",
      state: "PARTIALLY_AMENDED",
      assertions: ["synth-assert-0001"],
      reviews: ["synth-review-synth-assert-0001"],
      evidence: ["synth-evidence-synth-assert-0001"],
      conflicts: [],
      missing: [],
      explanation:
        "State derived from reviewed effect(s) effective on or before the as-of date.",
      abstained: false,
      authorization: "AUTHORIZED",
      // Gate 13 provenance: a scalar is a caller assertion, never a registry
      // answer, and the evidence record names no document version, so only the
      // target and the effect source were consulted.
      authorizationSource: "caller_asserted",
      authorizationChecks: [
        {
          documentId: TARGET_DOCUMENT_ID,
          activity: "citation_display",
          role: "TARGET",
          decision: "AUTHORIZED",
          sourceId: null,
          status: null,
          reason: "caller_asserted",
          decisionRef: null,
        },
        {
          documentId: SOURCE_DOCUMENT_ID,
          activity: "citation_display",
          role: "SOURCE",
          decision: "AUTHORIZED",
          sourceId: null,
          status: null,
          reason: "caller_asserted",
          decisionRef: null,
        },
      ],
    });
  });

  it("treats an out-of-vocabulary resolver answer as not checked", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: () =>
          ({ decision: undefined }) as unknown as DocumentActivityDecision,
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    expect(projection.abstained).toBe(true);
    expect(projection.authorization).toBe("NOT_CHECKED");
    // Gate 13: a resolver answer whose decision is not a canonical literal is
    // refused as invalid_decision (an assertion keeps unrecognised_decision).
    expect(projection.authorizationChecks?.[0]?.reason).toBe(
      "invalid_decision",
    );
  });

  it("treats an out-of-vocabulary assertion decision as not checked", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        authorizationAssertion: {
          activity: "citation_display",
          decision: "authorized" as unknown as ProjectionAuthorizationDecision,
        },
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    expect(projection.abstained).toBe(true);
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "unrecognised_decision",
        decisionRef: null,
      },
    ]);
  });

  it("treats an empty assertion decision as not checked", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        authorizationAssertion: {
          activity: "citation_display",
          decision: "" as unknown as ProjectionAuthorizationDecision,
        },
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    expect(projection.abstained).toBe(true);
  });

  it("still determines on an AUTHORIZED literal", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "AUTHORIZED"));

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
  });

  it("still returns the unauthorized outcome for an UNAUTHORIZED literal", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "UNAUTHORIZED"));

    expect(projection.outcome).toBe("UNAUTHORIZED");
  });

  it("still abstains on a NOT_CHECKED literal", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = projectAuthorityState(request(ledger, "NOT_CHECKED"));

    expect(projection.abstained).toBe(true);
  });
});

describe("Gate 12 — source authorization gating", () => {
  it("drops an assertion whose source was not checked", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "synth-assert-0001",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: notCheckedSourceResolver,
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "SOURCE_AUTHORIZATION_NOT_CHECKED:synth-assert-0001",
    ]);
    expect(projection.abstained).toBe(true);
    expect(projection.assertions).toEqual([]);
  });

  it("drops an assertion whose source is unauthorized", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "synth-assert-0001",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: unauthorizedSourceResolver,
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "SOURCE_NOT_AUTHORIZED:synth-assert-0001",
    ]);
    expect(projection.abstained).toBe(true);
  });

  it("determines from surviving assertions and reports what it excluded", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-a", review: "CONFIRMED" });
    addEffect(ledger, {
      id: "synth-assert-b",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: notCheckedSourceResolver,
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
    expect(projection.assertions).toEqual(["synth-assert-a"]);
    expect(projection.reviews).toEqual(["synth-review-synth-assert-a"]);
    expect(projection.missing).toEqual([
      "SOURCE_AUTHORIZATION_NOT_CHECKED:synth-assert-b",
    ]);
    expect(projection.abstained).toBe(false);
  });

  it("abstains when every assertion comes from an unauthorized source", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "synth-assert-a",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });
    addEffect(ledger, {
      id: "synth-assert-b",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: unauthorizedSourceResolver,
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "SOURCE_NOT_AUTHORIZED:synth-assert-a",
      "SOURCE_NOT_AUTHORIZED:synth-assert-b",
    ]);
    expect(projection.abstained).toBe(true);
  });

  it("does not resurrect an assertion removed by an unauthorized superseder", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "synth-assert-old",
      claimedEffectiveDate: "2026-03-01",
      review: "CONFIRMED",
    });
    addEffect(ledger, {
      id: "synth-assert-new",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      claimedEffectiveDate: "2026-07-01",
      review: "CONFIRMED",
      supersedesAssertionId: "synth-assert-old",
    });

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: unauthorizedSourceResolver,
      }),
    );

    // Supersession runs before gating, so the unauthorized superseder still
    // removes the assertion it supersedes instead of leaving stale state.
    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "SOURCE_NOT_AUTHORIZED:synth-assert-new",
    ]);
    expect(projection.assertions).not.toContain("synth-assert-old");
    expect(projection.abstained).toBe(true);
  });

  it("still reports NO_ASSERTION when nothing was ever asserted", () => {
    const ledger = seed();

    const projection = projectAuthorityState(
      requestWith(ledger, {
        documentActivityAuthorization: unauthorizedSourceResolver,
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toEqual(["NO_ASSERTION"]);
    expect(projection.abstained).toBe(true);
  });
});

describe("Gate 12 — temporal query entry point", () => {
  it("abstains on an unchecked temporal query", () => {
    const ledger = seed();
    addEffect(ledger, { id: "synth-assert-0001", review: "CONFIRMED" });

    const projection = queryAuthorityAsOf(ledger, {
      documentId: TARGET_DOCUMENT_ID,
      provisionIdentityId: TARGET_PROVISION_IDENTITY_ID,
      asOf: "2026-07-01",
      activity: "citation_display",
      authorizationAssertion: {
        activity: "citation_display",
        decision: "NOT_CHECKED",
      },
    });

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.outcome).not.toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toContain("AUTHORIZATION_NOT_CHECKED");
    expect(projection.abstained).toBe(true);
  });

  it("applies the source resolver through the temporal query", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "synth-assert-0001",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      review: "CONFIRMED",
    });

    const projection = queryAuthorityAsOf(ledger, {
      documentId: TARGET_DOCUMENT_ID,
      provisionIdentityId: TARGET_PROVISION_IDENTITY_ID,
      asOf: "2026-07-01",
      activity: "citation_display",
      documentActivityAuthorization: notCheckedSourceResolver,
    });

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "SOURCE_AUTHORIZATION_NOT_CHECKED:synth-assert-0001",
    ]);
    expect(projection.abstained).toBe(true);
  });
});
