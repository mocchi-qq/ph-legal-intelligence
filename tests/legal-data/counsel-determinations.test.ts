import { describe, expect, it } from "vitest";
import {
  ActivityAuthorizationRegistry,
  AuthorizationAuditService,
  authorizeIndexing,
  authorizeTemporaryLocalStorage,
  CorpusStore,
  type CounselActivity,
  type CounselActivityDecision,
  type CounselDetermination,
  CounselDeterminationRepository,
  type CounselProfessional,
  type DocumentActivityAuthorization,
  InMemoryAuthorizationAuditSink,
  ingestArtifact,
  syncToAuthorizationRegistry,
} from "../../packages/legal-ingestion/src/index";
import { buildSearchIndex } from "../../packages/legal-search/src/index";

const AUDIT = {
  service: new AuthorizationAuditService(new InMemoryAuthorizationAuditSink()),
};

const SOURCE = "synthetic_counsel_source";
const OTHER_SOURCE = "synthetic_other_source";
const COUNSEL_ID = "counsel_synthetic_1";
const DET_ID = "det_synthetic_1";

function professional(
  overrides: Partial<CounselProfessional> = {},
): CounselProfessional {
  return {
    id: COUNSEL_ID,
    name: "Synthetic Counsel",
    firm: "Synthetic Law Firm",
    jurisdiction: "PH",
    capacity: "Legal counsel",
    verificationStatus: "VERIFIED",
    verificationEvidenceRef: "synthetic://counsel/verification-1",
    verifiedBy: "synthetic-registrar",
    verifiedAt: "2026-11-13",
    ...overrides,
  };
}

function activityDecision(
  activity: CounselActivity,
  overrides: Partial<CounselActivityDecision> = {},
): CounselActivityDecision {
  return {
    activity,
    status: "APPROVED",
    scope: "synthetic test scope",
    conditions: [],
    limitations: [],
    permittedUsers: [],
    effectiveDate: null,
    expiryDate: null,
    evidenceRef: "synthetic://determination/evidence-1",
    ...overrides,
  };
}

function determination(
  overrides: Partial<CounselDetermination> = {},
): CounselDetermination {
  return {
    id: DET_ID,
    sourceId: SOURCE,
    documentIds: [],
    counselId: COUNSEL_ID,
    dateReceived: "2026-11-13",
    dateIssued: "2026-11-13",
    effectiveDate: "2026-11-13",
    expiryDate: "2027-11-13",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic source-wide test determination",
    activityDecisions: [activityDecision("viewing")],
    evidenceRefs: ["synthetic://determination/evidence-1"],
    decisionDocumentRef: "synthetic://determination/document-1",
    decisionDocumentHash: "a".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: "Synthetic fixture. Not a real counsel determination.",
    ...overrides,
  };
}

function repo(): CounselDeterminationRepository {
  const repository = new CounselDeterminationRepository();
  repository.registerCounsel(
    professional(),
    "synthetic-registrar",
    "test setup",
  );
  return repository;
}

describe("Gate 5 — counsel determination provenance", () => {
  it("records a verified determination and projects only its exact activity", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "recorded");
    expect(r.project(SOURCE, "viewing").allowed).toBe(true);
    expect(r.project(SOURCE, "downloading").reason).toBe(
      "activity_not_covered",
    );
  });

  it("does not authorize another source", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "recorded");
    expect(r.project(OTHER_SOURCE, "viewing").reason).toBe(
      "no_verified_determination",
    );
  });

  it("does not infer storage from downloading", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: [activityDecision("downloading")] }),
      "synthetic-registrar",
      "download only",
    );
    expect(r.project(SOURCE, "downloading").allowed).toBe(true);
    expect(r.project(SOURCE, "persistent_storage").reason).toBe(
      "activity_not_covered",
    );
  });

  it("enforces document scope", () => {
    const r = repo();
    r.record(
      determination({
        documentIds: ["doc-1"],
        activityDecisions: [activityDecision("downloading")],
      }),
      "synthetic-registrar",
      "one document",
    );
    expect(
      r.project(SOURCE, "downloading", { documentId: "doc-1" }).allowed,
    ).toBe(true);
    expect(
      r.project(SOURCE, "downloading", { documentId: "doc-2" }).reason,
    ).toBe("document_scope_mismatch");
    expect(r.project(SOURCE, "downloading").reason).toBe(
      "document_scope_required",
    );
  });

  it("rejects VERIFIED when counsel identity is not verified", () => {
    const r = new CounselDeterminationRepository();
    r.registerCounsel(
      professional({
        verificationStatus: "UNVERIFIED",
        verificationEvidenceRef: null,
      }),
      "synthetic-registrar",
      "unverified",
    );
    expect(() =>
      r.record(determination(), "synthetic-registrar", "should fail"),
    ).toThrow(/counsel_identity_not_verified/);
  });

  it("rejects a verified determination with incomplete evidence", () => {
    const r = repo();
    expect(() =>
      r.record(
        determination({ evidenceRefs: [] }),
        "synthetic-registrar",
        "missing evidence",
      ),
    ).toThrow(/determination_evidence_missing/);
    expect(() =>
      r.record(
        determination({ decisionDocumentRef: null }),
        "synthetic-registrar",
        "missing document",
      ),
    ).toThrow(/decision_document_missing/);
  });

  it("denies when a required evidence file is unavailable", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "recorded");
    expect(
      r.project(SOURCE, "viewing", { evidenceAvailable: () => false }).reason,
    ).toBe("evidence_unavailable");
  });

  it("requires conditions for conditional approval and enforces them", () => {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [
          activityDecision("quotation", {
            status: "APPROVED_WITH_CONDITIONS",
            conditions: ["attribution", "max-300-chars"],
          }),
        ],
      }),
      "synthetic-registrar",
      "conditional",
    );
    expect(r.project(SOURCE, "quotation").allowed).toBe(false);
    expect(
      r.project(SOURCE, "quotation", {
        satisfiedConditions: ["attribution"],
      }).allowed,
    ).toBe(false);
    expect(
      r.project(SOURCE, "quotation", {
        satisfiedConditions: ["attribution", "max-300-chars"],
      }).allowed,
    ).toBe(true);
  });

  it("enforces effective and expiry dates", () => {
    const r = repo();
    r.record(
      determination({
        effectiveDate: "2027-01-01",
        expiryDate: "2028-01-01",
        activityDecisions: [activityDecision("downloading")],
      }),
      "synthetic-registrar",
      "future",
    );
    expect(
      r.project(SOURCE, "downloading", { now: "2026-11-13T00:00:00Z" }).reason,
    ).toBe("not_yet_effective");
    expect(
      r.project(SOURCE, "downloading", { now: "2028-02-01T00:00:00Z" }).reason,
    ).toBe("expired");
    expect(
      r.project(SOURCE, "downloading", { now: "2027-06-01T00:00:00Z" }).allowed,
    ).toBe(true);
  });

  it("supersedes an earlier determination", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "old");
    r.record(
      determination({
        id: "det_synthetic_2",
        supersedesId: DET_ID,
        activityDecisions: [activityDecision("citation_display")],
      }),
      "synthetic-registrar",
      "new",
    );
    expect(r.statusOf(DET_ID)).toBe("SUPERSEDED");
    expect(r.project(SOURCE, "viewing").reason).toBe("activity_not_covered");
    expect(r.project(SOURCE, "citation_display").allowed).toBe(true);
  });

  it("blocks projection after revocation", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "old");
    expect(r.project(SOURCE, "viewing").allowed).toBe(true);
    r.revoke(DET_ID, "synthetic-counsel", "withdrawn");
    expect(r.statusOf(DET_ID)).toBe("REVOKED");
    expect(r.project(SOURCE, "viewing").reason).toBe(
      "no_verified_determination",
    );
  });

  it("fails closed on conflicting determinations", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "first");
    r.record(
      determination({
        id: "det_synthetic_2",
        activityDecisions: [activityDecision("viewing")],
      }),
      "synthetic-registrar",
      "second",
    );
    expect(r.project(SOURCE, "viewing").reason).toBe(
      "conflicting_determinations",
    );
  });

  it("rejects duplicate determination ids and duplicate activities", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "first");
    expect(() =>
      r.record(determination(), "synthetic-registrar", "duplicate"),
    ).toThrow(/duplicate_determination_id/);
    expect(() =>
      r.record(
        determination({
          id: "det_synthetic_3",
          activityDecisions: [
            activityDecision("viewing"),
            activityDecision("viewing"),
          ],
        }),
        "synthetic-registrar",
        "duplicate activity",
      ),
    ).toThrow(/duplicate_activity/);
  });

  it("keeps immutable history and a complete audit trail", () => {
    const r = repo();
    r.record(determination(), "registrar-a", "recorded");
    r.revoke(DET_ID, "counsel-b", "withdrawn");
    const history = r.history();
    expect(history).toHaveLength(1);
    const audit = r.auditTrail();
    expect(audit.map((event) => event.action)).toEqual([
      "COUNSEL_REGISTERED",
      "DETERMINATION_RECORDED",
      "REVOKED",
    ]);
    expect(audit.every((event) => event.actor && event.changedAt)).toBe(true);
    history[0]!.documentIds.push("tampered");
    expect(r.history()[0]?.documentIds).toEqual([]);
  });

  it("does not add records when validation fails", () => {
    const r = repo();
    expect(() =>
      r.record(
        determination({ activityDecisions: [] }),
        "synthetic-registrar",
        "invalid",
      ),
    ).toThrow(/no_activity_decisions/);
    expect(r.history()).toHaveLength(0);
    expect(r.auditTrail()).toHaveLength(1);
  });

  it("rejects an invalid decision document hash", () => {
    const r = repo();
    expect(() =>
      r.record(
        determination({ decisionDocumentHash: "not-a-hash" }),
        "synthetic-registrar",
        "bad hash",
      ),
    ).toThrow(/invalid_decision_document_hash/);
  });

  it("does not project an unverified determination", () => {
    const r = repo();
    r.record(
      determination({ status: "RECEIVED_UNVERIFIED" }),
      "synthetic-registrar",
      "received only",
    );
    expect(r.project(SOURCE, "viewing").reason).toBe(
      "no_verified_determination",
    );
    expect(r.toGate4Decision(DET_ID, "viewing")).toBeNull();
  });

  it("records but does not project activities with no enforcement point", () => {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [
          activityDecision("temporary_local_storage"),
          activityDecision("substantial_reproduction"),
        ],
      }),
      "synthetic-registrar",
      "two extended activities",
    );
    expect(r.project(SOURCE, "temporary_local_storage").allowed).toBe(true);
    expect(r.project(SOURCE, "substantial_reproduction").allowed).toBe(true);
    expect(r.toGate4Decision(DET_ID, "temporary_local_storage")).toBeNull();
    expect(r.toGate4Decision(DET_ID, "substantial_reproduction")).toBeNull();
  });

  it("never authorizes a real source from a synthetic determination", () => {
    const r = repo();
    r.record(determination(), "synthetic-registrar", "synthetic only");
    expect(r.project("sc_elibrary", "viewing").reason).toBe(
      "no_verified_determination",
    );
  });
});

describe("Gate 5 — projection into Gate 4 enforcement", () => {
  function projectedRegistry(): ActivityAuthorizationRegistry {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [
          activityDecision("temporary_processing"),
          activityDecision("persistent_storage"),
          activityDecision("text_extraction"),
          activityDecision("search_indexing"),
        ],
      }),
      "synthetic-registrar",
      "four enforcement activities",
    );
    const registry = new ActivityAuthorizationRegistry();
    for (const activity of [
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
      "search_indexing",
    ] as const) {
      const decision = r.toGate4Decision(DET_ID, activity);
      expect(decision).not.toBeNull();
      registry.record(decision!, "synthetic-registrar", "projected");
    }
    return registry;
  }

  it("allows strict ingestion only after a verified determination is projected", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      {
        artifactId: "counsel-test-1",
        sourceId: SOURCE,
        sourceUrl: "https://example.gov.ph/synthetic-counsel-test",
        mimeType: "text/html",
        retrievedAt: "2026-11-13T00:00:00Z",
        synthetic: false,
        content:
          "<html><body>Republic Act No. 99999. SECTION 1. Synthetic counsel projection test.</body></html>",
        documentType: "REPUBLIC_ACT",
        identityKey: "REPUBLIC_ACT:99999",
        title: "Republic Act No. 99999",
        jurisdiction: "PH",
      },
      {
        pipelineVersion: "gate5.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
        enforceActivityAuthorization: true,
        activityAuthorization: projectedRegistry(),
      },
    );
    expect(result.status, result.reason).toBe("SUCCEEDED");
  });

  it("blocks strict ingestion when no determination has been projected", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      {
        artifactId: "counsel-test-2",
        sourceId: SOURCE,
        sourceUrl: "https://example.gov.ph/synthetic-counsel-test-2",
        mimeType: "text/html",
        retrievedAt: "2026-11-13T00:00:00Z",
        synthetic: false,
        content:
          "<html><body>Republic Act No. 99998. SECTION 1. Synthetic denial test.</body></html>",
        documentType: "REPUBLIC_ACT",
        identityKey: "REPUBLIC_ACT:99998",
        title: "Republic Act No. 99998",
        jurisdiction: "PH",
      },
      {
        pipelineVersion: "gate5.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
        enforceActivityAuthorization: true,
        activityAuthorization: new ActivityAuthorizationRegistry(),
      },
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("activity_not_authorized");
  });

  it("overrides a prior Gate 4 authorization after revocation", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: [activityDecision("downloading")] }),
      "synthetic-registrar",
      "initial",
    );
    const registry = new ActivityAuthorizationRegistry();
    syncToAuthorizationRegistry(r, registry, SOURCE, ["downloading"], {
      actor: "synthetic-registrar",
      reason: "initial projection",
    });
    expect(registry.check(SOURCE, "downloading").allowed).toBe(true);
    r.revoke(DET_ID, "synthetic-counsel", "withdrawn");
    syncToAuthorizationRegistry(r, registry, SOURCE, ["downloading"], {
      actor: "synthetic-registrar",
      reason: "post-revocation sync",
    });
    expect(registry.check(SOURCE, "downloading").allowed).toBe(false);
    expect(registry.check(SOURCE, "downloading").reason).toBe("prohibited");
  });

  it("does not extend authorization to an omitted activity during sync", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: [activityDecision("downloading")] }),
      "synthetic-registrar",
      "download only",
    );
    const registry = new ActivityAuthorizationRegistry();
    syncToAuthorizationRegistry(r, registry, SOURCE, ["downloading"], {
      actor: "synthetic-registrar",
      reason: "sync",
    });
    expect(registry.check(SOURCE, "persistent_storage").allowed).toBe(false);
  });
});

describe("Gate 6 — reindex authorization", () => {
  function corpus() {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      {
        artifactId: "gate6-index-doc",
        sourceId: SOURCE,
        sourceUrl: "synthetic://gate6-index-doc",
        mimeType: "text/html",
        retrievedAt: "2026-11-13T00:00:00Z",
        synthetic: true,
        content:
          "<html><body>SECTION 1. Synthetic indexed provision for reindex authorization.</body></html>",
        documentType: "REPUBLIC_ACT",
        identityKey: "REPUBLIC_ACT:99997",
        title: "Republic Act No. 99997",
      },
      {
        pipelineVersion: "gate6.0.0",
        extractorVersion: "extract.3",
        normalizerVersion: "norm.3",
      },
    );
    expect(result.status, result.reason).toBe("SUCCEEDED");
    return store;
  }

  const indexingActivities = [
    activityDecision("temporary_processing"),
    activityDecision("text_extraction"),
    activityDecision("search_indexing"),
  ];

  /**
   * The Gate 5/6 projection callback adapted to the typed document/activity
   * contract the index build now requires. `authorizeIndexing` deliberately
   * checks all three activities a reindex performs, so this keeps that stricter
   * intent; the builder's own `search_indexing` request is what it is asked.
   */
  function indexAuthority(
    r: CounselDeterminationRepository,
    store: CorpusStore,
  ): DocumentActivityAuthorization {
    return (request) => {
      const sourceId =
        store.state.documents.find((d) => d.id === request.documentId)
          ?.sourceId ?? null;
      const result = authorizeIndexing(
        r,
        { sourceId: sourceId ?? "", documentId: request.documentId },
        {},
        AUDIT,
      );
      return {
        documentId: request.documentId,
        activity: request.activity,
        role: request.role,
        decision: result.allowed ? "AUTHORIZED" : "UNAUTHORIZED",
        sourceId,
        status: null,
        reason: result.reason,
        decisionRef: null,
      };
    };
  }

  it("indexes a synthetic document only with all three required decisions", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: indexingActivities }),
      "synthetic-registrar",
      "index authorization",
    );
    const store = corpus();
    const index = buildSearchIndex(store.state, {
      authorization: indexAuthority(r, store),
    });
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it("returns an empty index when no determination exists", () => {
    const r = repo();
    const store = corpus();
    const index = buildSearchIndex(store.state, {
      authorization: indexAuthority(r, store),
    });
    expect(index.entries).toHaveLength(0);
  });

  it("stops indexing after revocation", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: indexingActivities }),
      "synthetic-registrar",
      "index authorization",
    );
    const store = corpus();
    const build = () =>
      buildSearchIndex(store.state, {
        authorization: indexAuthority(r, store),
      });
    expect(build().entries.length).toBeGreaterThan(0);
    r.revoke(DET_ID, "synthetic-counsel", "withdrawn");
    expect(build().entries).toHaveLength(0);
  });

  it("does not delete stored synthetic content when a determination is revoked", () => {
    const r = repo();
    r.record(
      determination({ activityDecisions: [activityDecision("retention")] }),
      "synthetic-registrar",
      "retention decision",
    );
    const store = corpus();
    r.revoke(DET_ID, "synthetic-counsel", "withdrawn");
    expect(r.project(SOURCE, "retention").allowed).toBe(false);
    expect(store.state.documents).toHaveLength(1);
  });

  it("denies indexing when one required activity is omitted", () => {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [
          activityDecision("text_extraction"),
          activityDecision("search_indexing"),
        ],
      }),
      "synthetic-registrar",
      "missing in-memory decision",
    );
    const store = corpus();
    const index = buildSearchIndex(store.state, {
      authorization: indexAuthority(r, store),
    });
    expect(index.entries).toHaveLength(0);
  });
});

describe("Gate 6 — temporary local storage authorization", () => {
  it("allows the temp-file callback only with an explicit temporary-storage decision", () => {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [activityDecision("temporary_local_storage")],
      }),
      "synthetic-registrar",
      "temp storage",
    );
    const allow = authorizeTemporaryLocalStorage(
      r,
      { sourceId: SOURCE, documentId: "doc-1" },
      {},
      AUDIT,
    );
    expect(allow().allowed).toBe(true);
  });

  it("denies when only in-memory processing is authorized", () => {
    const r = repo();
    r.record(
      determination({
        activityDecisions: [activityDecision("temporary_processing")],
      }),
      "synthetic-registrar",
      "in-memory only",
    );
    const deny = authorizeTemporaryLocalStorage(
      r,
      { sourceId: SOURCE, documentId: "doc-1" },
      {},
      AUDIT,
    );
    expect(deny().allowed).toBe(false);
    expect(deny().reason).toBe("activity_not_covered");
  });

  it("denies the wrong document, expired decision, and revoked decision", () => {
    const r = repo();
    r.record(
      determination({
        documentIds: ["doc-1"],
        effectiveDate: "2026-01-01",
        expiryDate: "2026-12-01",
        activityDecisions: [activityDecision("temporary_local_storage")],
      }),
      "synthetic-registrar",
      "scoped",
    );
    expect(
      authorizeTemporaryLocalStorage(
        r,
        { sourceId: SOURCE, documentId: "doc-2" },
        {},
        AUDIT,
      )().reason,
    ).toBe("document_scope_mismatch");
    expect(
      authorizeTemporaryLocalStorage(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        { now: "2027-01-01T00:00:00Z" },
        AUDIT,
      )().reason,
    ).toBe("expired");
    r.revoke(DET_ID, "synthetic-counsel", "withdrawn");
    expect(
      authorizeTemporaryLocalStorage(
        r,
        { sourceId: SOURCE, documentId: "doc-1" },
        {},
        AUDIT,
      )().allowed,
    ).toBe(false);
  });
});
