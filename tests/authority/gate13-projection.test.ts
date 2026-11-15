// Gate 13 — every projection is for one activity, and authorization is resolved
// per (document, activity, role). Every fixture is fictional. No Philippine law
// is represented or implied.
import { describe, expect, it } from "vitest";
import { AuthorityLedger } from "../../packages/legal-ingestion/src/authority-ledger";
import {
  type Activity,
  type DocumentActivityAuthorization,
  type DocumentActivityDecision,
  type DocumentActivityRequest,
  type ProjectionAuthorizationDecision,
  type ProjectionRequest,
  projectAuthorityState,
} from "../../packages/legal-ingestion/src/index";

const TARGET_DOCUMENT_ID = "SYNTH-G13-DOC-1";
const TARGET_VERSION_ID = "SYNTH-G13-DOC-1-v1";
const SOURCE_DOCUMENT_ID = "SYNTH-G13-DOC-2";
const OTHER_SOURCE_DOCUMENT_ID = "SYNTH-G13-DOC-3";
const EVIDENCE_DOCUMENT_ID = "SYNTH-G13-DOC-4";
const EVIDENCE_VERSION_ID = "SYNTH-G13-DOC-4-v1";

function seed(): AuthorityLedger {
  const ledger = new AuthorityLedger();

  for (const [id, title] of [
    [TARGET_DOCUMENT_ID, "Synthetic Target Act"],
    [SOURCE_DOCUMENT_ID, "Synthetic Source Act"],
    [OTHER_SOURCE_DOCUMENT_ID, "Synthetic Other Source Act"],
    [EVIDENCE_DOCUMENT_ID, "Synthetic Evidence Gazette"],
  ] as const) {
    ledger.addDocument({ id, documentType: "SYNTHETIC_STATUTE", title });
  }
  ledger.addVersion({
    id: TARGET_VERSION_ID,
    documentId: TARGET_DOCUMENT_ID,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  });
  ledger.addVersion({
    id: EVIDENCE_VERSION_ID,
    documentId: EVIDENCE_DOCUMENT_ID,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  });

  return ledger;
}

interface EffectOptions {
  id: string;
  sourceDocumentId?: string;
  /** Version of the evidence document, or null when evidence names no version. */
  evidenceDocumentVersionId?: string | null;
  claimedEffectiveDate?: string;
  /** Further evidence ids for the same assertion, each naming no document version. */
  extraEvidenceIds?: string[];
  /** The assertion this one supersedes, if any. */
  supersedesAssertionId?: string | null;
}

/** One reviewed PARTIAL_AMENDMENT effect, its evidence and its confirmation. */
function addEffect(ledger: AuthorityLedger, opts: EffectOptions): void {
  const evidenceId = `SYNTH-G13-EVIDENCE-${opts.id}`;
  const extraEvidenceIds = opts.extraEvidenceIds ?? [];

  ledger.addAssertion({
    id: opts.id,
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: opts.sourceDocumentId ?? SOURCE_DOCUMENT_ID,
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: TARGET_DOCUMENT_ID,
    targetProvisionIdentityId: null,
    targetVersionId: TARGET_VERSION_ID,
    scope: "Synthetic scope",
    claimedDate: "2026-06-01",
    claimedEffectiveDate: opts.claimedEffectiveDate ?? "2026-07-01",
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
    documentVersionId: opts.evidenceDocumentVersionId ?? null,
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

  for (const extraId of extraEvidenceIds) {
    ledger.addEvidence({
      id: extraId,
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
  }

  ledger.addReview({
    id: `SYNTH-G13-REVIEW-${opts.id}`,
    assertionId: opts.id,
    outcome: "CONFIRMED",
    reviewerId: "synth-reviewer-01",
    reviewerCapacity: "synthetic-legal-reviewer",
    decisionDate: "2026-06-15",
    scope: "synthetic scope",
    propositionReviewed: "Synthetic amendment proposition",
    conditions: [],
    evidenceRefs: [evidenceId, ...extraEvidenceIds],
    notes: "Synthetic fixture. Not a real counsel determination.",
    supersedesReviewId: null,
    status: "ACTIVE",
    recordedAt: "2026-06-15T00:00:00Z",
  });
}

type DecisionMap = Record<string, ProjectionAuthorizationDecision>;

const key = (documentId: string, activity: string): string =>
  `${documentId}|${activity}`;

/**
 * A document-activity resolver over an explicit map. Anything the map does not
 * name has no decision recorded, which the projection must treat as unchecked.
 */
function resolverFrom(
  decisions: DecisionMap,
  calls?: Map<string, number>,
): (request: DocumentActivityRequest) => DocumentActivityDecision {
  return (request: DocumentActivityRequest): DocumentActivityDecision => {
    const pair = key(request.documentId, request.activity);
    if (calls !== undefined) calls.set(pair, (calls.get(pair) ?? 0) + 1);
    const decision = decisions[pair] ?? "NOT_CHECKED";
    return {
      documentId: request.documentId,
      activity: request.activity,
      role: request.role,
      decision,
      sourceId: `SYNTH-G13-SRC-${request.documentId}`,
      status:
        decision === "AUTHORIZED"
          ? "AUTHORIZED"
          : decision === "UNAUTHORIZED"
            ? "PROHIBITED"
            : "UNKNOWN",
      reason:
        decision === "AUTHORIZED"
          ? "authorized"
          : decision === "UNAUTHORIZED"
            ? "prohibited"
            : "no_decision_recorded",
      decisionRef:
        decision === "NOT_CHECKED"
          ? null
          : `SYNTH-G13-DECISION-${request.documentId}-${request.activity}`,
    };
  };
}

function request(
  ledger: AuthorityLedger,
  activity: Activity,
  input: Pick<
    ProjectionRequest,
    "authorizationAssertion" | "documentActivityAuthorization"
  >,
): ProjectionRequest {
  return {
    snapshot: ledger.snapshot(),
    documentId: TARGET_DOCUMENT_ID,
    asOf: "2026-07-01",
    activity,
    ...input,
  };
}

/** The caller-asserted form, naming the activity the request performs. */
function asserted(
  activity: Activity,
  decision: ProjectionAuthorizationDecision,
): Pick<ProjectionRequest, "authorizationAssertion"> {
  return { authorizationAssertion: { activity, decision } };
}

describe("Gate 13 — the projection answers for one activity", () => {
  it("does not carry a decision made for another activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });
    const decisions: DecisionMap = {
      [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
      [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
    };

    // The same resolver, asked for the activity the decision was made for.
    const cited = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom(decisions),
      }),
    );
    expect(cited.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(cited.state).toBe("PARTIALLY_AMENDED");

    // Asked for another activity, the same document is undecided.
    const indexed = projectAuthorityState(
      request(ledger, "search_indexing", {
        documentActivityAuthorization: resolverFrom(decisions),
      }),
    );

    expect(indexed.outcome).toBe("UNKNOWN");
    expect(indexed.state).toBe("UNKNOWN");
    expect(indexed.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:search_indexing",
    ]);
    expect(indexed.abstained).toBe(true);
    expect(indexed.authorization).toBe("NOT_CHECKED");
    expect(indexed.authorizationSource).toBe("document_activity");
    expect(indexed.assertions).toEqual([]);

    const target = indexed.authorizationChecks?.find(
      (check) => check.documentId === TARGET_DOCUMENT_ID,
    );
    expect(target?.activity).toBe("search_indexing");
    expect(target?.role).toBe("TARGET");
    expect(target?.decision).not.toBe("AUTHORIZED");
    expect(indexed.authorizationChecks).toHaveLength(1);
  });
});

describe("Gate 13 — source and evidence documents are resolved separately", () => {
  it("excludes an unauthorized source and still determines from the rest", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1", sourceDocumentId: SOURCE_DOCUMENT_ID });
    addEffect(ledger, {
      id: "a2",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
    });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "UNAUTHORIZED",
          [key(OTHER_SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
    expect(projection.assertions).toEqual(["a2"]);
    expect(projection.reviews).toEqual(["SYNTH-G13-REVIEW-a2"]);
    expect(projection.missing).toEqual(["SOURCE_NOT_AUTHORIZED:a1"]);
    expect(projection.abstained).toBe(false);

    const source = projection.authorizationChecks?.find(
      (check) => check.documentId === SOURCE_DOCUMENT_ID,
    );
    expect(source?.role).toBe("SOURCE");
    expect(source?.decision).toBe("UNAUTHORIZED");
  });

  it("withholds the determination when the evidence document is unauthorized", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "a1",
      evidenceDocumentVersionId: EVIDENCE_VERSION_ID,
    });
    const decided: DecisionMap = {
      [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
      [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
    };

    const withheld = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          ...decided,
          [key(EVIDENCE_DOCUMENT_ID, "citation_display")]: "UNAUTHORIZED",
        }),
      }),
    );

    expect(withheld.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(withheld.state).toBe("UNKNOWN");
    expect(withheld.abstained).toBe(true);
    expect(withheld.evidence).toEqual([]);
    expect(withheld.missing).toEqual([
      "EVIDENCE_NOT_AUTHORIZED:SYNTH-G13-EVIDENCE-a1",
    ]);
    const evidence = withheld.authorizationChecks?.find(
      (check) => check.documentId === EVIDENCE_DOCUMENT_ID,
    );
    expect(evidence?.role).toBe("EVIDENCE");
    expect(evidence?.decision).toBe("UNAUTHORIZED");

    const allowed = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          ...decided,
          [key(EVIDENCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(allowed.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(allowed.state).toBe("PARTIALLY_AMENDED");
    expect(allowed.evidence).toEqual(["SYNTH-G13-EVIDENCE-a1"]);
    expect(allowed.missing).toEqual([]);
  });

  it("withholds the determination when nobody decided the evidence document", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "a1",
      evidenceDocumentVersionId: EVIDENCE_VERSION_ID,
    });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          // The evidence document itself has no decision recorded.
        }),
      }),
    );

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.missing).toEqual([
      "EVIDENCE_AUTHORIZATION_NOT_CHECKED:SYNTH-G13-EVIDENCE-a1",
    ]);
    expect(
      projection.authorizationChecks?.find(
        (check) => check.documentId === EVIDENCE_DOCUMENT_ID,
      )?.decision,
    ).toBe("NOT_CHECKED");
  });

  it("records no evidence check when the evidence names no document version", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1", evidenceDocumentVersionId: null });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.missing).toEqual([]);
    expect(projection.authorizationChecks).toHaveLength(2);
    expect(
      projection.authorizationChecks?.some(
        (check) => check.role === "EVIDENCE",
      ),
    ).toBe(false);
    expect(
      projection.authorizationChecks?.map((check) => check.documentId),
    ).toEqual([TARGET_DOCUMENT_ID, SOURCE_DOCUMENT_ID]);
  });

  it("resolves each document once even when two assertions share a source", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1", sourceDocumentId: SOURCE_DOCUMENT_ID });
    addEffect(ledger, { id: "a2", sourceDocumentId: SOURCE_DOCUMENT_ID });
    const calls = new Map<string, number>();

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom(
          {
            [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
            [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          },
          calls,
        ),
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.assertions).toEqual(["a1", "a2"]);
    expect(calls.get(key(SOURCE_DOCUMENT_ID, "citation_display"))).toBe(1);
    expect(calls.get(key(TARGET_DOCUMENT_ID, "citation_display"))).toBe(1);
    // One entry per distinct (documentId, activity), including the target.
    expect(projection.authorizationChecks).toHaveLength(2);
    expect(
      projection.authorizationChecks?.filter(
        (check) => check.documentId === SOURCE_DOCUMENT_ID,
      ),
    ).toHaveLength(1);
  });
});

describe("Gate 13 — authorization provenance", () => {
  it("labels a document-activity resolver as document_activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(projection.authorizationSource).toBe("document_activity");
    expect(projection.authorizationChecks?.[0]).toMatchObject({
      documentId: TARGET_DOCUMENT_ID,
      role: "TARGET",
      decision: "AUTHORIZED",
      reason: "authorized",
      sourceId: `SYNTH-G13-SRC-${TARGET_DOCUMENT_ID}`,
    });
  });

  it("labels a caller assertion as caller_asserted", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(
        ledger,
        "citation_display",
        asserted("citation_display", "AUTHORIZED"),
      ),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.authorizationSource).toBe("caller_asserted");
    expect(projection.authorizationChecks).toEqual([
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
    ]);
  });
});

describe("Gate 13 — request shape fails closed", () => {
  it("refuses two authorization inputs", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        ...asserted("citation_display", "AUTHORIZED"),
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual(["AUTHORIZATION_INPUT_CONFLICT"]);
    expect(projection.abstained).toBe(true);
    expect(projection.authorizationChecks).toBeUndefined();
  });

  it("refuses a request with no authorization input", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState({
      snapshot: ledger.snapshot(),
      documentId: TARGET_DOCUMENT_ID,
      asOf: "2026-07-01",
      activity: "citation_display",
    });

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual(["AUTHORIZATION_INPUT_MISSING"]);
    expect(projection.abstained).toBe(true);
    expect(projection.authorizationChecks).toBeUndefined();
  });

  it("refuses an activity outside the enforceable taxonomy", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    // The assertion carries the same non-canonical activity, so the failure
    // under test is the request's activity, not a mismatch between the two.
    const projection = projectAuthorityState(
      request(
        ledger,
        "not_an_activity" as unknown as Activity,
        asserted("not_an_activity" as unknown as Activity, "AUTHORIZED"),
      ),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual(["UNKNOWN_ACTIVITY"]);
    expect(projection.abstained).toBe(true);
    // Nothing was consulted, so the trace is empty rather than absent.
    expect(projection.authorizationChecks).toEqual([]);
  });
});

describe("Gate 13 remediation — an assertion is only good for its own activity", () => {
  it("refuses an assertion made for another activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", asserted("viewing", "AUTHORIZED")),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(projection.abstained).toBe(true);
    expect(projection.authorization).toBe("NOT_CHECKED");
    expect(projection.authorizationSource).toBe("caller_asserted");
    expect(projection.assertions).toEqual([]);
    // A wrong-activity assertion authorizes nothing: the target is recorded as
    // not checked, with the reason the assertion was refused.
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "activity_mismatch",
        decisionRef: null,
      },
    ]);
  });

  it("refuses an assertion that does not name a canonical activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        authorizationAssertion: {
          activity: "citation_viewing" as unknown as Activity,
          decision: "AUTHORIZED",
        },
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(projection.abstained).toBe(true);
    expect(projection.authorizationChecks).toHaveLength(1);
    expect(projection.authorizationChecks?.[0]?.reason).toBe(
      "unknown_activity",
    );
  });

  it("cannot inject a registry identity through an assertion", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        authorizationAssertion: {
          activity: "citation_display",
          decision: "AUTHORIZED",
          sourceId: "SYNTH-G13-FORGED-SOURCE",
          status: "AUTHORIZED",
          decisionRef: "SYNTH-G13-FORGED-DECISION",
          reason: "authorized",
        } as unknown as ProjectionRequest["authorizationAssertion"],
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    for (const check of projection.authorizationChecks ?? []) {
      expect(check.sourceId).toBeNull();
      expect(check.status).toBeNull();
      expect(check.decisionRef).toBeNull();
      expect(check.reason).toBe("caller_asserted");
    }
  });
});

describe("Gate 13 remediation — the trace records every role consulted", () => {
  it("consults no resolver and records no check for an invalid as-of date", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });
    const calls = new Map<string, number>();

    const projection = projectAuthorityState({
      ...request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom(
          {
            [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
            [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          },
          calls,
        ),
      }),
      asOf: "2026-02-31",
    });

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.missing).toEqual(["INVALID_DATE"]);
    expect(projection.abstained).toBe(true);
    // Nothing was projected, so nothing was asked.
    expect(calls.size).toBe(0);
    expect(projection.authorizationChecks).toEqual([]);
    expect(projection.authorizationSource).toBe("document_activity");
  });

  it("records one entry per role when a document is both target and source", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1", sourceDocumentId: TARGET_DOCUMENT_ID });
    const calls = new Map<string, number>();

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom(
          { [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED" },
          calls,
        ),
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
    // One resolution for the (document, activity) pair...
    expect(calls.get(key(TARGET_DOCUMENT_ID, "citation_display"))).toBe(1);
    // ...and two trace entries, because two roles asked about it.
    const decided = {
      documentId: TARGET_DOCUMENT_ID,
      activity: "citation_display",
      decision: "AUTHORIZED",
      sourceId: `SYNTH-G13-SRC-${TARGET_DOCUMENT_ID}`,
      status: "AUTHORIZED",
      reason: "authorized",
      decisionRef: `SYNTH-G13-DECISION-${TARGET_DOCUMENT_ID}-citation_display`,
    } as const;
    expect(projection.authorizationChecks).toEqual([
      { ...decided, role: "SOURCE" },
      { ...decided, role: "TARGET" },
    ]);
  });
});

describe("Gate 13 remediation — evidence that may not be used is not reported", () => {
  it("reports no evidence id when one of a review's evidence documents is unauthorized", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "a1",
      evidenceDocumentVersionId: EVIDENCE_VERSION_ID,
      extraEvidenceIds: ["SYNTH-G13-EVIDENCE-a1-extra"],
    });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(EVIDENCE_DOCUMENT_ID, "citation_display")]: "UNAUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.missing).toContain(
      "EVIDENCE_NOT_AUTHORIZED:SYNTH-G13-EVIDENCE-a1",
    );
    // The extra record is authorized in its own right, but it belongs to the
    // same review, whose evidence base is unusable: listing it would name an
    // evidence id the projection may not rely on.
    expect(projection.evidence).toEqual([]);
  });
});

describe("Gate 13 remediation — a broken chain is a refusal, not a shorter chain", () => {
  it("refuses a chain whose only live link comes from an unauthorized source", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "a-old",
      sourceDocumentId: SOURCE_DOCUMENT_ID,
      claimedEffectiveDate: "2026-03-01",
    });
    addEffect(ledger, {
      id: "a-mid",
      sourceDocumentId: SOURCE_DOCUMENT_ID,
      claimedEffectiveDate: "2026-05-01",
      supersedesAssertionId: "a-old",
    });
    addEffect(ledger, {
      id: "a-new",
      sourceDocumentId: OTHER_SOURCE_DOCUMENT_ID,
      claimedEffectiveDate: "2026-07-01",
      supersedesAssertionId: "a-mid",
    });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
          [key(OTHER_SOURCE_DOCUMENT_ID, "citation_display")]: "UNAUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    // The break is named: the superseder is the one link that may not be used.
    expect(projection.missing).toEqual(["SOURCE_NOT_AUTHORIZED:a-new"]);
    expect(projection.assertions).not.toContain("a-old");
    expect(projection.assertions).not.toContain("a-mid");
    expect(projection.assertions).toEqual([]);
    const source = projection.authorizationChecks?.find(
      (check) => check.documentId === OTHER_SOURCE_DOCUMENT_ID,
    );
    expect(source?.role).toBe("SOURCE");
    expect(source?.decision).toBe("UNAUTHORIZED");
  });
});

describe("Gate 13 remediation — a document is checked once, not twice", () => {
  it("lets the target gate decide when the evidence names the target document", () => {
    const ledger = seed();
    addEffect(ledger, {
      id: "a1",
      evidenceDocumentVersionId: TARGET_VERSION_ID,
    });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: resolverFrom({
          [key(TARGET_DOCUMENT_ID, "citation_display")]: "UNAUTHORIZED",
          [key(SOURCE_DOCUMENT_ID, "citation_display")]: "AUTHORIZED",
        }),
      }),
    );

    expect(projection.outcome).toBe("UNAUTHORIZED");
    expect(projection.missing).toEqual([
      "NOT_AUTHORIZED",
      "activity:citation_display",
    ]);
    expect(projection.abstained).toBe(false);
    // The evidence resolves to the target, which was already checked, so the
    // evidence pass adds no code and no second trace entry.
    expect(
      (projection.missing ?? []).some((code) => code.startsWith("EVIDENCE_")),
    ).toBe(false);
    expect(projection.authorizationChecks).toHaveLength(1);
    expect(projection.authorizationChecks?.[0]?.role).toBe("TARGET");
  });
});

describe("Gate 13 remediation — a resolver answer must name the pair it checked", () => {
  /**
   * A resolver that ignores the question and answers with one fixed object.
   * Cast where the object is not a full decision: the point of these tests is a
   * resolver that does not honour `DocumentActivityAuthorization`.
   */
  function answering(answer: unknown): DocumentActivityAuthorization {
    return () => answer as DocumentActivityDecision;
  }

  /** The answer a correct adapter gives for the pair it was asked about. */
  const correctAnswer: DocumentActivityAuthorization = (
    request: DocumentActivityRequest,
  ): DocumentActivityDecision => ({
    documentId: request.documentId,
    activity: request.activity,
    role: request.role,
    decision: "AUTHORIZED",
    sourceId: `SYNTH-G13-SRC-${request.documentId}`,
    status: "AUTHORIZED",
    reason: "authorized",
    decisionRef: `SYNTH-G13-DECISION-${request.documentId}-${request.activity}`,
  });

  /** A bare answered pair, with the identity replaced by the caller's values. */
  function answerWith(
    identity: Record<string, unknown>,
  ): DocumentActivityDecision {
    return {
      ...correctAnswer({
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
      }),
      ...identity,
    } as unknown as DocumentActivityDecision;
  }

  it("refuses an answer that names no activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: answering({ decision: "AUTHORIZED" }),
      }),
    );

    // A decision for an unnamed activity says nothing about citation_display.
    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.authorization).toBe("NOT_CHECKED");
    expect(projection.assertions).toEqual([]);
    expect(projection.reviews).toEqual([]);
    expect(projection.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    // The trace names the asked pair, never the answer's absent one.
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "unknown_activity",
        decisionRef: null,
      },
    ]);
  });

  it("refuses an answer made for another activity", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: answering(
          answerWith({ activity: "viewing" }),
        ),
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.assertions).toEqual([]);
    expect(projection.missing).toEqual([
      "AUTHORIZATION_NOT_CHECKED",
      "activity:citation_display",
    ]);
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "activity_mismatch",
        decisionRef: null,
      },
    ]);
  });

  it("refuses an answer made for another document", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: answering(
          answerWith({ documentId: OTHER_SOURCE_DOCUMENT_ID }),
        ),
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.assertions).toEqual([]);
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "document_mismatch",
        decisionRef: null,
      },
    ]);
  });

  it("refuses an answer whose decision is not a canonical literal", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: answering(
          answerWith({
            decision: "yes" as unknown as ProjectionAuthorizationDecision,
          }),
        ),
      }),
    );

    expect(projection.outcome).toBe("UNKNOWN");
    expect(projection.state).toBe("UNKNOWN");
    expect(projection.abstained).toBe(true);
    expect(projection.assertions).toEqual([]);
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "NOT_CHECKED",
        sourceId: null,
        status: null,
        reason: "invalid_decision",
        decisionRef: null,
      },
    ]);
  });

  it("still determines on a full answer for the asked pair", () => {
    const ledger = seed();
    addEffect(ledger, { id: "a1" });

    const projection = projectAuthorityState(
      request(ledger, "citation_display", {
        documentActivityAuthorization: correctAnswer,
      }),
    );

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
    expect(projection.abstained).toBe(false);
    expect(projection.authorization).toBe("AUTHORIZED");
    expect(projection.missing).toEqual([]);
    expect(projection.authorizationChecks).toEqual([
      {
        documentId: TARGET_DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
        decision: "AUTHORIZED",
        sourceId: `SYNTH-G13-SRC-${TARGET_DOCUMENT_ID}`,
        status: "AUTHORIZED",
        reason: "authorized",
        decisionRef: `SYNTH-G13-DECISION-${TARGET_DOCUMENT_ID}-citation_display`,
      },
      {
        documentId: SOURCE_DOCUMENT_ID,
        activity: "citation_display",
        role: "SOURCE",
        decision: "AUTHORIZED",
        sourceId: `SYNTH-G13-SRC-${SOURCE_DOCUMENT_ID}`,
        status: "AUTHORIZED",
        reason: "authorized",
        decisionRef: `SYNTH-G13-DECISION-${SOURCE_DOCUMENT_ID}-citation_display`,
      },
    ]);
  });
});
