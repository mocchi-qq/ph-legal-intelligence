// Gate 8 — temporal authority queries.
// All fixtures are fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import { AuthorityLedger } from "../../packages/legal-ingestion/src/authority-ledger";
import {
  listApplicableAssertions,
  queryAuthorityAsOf,
} from "../../packages/legal-ingestion/src/temporal-query";

const DOCUMENT_ID = "SYNTH-ACT-0001";
const PROVISION_IDENTITY_ID = "SYNTH-PROV-0001";

function seed(): AuthorityLedger {
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
    rationale: "Synthetic identity carried across the version.",
    reviewStatus: "REVIEWED",
    createdAt: "2026-01-01T00:00:00Z",
  });

  return ledger;
}

/** One reviewed PARTIAL_AMENDMENT effect with its evidence and confirmation. */
function addAmendment(
  ledger: AuthorityLedger,
  claimedEffectiveDate: string | null,
  suffix = "0001",
): void {
  const assertionId = `synth-assert-${suffix}`;
  const evidenceId = `synth-evidence-${suffix}`;

  ledger.addAssertion({
    id: assertionId,
    effectType: "PARTIAL_AMENDMENT",
    sourceDocumentId: "SYNTH-ACT-0002",
    sourceVersionId: null,
    sourceProvisionId: null,
    targetDocumentId: "SYNTH-ACT-0001",
    targetProvisionIdentityId: "SYNTH-PROV-0001",
    targetVersionId: "SYNTH-ACT-0001-v1",
    scope: "Synthetic scope",
    claimedDate: "2026-06-01",
    claimedEffectiveDate,
    evidenceId,
    sourceLocator: "Section 3",
    assertionOrigin: "synthetic-fixture",
    recordedAt: "2026-06-01T00:00:00Z",
    recordedBy: "synth-fixture-loader",
    state: "UNREVIEWED",
    supersedesAssertionId: null,
    conflictGroupId: null,
  });

  ledger.addEvidence({
    id: evidenceId,
    assertionId,
    documentVersionId: "SYNTH-ACT-0001-v1",
    provisionVersionId: "SYNTH-SEC-0001",
    artifactId: null,
    contentHash: null,
    passage: "Synthetic passage.",
    locator: "Section 3",
    evidenceDate: null,
    classification: "OFFICIAL_PRIMARY",
    availability: "AVAILABLE",
    checkedAt: "2026-11-14T00:00:00Z",
  });

  ledger.addReview({
    id: `synth-review-${suffix}`,
    assertionId,
    outcome: "CONFIRMED",
    reviewerId: `synth-reviewer-${suffix}`,
    reviewerCapacity: "synthetic-legal-reviewer",
    decisionDate: "2026-06-15",
    scope: "synthetic scope",
    propositionReviewed: `Synthetic amendment proposition ${suffix}`,
    conditions: [],
    evidenceRefs: [evidenceId],
    notes: "Synthetic fixture. Not a real counsel determination.",
    supersedesReviewId: null,
    status: "ACTIVE",
    recordedAt: "2026-06-15T00:00:00Z",
  });
}

function query(ledger: AuthorityLedger, asOf: string) {
  return queryAuthorityAsOf(ledger, {
    documentId: DOCUMENT_ID,
    provisionIdentityId: PROVISION_IDENTITY_ID,
    asOf,
    authorization: "AUTHORIZED",
  });
}

describe("queryAuthorityAsOf", () => {
  it("reports a prospective effect as not yet effective before its date", () => {
    const ledger = seed();
    addAmendment(ledger, "2026-07-01");

    const projection = query(ledger, "2026-06-30");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("NOT_YET_EFFECTIVE");
  });

  it("applies the effect on its effective date", () => {
    const ledger = seed();
    addAmendment(ledger, "2026-07-01");

    const projection = query(ledger, "2026-07-01");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
  });

  it("keeps the effect applied after its effective date", () => {
    const ledger = seed();
    addAmendment(ledger, "2026-07-01");

    const projection = query(ledger, "2026-07-02");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("PARTIALLY_AMENDED");
  });

  it("abstains when a confirmed effect has no effective date", () => {
    const ledger = seed();
    addAmendment(ledger, null);

    const projection = query(ledger, "2026-07-01");

    expect(projection.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(projection.missing).toContain("UNKNOWN_EFFECTIVE_DATE");
  });

  it("reports a far-future effect as not yet effective", () => {
    const ledger = seed();
    addAmendment(ledger, "2027-01-01");

    const projection = query(ledger, "2026-12-31");

    expect(projection.outcome).toBe("DETERMINED_WITH_REVIEWED_EVIDENCE");
    expect(projection.state).toBe("NOT_YET_EFFECTIVE");
  });

  it("refuses to answer when processing is not authorized", () => {
    const ledger = seed();
    addAmendment(ledger, "2026-07-01");

    const projection = queryAuthorityAsOf(ledger, {
      documentId: DOCUMENT_ID,
      provisionIdentityId: PROVISION_IDENTITY_ID,
      asOf: "2026-07-01",
      authorization: "UNAUTHORIZED",
    });

    expect(projection.outcome).toBe("UNAUTHORIZED");
    expect(projection.abstained).toBe(false);
  });
});

describe("listApplicableAssertions", () => {
  it("lists the assertions already effective on the as-of date", () => {
    const ledger = seed();
    addAmendment(ledger, "2026-07-01");
    const snapshot = ledger.snapshot();

    expect(
      listApplicableAssertions(
        snapshot,
        DOCUMENT_ID,
        "2026-06-30",
        PROVISION_IDENTITY_ID,
      ),
    ).toEqual([]);

    expect(
      listApplicableAssertions(
        snapshot,
        DOCUMENT_ID,
        "2026-07-01",
        PROVISION_IDENTITY_ID,
      ),
    ).toHaveLength(1);

    const earlier = seed();
    addAmendment(earlier, "2026-01-01");

    expect(
      listApplicableAssertions(
        earlier.snapshot(),
        DOCUMENT_ID,
        "2026-06-30",
        PROVISION_IDENTITY_ID,
      ),
    ).toHaveLength(1);
  });
});
