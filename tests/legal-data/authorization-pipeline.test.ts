import { describe, expect, it } from "vitest";
import {
  ActivityAuthorizationRegistry,
  buildAcquisitionRecord,
  CorpusStore,
  type DecisionInput,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";
import { fixtureRegistry } from "../helpers/fixture-authorization.ts";

const SOURCE = "sc_elibrary";
const URL = "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/99999";

const OPTS = {
  pipelineVersion: "gate4.0.0",
  extractorVersion: "extract.3",
  normalizerVersion: "norm.3",
  authorizedSourceIds: [SOURCE],
  enforceActivityAuthorization: true as const,
};

const COUNSEL = {
  evidenceRef: "counsel/2026-11-13/sc-activity.pdf",
  counselDecisionRef: "counsel-decision-2026-11-13-01",
  reviewer: "Philippine counsel",
  decisionDate: "2026-11-13",
};

function counsel(activity: DecisionInput["activity"]): DecisionInput {
  return {
    sourceId: SOURCE,
    activity,
    status: "AUTHORIZED",
    basis: "COUNSEL_DETERMINATION",
    ...COUNSEL,
  };
}

function registryWith(activities: DecisionInput["activity"][]) {
  const registry = new ActivityAuthorizationRegistry();
  for (const activity of activities)
    registry.record(counsel(activity), "registrar", "counsel determination");
  return registry;
}

function artifact(id: string) {
  return {
    artifactId: id,
    sourceId: SOURCE,
    sourceUrl: URL,
    mimeType: "text/html",
    retrievedAt: "2026-11-13T00:00:00Z",
    synthetic: false,
    content:
      "<html><body>Republic Act No. 99999. SECTION 1. A synthetic test provision for ingestion enforcement.</body></html>",
    documentType: "REPUBLIC_ACT",
    identityKey: `REPUBLIC_ACT:${id}`,
    title: `Republic Act No. ${id}`,
    officialNumber: `Republic Act No. ${id}`,
    issuingBody: "Congress of the Philippines",
    jurisdiction: "PH",
    legalStatus: "UNKNOWN",
    authorityLevel: "official_primary",
  };
}

const INGEST_ACTIVITIES = [
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
] as const;

describe("Gate 4 — pipeline activity enforcement", () => {
  it("refuses non-synthetic ingestion without strict mode or explicit legacy opt-in", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact("99990"), {
      pipelineVersion: "gate4.0.0",
      extractorVersion: "extract.3",
      normalizerVersion: "norm.3",
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("activity_authorization_required");
    expect(store.state.documents).toHaveLength(0);
  });

  it("fails closed when strict enforcement has no registry", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact("99991"), OPTS);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("activity_authorization_registry_missing");
    expect(store.state.documents).toHaveLength(0);
  });

  it("fails closed when one required activity is not authorized", () => {
    const store = CorpusStore.memory();
    const registry = registryWith([
      "temporary_processing",
      "persistent_storage",
      "text_extraction",
    ]);
    const result = ingestArtifact(store, artifact("99992"), {
      ...OPTS,
      activityAuthorization: registry,
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("search_indexing");
    expect(store.state.documents).toHaveLength(0);
  });

  it("does not accept owner risk acceptance in strict counsel mode", () => {
    const store = CorpusStore.memory();
    const registry = new ActivityAuthorizationRegistry();
    for (const activity of INGEST_ACTIVITIES) {
      registry.record(
        {
          sourceId: SOURCE,
          activity,
          status: "AUTHORIZED",
          basis: "OWNER_RISK_ACCEPTANCE",
          evidenceRef: "docs/gates/gate-2/01A_OWNER_AUTHORIZATION.md",
          reviewer: "project owner",
          decisionDate: "2026-11-10",
        },
        "owner",
        "bounded pilot",
      );
    }
    const result = ingestArtifact(store, artifact("99993"), {
      ...OPTS,
      activityAuthorization: registry,
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("basis_not_accepted");
  });

  it("ingests when every required activity has a counsel decision", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact("99994"), {
      ...OPTS,
      activityAuthorization: registryWith([...INGEST_ACTIVITIES]),
    });
    expect(result.status, result.reason).toBe("SUCCEEDED");
    expect(store.state.documents).toHaveLength(1);
    expect(store.state.runs.at(-1)?.authorizationBasis).toBe(
      "source_authorization",
    );
    expect(store.state.runs.at(-1)?.authorizationDecisionRef).toBeTruthy();
    expect(store.state.runs.at(-1)?.authorizationDecisionRefs).toHaveLength(4);
    expect(store.state.runs.at(-1)?.authorizationBasisDetail).toBe(
      "COUNSEL_DETERMINATION",
    );
  });

  it("uses the activity registry as the authority in strict mode", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact("99998"), {
      ...OPTS,
      authorizedSourceIds: [],
      activityAuthorization: registryWith([...INGEST_ACTIVITIES]),
    });
    expect(result.status, result.reason).toBe("SUCCEEDED");
  });

  it("blocks a retry after revocation without mutating the corpus", () => {
    const store = CorpusStore.memory();
    const registry = registryWith([...INGEST_ACTIVITIES]);
    const first = ingestArtifact(store, artifact("99995"), {
      ...OPTS,
      activityAuthorization: registry,
    });
    expect(first.status).toBe("SUCCEEDED");
    expect(store.state.documents).toHaveLength(1);

    registry.record(
      {
        sourceId: SOURCE,
        activity: "persistent_storage",
        status: "PROHIBITED",
        basis: "COUNSEL_DETERMINATION",
        evidenceRef: COUNSEL.evidenceRef,
        reviewer: COUNSEL.reviewer,
        decisionDate: COUNSEL.decisionDate,
      },
      "counsel",
      "storage consent withdrawn",
    );

    const retry = ingestArtifact(store, artifact("99996"), {
      ...OPTS,
      activityAuthorization: registry,
    });
    expect(retry.status).toBe("FAILED");
    expect(retry.reason).toContain("persistent_storage");
    expect(store.state.documents).toHaveLength(1);
    expect(store.state.runs.at(-1)?.status).toBe("FAILED");
  });

  it("rejects PDF input before any OCR path can run", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(
      store,
      { ...artifact("99989"), mimeType: "application/pdf" },
      {
        ...OPTS,
        activityAuthorization: registryWith([...INGEST_ACTIVITIES]),
      },
    );
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("unsupported_mime:application/pdf");
  });

  it("gates a synthetic fixture on fixture authorization, not the legal-source gate", () => {
    // Gate 19 removed the implicit exemption: a fixture is checked like anything
    // else, but against SYNTHETIC_FIXTURE decisions rather than counsel, and the
    // coarse legal-source list is not what authorizes it.
    const fixture = {
      ...artifact("90000"),
      synthetic: true,
      sourceUrl: "synthetic://gate4-fixture",
      identityKey: "REPUBLIC_ACT:90000",
    };
    const options = {
      pipelineVersion: "gate4.0.0",
      extractorVersion: "extract.3",
      normalizerVersion: "norm.3",
      enforceActivityAuthorization: true as const,
    };

    const unregistered = CorpusStore.memory();
    const refused = ingestArtifact(unregistered, fixture, options);
    expect(refused.status).toBe("FAILED");
    expect(refused.reason).toBe("activity_authorization_registry_missing");
    expect(unregistered.state.documents).toHaveLength(0);

    // The fixture's source is deliberately absent from `authorizedSourceIds`;
    // only the fixture decisions authorize it.
    const authorized = CorpusStore.memory();
    const accepted = ingestArtifact(authorized, fixture, {
      ...options,
      activityAuthorization: fixtureRegistry(fixture.sourceId),
    });
    expect(accepted.status, accepted.reason).toBe("SUCCEEDED");
    expect(authorized.state.documents).toHaveLength(1);
    expect(authorized.state.runs.at(-1)?.authorizationBasisDetail).toBe(
      "SYNTHETIC_FIXTURE",
    );
  });

  it("keeps the legacy owner-authorized pilot path working when strict mode is off", () => {
    const store = CorpusStore.memory();
    const result = ingestArtifact(store, artifact("99997"), {
      pipelineVersion: "gate4.0.0",
      extractorVersion: "extract.3",
      normalizerVersion: "norm.3",
      allowLegacySourceGate: true,
      ownerAuthorization: {
        reference: "docs/gates/gate-2/01A_OWNER_AUTHORIZATION.md",
        scope: "four Republic Act pages, internal evaluation only",
        authorizedBy: "project owner",
        date: "2026-11-10",
      },
    });
    expect(result.status, result.reason).toBe("SUCCEEDED");
  });
});

describe("Gate 4 — acquisition activity enforcement", () => {
  const base = {
    artifactId: "acq-1",
    sourceId: SOURCE,
    sourceUrl: URL,
    officialTitle: "Republic Act No. 99990",
    documentType: "REPUBLIC_ACT",
    retrievedAt: "2026-11-13T00:00:00Z",
    originalFilename: "ra99990.html",
    mimeType: "text/html",
    bytes: new TextEncoder().encode("<html>test</html>"),
    acquisitionMethod: "manual_review",
    authorization: {
      sourceId: SOURCE,
      state: "AUTHORIZED" as const,
      evidenceRef: COUNSEL.evidenceRef,
      reviewer: COUNSEL.reviewer,
      reviewedAt: COUNSEL.decisionDate,
    },
    enforceActivityAuthorization: true as const,
  };

  it("refuses acquisition without strict mode or explicit legacy opt-in", () => {
    const result = buildAcquisitionRecord({
      ...base,
      enforceActivityAuthorization: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toBe("activity_authorization_required");
  });

  it("fails closed without an activity registry", () => {
    const result = buildAcquisitionRecord(base);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toBe("activity_authorization_registry_missing");
  });

  it("fails closed when downloading is prohibited", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      {
        sourceId: SOURCE,
        activity: "downloading",
        status: "PROHIBITED",
        basis: "COUNSEL_DETERMINATION",
        evidenceRef: COUNSEL.evidenceRef,
        reviewer: COUNSEL.reviewer,
        decisionDate: COUNSEL.decisionDate,
      },
      "counsel",
      "download prohibited",
    );
    const result = buildAcquisitionRecord({
      ...base,
      activityAuthorization: registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("downloading");
  });

  it("builds a record when downloading is counsel-authorized", () => {
    const result = buildAcquisitionRecord({
      ...base,
      activityAuthorization: registryWith(["downloading"]),
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.record.authorizationRecordRef).toMatch(/^auth_/);
  });

  it("uses the downloading decision instead of legacy source state in strict mode", () => {
    const result = buildAcquisitionRecord({
      ...base,
      authorization: {
        ...base.authorization,
        state: "UNKNOWN" as const,
        evidenceRef: null,
      },
      activityAuthorization: registryWith(["downloading"]),
    });
    expect(result.ok).toBe(true);
  });
});
