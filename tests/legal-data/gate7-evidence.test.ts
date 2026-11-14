// Gate 7 — evidence metadata states and availability denial. Synthetic only.
import { describe, expect, it } from "vitest";
import {
  AuthorizationAuditService,
  assessEvidence,
  CounselAuthorizationService,
  type CounselDetermination,
  CounselDeterminationRepository,
  type EvidenceMetadata,
  InMemoryAuthorizationAuditSink,
  InMemoryCounselRegistry,
  resolveEvidenceStatuses,
  SyntheticEvidenceCatalogue,
  UnavailableEvidenceStore,
  verifyEvidenceBytes,
} from "../../packages/legal-ingestion/src/index";

const SOURCE = "synthetic_evidence_source";

function verified(): EvidenceMetadata {
  return {
    reference: "synthetic://evidence/opinion",
    kind: "COUNSEL_OPINION",
    contentHash: "a".repeat(64),
    sizeBytes: 1024,
    received: true,
    fileAvailable: true,
    attestation: "FULL",
    issuedAt: "2026-11-14",
    verifiedBy: "synthetic-verifier",
  };
}

describe("Gate 7 — evidence availability states", () => {
  it("distinguishes every registry-side state", () => {
    expect(assessEvidence("", null)).toBe("REFERENCE_INVALID");
    expect(assessEvidence("synthetic://x", null)).toBe("NOT_RECEIVED");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        received: false,
      }),
    ).toBe("NOT_RECEIVED");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        fileAvailable: false,
      }),
    ).toBe("FILE_UNAVAILABLE");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        contentHash: "not-a-hash",
      }),
    ).toBe("HASH_MISMATCH");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        sizeBytes: null,
      }),
    ).toBe("EVIDENCE_INCOMPLETE");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        attestation: "NONE",
        verifiedBy: null,
      }),
    ).toBe("AVAILABLE_UNVERIFIED");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        attestation: "IDENTITY_ONLY",
      }),
    ).toBe("AUTHORITY_UNVERIFIED");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
        attestation: "AUTHORITY_ONLY",
      }),
    ).toBe("IDENTITY_UNVERIFIED");
    expect(
      assessEvidence("synthetic://x", {
        ...verified(),
        reference: "synthetic://x",
      }),
    ).toBe("VERIFIED_FOR_RECORDING");
  });

  it("accepts only synthetic references in the test catalogue", () => {
    expect(
      () =>
        new SyntheticEvidenceCatalogue([
          { ...verified(), reference: "https://example.gov.ph/opinion.pdf" },
        ]),
    ).toThrow("synthetic_evidence_reference_required");
    const catalogue = new SyntheticEvidenceCatalogue([verified()]);
    expect(catalogue.add).toBeTypeOf("function");
  });

  it("resolves missing references to NOT_RECEIVED, never approval", async () => {
    const statuses = await resolveEvidenceStatuses(
      ["synthetic://evidence/opinion", "synthetic://evidence/missing"],
      new SyntheticEvidenceCatalogue([verified()]),
    );
    expect(statuses.get("synthetic://evidence/opinion")).toBe(
      "VERIFIED_FOR_RECORDING",
    );
    expect(statuses.get("synthetic://evidence/missing")).toBe("NOT_RECEIVED");
    const unavailable = await resolveEvidenceStatuses(
      ["synthetic://evidence/opinion"],
      new UnavailableEvidenceStore(),
    );
    expect(unavailable.get("synthetic://evidence/opinion")).toBe(
      "NOT_RECEIVED",
    );
  });

  it("verifies bytes against the recorded hash", () => {
    const metadata = verified();
    const bytes = new TextEncoder().encode("synthetic");
    expect(verifyEvidenceBytes(metadata, bytes)).toBe(false);
    expect(verifyEvidenceBytes({ ...metadata, contentHash: null }, bytes)).toBe(
      false,
    );
  });
});

function determination(evidenceRef: string): CounselDetermination {
  return {
    id: "det_e",
    sourceId: SOURCE,
    documentIds: [],
    counselId: "c_e",
    dateReceived: "2026-11-14",
    dateIssued: "2026-11-14",
    effectiveDate: "2026-11-01",
    expiryDate: "2027-11-01",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic evidence determination",
    activityDecisions: [
      {
        activity: "downloading",
        status: "APPROVED",
        scope: null,
        conditions: [],
        limitations: [],
        permittedUsers: [],
        effectiveDate: null,
        expiryDate: null,
        evidenceRef,
      },
    ],
    evidenceRefs: [evidenceRef],
    decisionDocumentRef: "synthetic://evidence/decision",
    decisionDocumentHash: "b".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: null,
  };
}

async function service(evidenceRef: string, store: SyntheticEvidenceCatalogue) {
  const repo = new CounselDeterminationRepository();
  repo.registerCounsel(
    {
      id: "c_e",
      name: "Synthetic Evidence Counsel",
      firm: null,
      jurisdiction: "PH",
      capacity: "Legal counsel",
      verificationStatus: "VERIFIED",
      verificationEvidenceRef: "synthetic://evidence/identity",
      verifiedBy: "synthetic-registrar",
      verifiedAt: "2026-11-14",
    },
    "synthetic-registrar",
    "setup",
  );
  repo.record(determination(evidenceRef), "synthetic-registrar", "record");
  return new CounselAuthorizationService(
    new InMemoryCounselRegistry(repo),
    new AuthorizationAuditService(new InMemoryAuthorizationAuditSink()),
    { runtimeMode: "TEST_IN_MEMORY", evidence: store },
  );
}

describe("Gate 7 — evidence availability in projection", () => {
  it("denies when the evidence reference is not in the store", async () => {
    const authorization = await service(
      "synthetic://evidence/opinion",
      new SyntheticEvidenceCatalogue(),
    );
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("evidence_unavailable");
  });

  it("denies when the file is available but unverified", async () => {
    const authorization = await service(
      "synthetic://evidence/opinion",
      new SyntheticEvidenceCatalogue([
        { ...verified(), attestation: "NONE", verifiedBy: null },
      ]),
    );
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("evidence_unavailable");
  });

  it("allows only when every reference is VERIFIED_FOR_RECORDING", async () => {
    const authorization = await service(
      "synthetic://evidence/opinion",
      new SyntheticEvidenceCatalogue([verified()]),
    );
    const decision = await authorization.authorize({
      sourceId: SOURCE,
      activity: "downloading",
      operation: "ingest",
      now: "2026-11-14T12:00:00Z",
    });
    expect(decision.allowed).toBe(true);
  });
});
