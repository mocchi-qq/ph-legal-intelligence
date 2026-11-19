// Gate 19 — a synthetic artifact does not skip the activity gate.
//
// Before this gate `pipeline.ts` skipped all four activity checks for an artifact
// flagged `synthetic: true`, guarded only by a `synthetic://` URL the caller also
// supplied. Artifact data could therefore switch the gate off, and the audit
// carried an empty decision list that read like a decision.
//
// Now a synthetic artifact runs the same checks, and `synthetic` narrows the
// accepted basis to SYNTHETIC_FIXTURE: a fixture cannot borrow a counsel
// determination, and a real artifact cannot opt into the fixture basis.
//
// Synthetic only. No real document, no counsel record, no network.
import { describe, expect, it } from "vitest";
import type {
  ArtifactInput,
  AuthorizationAuditEvent,
  AuthorizationAuditInput,
  DecisionInput,
  IngestOptions,
  IngestOutcome,
} from "../../packages/legal-ingestion/src/index";
import {
  ActivityAuthorizationRegistry,
  AuthorizationAuditService,
  CorpusStore,
  ingestArtifact,
} from "../../packages/legal-ingestion/src/index";
import {
  FIXTURE_INGESTION_ACTIVITIES,
  fixtureDecision,
  fixtureRegistry,
} from "../helpers/fixture-authorization.ts";

const SOURCE = "synthetic_fixture";
const FIXED_NOW = "2026-11-17T00:00:00Z";

const OPTIONS: IngestOptions = {
  pipelineVersion: "gate19.0.0",
  extractorVersion: "extract.19",
  normalizerVersion: "norm.19",
  now: () => FIXED_NOW,
};

function artifact(overrides: Partial<ArtifactInput> = {}): ArtifactInput {
  return {
    artifactId: "gate19-artifact-1",
    sourceId: SOURCE,
    sourceUrl: "synthetic://gate19/RA-99001",
    mimeType: "text/plain",
    retrievedAt: FIXED_NOW,
    synthetic: true,
    documentType: "REPUBLIC_ACT",
    identityKey: "SYNTHETIC:GATE19:REPUBLIC_ACT:99001",
    title: "Synthetic Republic Act No. 99001",
    issuingBody: "Synthetic Congress",
    jurisdiction: "PH",
    approvalDate: "2019-01-01",
    effectivityDate: "2019-02-01",
    legalStatus: "IN_FORCE",
    content: [
      "Synthetic Republic Act No. 99001",
      "",
      "Section 1. This Act establishes a synthetic registration duty.",
      "",
      "Section 2. A covered entity must register with the synthetic authority.",
    ].join("\n"),
    ...overrides,
  };
}

function ingest(
  options: Partial<IngestOptions> = {},
  overrides: Partial<ArtifactInput> = {},
): { store: CorpusStore; result: IngestOutcome } {
  const store = CorpusStore.memory();
  const result = ingestArtifact(store, artifact(overrides), {
    ...OPTIONS,
    ...options,
  });
  return { store, result };
}

/** A registry holding `activities` fixture decisions for `sourceId`. */
function partialRegistry(
  activities: readonly DecisionInput["activity"][],
  sourceId = SOURCE,
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const activity of activities)
    registry.record(
      fixtureDecision(activity, sourceId),
      "gate19-test",
      "partial fixture authorization",
      "test",
      FIXED_NOW,
    );
  return registry;
}

describe("Gate 19 — the synthetic flag does not skip authorization", () => {
  it("refuses a synthetic artifact when no registry is supplied", () => {
    const { store, result } = ingest();

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("activity_authorization_registry_missing");
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.runs).toHaveLength(1);
    // Nothing in the run claims an authorization that was never consulted.
    expect(store.state.runs[0]?.authorizationDecisionRefs).toBeNull();
    expect(store.state.runs[0]?.authorizationBasisDetail).toBeNull();
    expect(store.state.runs[0]?.authorizationBasis).toBeUndefined();
  });

  it("refuses when one of the four activities has no decision", () => {
    const { store, result } = ingest({
      activityAuthorization: partialRegistry([
        "temporary_processing",
        "persistent_storage",
        "text_extraction",
      ]),
    });

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe(
      "activity_not_authorized:search_indexing:no_decision_recorded",
    );
    expect(store.state.documents).toHaveLength(0);
  });

  it("does not let a fixture borrow a counsel determination", () => {
    const registry = new ActivityAuthorizationRegistry();
    for (const activity of FIXTURE_INGESTION_ACTIVITIES)
      registry.record(
        {
          sourceId: SOURCE,
          activity,
          status: "AUTHORIZED",
          basis: "COUNSEL_DETERMINATION",
          evidenceRef:
            "synthetic://gate19/counsel-that-cannot-authorize-fixtures",
          counselDecisionRef: "SYNTH-COUNSEL-DECISION-1",
          reviewer: "Synthetic Counsel",
          decisionDate: "2026-11-17",
        },
        "gate19-test",
        "counsel basis, wrong artifact class",
        "test",
        FIXED_NOW,
      );

    const { store, result } = ingest({ activityAuthorization: registry });

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe(
      "activity_not_authorized:temporary_processing:basis_not_accepted:COUNSEL_DETERMINATION",
    );
    expect(store.state.documents).toHaveLength(0);
  });

  it("does not let a real artifact opt into the fixture basis", () => {
    // Same fixture decisions, but the artifact is not a fixture. A caller
    // asking for counsel-only must not be satisfied by SYNTHETIC_FIXTURE.
    const { store, result } = ingest(
      {
        activityAuthorization: fixtureRegistry(SOURCE),
        enforceActivityAuthorization: true,
      },
      { synthetic: false, sourceUrl: "https://synthetic.invalid/RA-99001" },
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe(
      "activity_not_authorized:temporary_processing:basis_not_accepted:SYNTHETIC_FIXTURE",
    );
    expect(store.state.documents).toHaveLength(0);
  });

  // Change C: refuses the fixture basis for a real artifact even when strict mode is off
  it("refuses the fixture basis for a real artifact even when strict mode is off", () => {
    const { store, result } = ingest(
      {
        activityAuthorization: fixtureRegistry(SOURCE),
        acceptedAuthorizationBases: [
          "SYNTHETIC_FIXTURE",
          "COUNSEL_DETERMINATION",
        ],
      },
      { synthetic: false, sourceUrl: "https://synthetic.invalid/RA-99001" },
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("synthetic_fixture_basis_not_allowed");
    expect(store.state.documents).toHaveLength(0);
  });

  // Change D: ignores acceptedAuthorizationBases for a fixture
  it("ignores acceptedAuthorizationBases for a fixture", () => {
    const { store, result } = ingest({
      activityAuthorization: fixtureRegistry(SOURCE),
      acceptedAuthorizationBases: ["COUNSEL_DETERMINATION"],
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(store.state.runs.at(-1)?.authorizationBasisDetail).toBe(
      "SYNTHETIC_FIXTURE",
    );
  });

  it("ingests a fixture once all four activities are authorized, and records them", () => {
    const { store, result } = ingest({
      activityAuthorization: fixtureRegistry(SOURCE),
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.reason).toBeUndefined();
    expect(store.state.documents).toHaveLength(1);

    const run = store.state.runs.at(-1);
    expect(run?.status).toBe("SUCCEEDED");
    expect(run?.authorizationBasis).toBe("synthetic_fixture");
    expect(run?.authorizationBasisDetail).toBe("SYNTHETIC_FIXTURE");
    expect(run?.authorizationDecisionRefs).toHaveLength(4);
    expect(run?.authorizationDecisionRef).toBe(
      run?.authorizationDecisionRefs?.[0],
    );
  });

  it("audits four grants on success and a denial on the missing activity", () => {
    const events: AuthorizationAuditEvent[] = [];
    const audit = new AuthorizationAuditService({
      append: (event) => {
        events.push(event);
      },
    });

    const succeeded = ingest({
      activityAuthorization: fixtureRegistry(SOURCE),
      authorizationAudit: audit,
    });
    expect(succeeded.result.status).toBe("SUCCEEDED");
    expect(events.map((event) => event.eventType)).toEqual([
      "AUTHORIZATION_GRANTED",
      "AUTHORIZATION_GRANTED",
      "AUTHORIZATION_GRANTED",
      "AUTHORIZATION_GRANTED",
    ]);
    expect(events.map((event) => event.outcome)).toEqual([
      "GRANTED",
      "GRANTED",
      "GRANTED",
      "GRANTED",
    ]);
    expect(events.map((event) => event.activity)).toEqual([
      ...FIXTURE_INGESTION_ACTIVITIES,
    ]);

    events.length = 0;
    const refused = ingest({
      activityAuthorization: partialRegistry([
        "temporary_processing",
        "persistent_storage",
      ]),
      authorizationAudit: audit,
    });
    expect(refused.result.status).toBe("FAILED");
    const denied = events.filter((event) => event.outcome === "DENIED");
    expect(denied).toHaveLength(1);
    expect(denied[0]?.activity).toBe("text_extraction");
    expect(denied[0]?.reasonCode).toBe("no_decision_recorded");
  });

  it("still refuses a synthetic flag without a synthetic locator", () => {
    const { result } = ingest(
      { activityAuthorization: fixtureRegistry(SOURCE) },
      { sourceUrl: "https://example.test/RA-99001" },
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("synthetic_flag_without_synthetic_locator");
  });

  // Change B: refuses a synthetic locator on a real artifact
  it("refuses a synthetic locator on a real artifact", () => {
    const { store, result } = ingest(
      { activityAuthorization: fixtureRegistry(SOURCE) },
      { synthetic: false },
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("synthetic_locator_without_synthetic_flag");
    expect(store.state.documents).toHaveLength(0);
  });

  // Change A: does not treat a synthetic URL as a fixture when the flag is false
  // The locator alone is not an authorization and not a fixture claim.
  it("does not treat a synthetic URL as a fixture when the flag is false", () => {
    const { store, result } = ingest(
      {
        activityAuthorization: fixtureRegistry(SOURCE),
        allowLegacySourceGate: false,
      },
      { synthetic: false, sourceUrl: "https://synthetic.invalid/RA-99001" },
    );

    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("activity_authorization_required");
    expect(store.state.documents).toHaveLength(0);
  });

  it("accepts a caller-supplied audit only when it succeeds", () => {
    const events: AuthorizationAuditInput[] = [];
    const audit = new AuthorizationAuditService({
      append: (event) => {
        events.push(event);
      },
    });

    const { result } = ingest({
      activityAuthorization: fixtureRegistry(SOURCE),
      authorizationAudit: audit,
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(events.every((event) => event.sourceId === SOURCE)).toBe(true);
  });
});
