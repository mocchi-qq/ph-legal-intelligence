import { describe, expect, it } from "vitest";
import {
  ActivityAuthorizationRegistry,
  assessCorpusReadiness,
  type DecisionInput,
} from "../../packages/legal-ingestion/src/index";

const AGENCY = {
  evidenceRef: "counsel/2026-11-13/sc-activity.pdf",
  counselDecisionRef: "counsel-decision-2026-11-13-01",
  reviewer: "Philippine counsel",
  decisionDate: "2026-11-13",
};

function counsel(
  activity: DecisionInput["activity"],
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId: "sc_elibrary",
    activity,
    status: "AUTHORIZED",
    basis: "COUNSEL_DETERMINATION",
    ...AGENCY,
    ...overrides,
  };
}

function owner(
  activity: DecisionInput["activity"],
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId: "sc_elibrary",
    activity,
    status: "AUTHORIZED",
    basis: "OWNER_RISK_ACCEPTANCE",
    evidenceRef: "docs/gates/gate-2/01A_OWNER_AUTHORIZATION.md",
    reviewer: "project owner",
    decisionDate: "2026-11-10",
    ...overrides,
  };
}

describe("Gate 4 — activity-specific authorization", () => {
  it("does not infer acquisition from viewing", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("viewing"), "registrar", "initial determination");
    expect(registry.check("sc_elibrary", "viewing").allowed).toBe(true);
    expect(registry.check("sc_elibrary", "downloading").allowed).toBe(false);
    expect(registry.check("sc_elibrary", "persistent_storage").allowed).toBe(
      false,
    );
  });

  it("does not infer storage or redistribution from downloading", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("downloading"), "registrar", "download only");
    expect(registry.check("sc_elibrary", "downloading").allowed).toBe(true);
    expect(registry.check("sc_elibrary", "persistent_storage").allowed).toBe(
      false,
    );
    expect(registry.check("sc_elibrary", "redistribution").allowed).toBe(false);
  });

  it("does not infer AI processing from text extraction", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("text_extraction"), "registrar", "extraction only");
    expect(registry.check("sc_elibrary", "text_extraction").allowed).toBe(true);
    expect(registry.check("sc_elibrary", "ai_assisted_analysis").allowed).toBe(
      false,
    );
  });

  it("checks embedding and citation display independently", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("search_indexing"), "registrar", "index only");
    expect(registry.check("sc_elibrary", "embedding_generation").allowed).toBe(
      false,
    );
    expect(registry.check("sc_elibrary", "citation_display").allowed).toBe(
      false,
    );
  });

  it("fails closed for UNKNOWN, RESTRICTED and PROHIBITED", () => {
    const registry = new ActivityAuthorizationRegistry();
    expect(registry.check("sc_elibrary", "viewing").reason).toBe(
      "no_decision_recorded",
    );

    registry.record(
      {
        ...counsel("redistribution", { status: "RESTRICTED" }),
        counselDecisionRef: null,
      },
      "counsel",
      "restricted pending conditions",
    );
    expect(registry.check("sc_elibrary", "redistribution").allowed).toBe(false);
    expect(registry.check("sc_elibrary", "redistribution").reason).toBe(
      "restricted",
    );

    registry.record(
      {
        ...counsel("commercial_use", { status: "PROHIBITED" }),
        counselDecisionRef: null,
      },
      "counsel",
      "commercial reuse prohibited",
    );
    expect(registry.check("sc_elibrary", "commercial_use").allowed).toBe(false);
    expect(registry.check("sc_elibrary", "commercial_use").reason).toBe(
      "prohibited",
    );
  });

  it("requires every condition to be satisfied", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      counsel("quotation", {
        status: "AUTHORIZED_WITH_CONDITIONS",
        conditions: ["attribution", "no-more-than-300-chars"],
      }),
      "counsel",
      "conditional quotation",
    );
    expect(registry.check("sc_elibrary", "quotation").allowed).toBe(false);
    expect(registry.check("sc_elibrary", "quotation").reason).toContain(
      "conditions_unmet",
    );
    expect(
      registry.check("sc_elibrary", "quotation", {
        satisfiedConditions: ["attribution"],
      }).allowed,
    ).toBe(false);
    expect(
      registry.check("sc_elibrary", "quotation", {
        satisfiedConditions: ["attribution", "no-more-than-300-chars"],
      }).allowed,
    ).toBe(true);
  });

  it("blocks an expired decision", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      counsel("downloading", { expiresAt: "2026-01-01T00:00:00Z" }),
      "counsel",
      "time-limited",
    );
    expect(
      registry.check("sc_elibrary", "downloading", {
        now: "2026-11-13T00:00:00Z",
      }).reason,
    ).toBe("authorization_expired");
  });

  it("blocks future operations after revocation", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("search_indexing"), "counsel", "initial");
    expect(registry.check("sc_elibrary", "search_indexing").allowed).toBe(true);
    registry.record(
      {
        ...counsel("search_indexing", { status: "PROHIBITED" }),
        counselDecisionRef: null,
      },
      "counsel",
      "consent withdrawn",
    );
    expect(registry.check("sc_elibrary", "search_indexing").allowed).toBe(
      false,
    );
    expect(registry.history("sc_elibrary", "search_indexing")).toHaveLength(2);
  });

  it("rejects AUTHORIZED without evidence, reviewer or date", () => {
    const registry = new ActivityAuthorizationRegistry();
    expect(() =>
      registry.record(
        counsel("viewing", { evidenceRef: null }),
        "registrar",
        "missing evidence",
      ),
    ).toThrow(/authorization_evidence_missing/);
    expect(() =>
      registry.record(
        counsel("viewing", { reviewer: null }),
        "registrar",
        "missing reviewer",
      ),
    ).toThrow(/authorization_reviewer_missing/);
  });

  it("rejects counsel AUTHORIZED without a counsel decision reference", () => {
    const registry = new ActivityAuthorizationRegistry();
    expect(() =>
      registry.record(
        counsel("viewing", { counselDecisionRef: null }),
        "registrar",
        "missing counsel ref",
      ),
    ).toThrow(/counsel_decision_reference_missing/);
  });

  it("rejects conditional authorization without conditions", () => {
    const registry = new ActivityAuthorizationRegistry();
    expect(() =>
      registry.record(
        counsel("quotation", { status: "AUTHORIZED_WITH_CONDITIONS" }),
        "registrar",
        "conditional without conditions",
      ),
    ).toThrow(/conditional_authorization_without_conditions/);
  });

  it("keeps decisions and audit events append-only and traceable", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("viewing"), "alice", "first", "registrar");
    registry.record(
      {
        ...counsel("viewing", { status: "PROHIBITED" }),
        counselDecisionRef: null,
      },
      "bob",
      "revoked",
      "counsel",
    );
    const history = registry.history("sc_elibrary", "viewing");
    expect(history).toHaveLength(2);
    const audit = registry.auditTrail("sc_elibrary");
    expect(audit).toHaveLength(2);
    expect(audit[1]?.previousStatus).toBe("AUTHORIZED");
    expect(audit[1]?.newStatus).toBe("PROHIBITED");
    expect(audit[1]?.actor).toBe("bob");
    expect(audit[1]?.reason).toBe("revoked");
    expect(audit[1]?.changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    history[0]!.conditions.push("tampered");
    expect(registry.history("sc_elibrary", "viewing")[0]?.conditions).toEqual(
      [],
    );
  });

  it("uses per-activity decision ids and records a supplied audit timestamp", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      counsel("viewing"),
      "alice",
      "first",
      "registrar",
      "2026-11-13T01:00:00Z",
    );
    registry.record(
      {
        ...counsel("viewing", { status: "PROHIBITED" }),
        counselDecisionRef: null,
      },
      "bob",
      "second",
      "counsel",
      "2026-11-13T02:00:00Z",
    );
    const history = registry.history("sc_elibrary", "viewing");
    expect(history[0]?.id).toBe("auth_sc_elibrary_viewing_1");
    expect(history[1]?.id).toBe("auth_sc_elibrary_viewing_2");
    expect(registry.auditTrail()[1]?.changedAt).toBe("2026-11-13T02:00:00Z");
  });

  it("accepts owner risk acceptance only when the caller permits that basis", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(owner("temporary_processing"), "owner", "bounded pilot");
    expect(registry.check("sc_elibrary", "temporary_processing").allowed).toBe(
      true,
    );
    expect(
      registry.check("sc_elibrary", "temporary_processing", {
        allowedBases: ["COUNSEL_DETERMINATION"],
      }).reason,
    ).toBe("basis_not_accepted:OWNER_RISK_ACCEPTANCE");
  });

  it("maps readiness blockers in fail-closed order", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(counsel("temporary_processing"), "counsel", "ok");
    const denied = [registry.check("sc_elibrary", "persistent_storage")];
    expect(
      assessCorpusReadiness({
        authorizationChecks: denied,
        authenticity: { independentCorroboration: "VERIFIED" },
        legalDates: { requiredFields: [], verifiedFields: [] },
      }).status,
    ).toBe("BLOCKED_AUTHORIZATION");

    const allowed = [registry.check("sc_elibrary", "temporary_processing")];
    expect(
      assessCorpusReadiness({
        authorizationChecks: allowed,
        authenticity: { independentCorroboration: "SECOND_SOURCE_UNVERIFIED" },
        legalDates: { requiredFields: [], verifiedFields: [] },
      }).status,
    ).toBe("BLOCKED_AUTHENTICITY");

    expect(
      assessCorpusReadiness({
        authorizationChecks: allowed,
        authenticity: { independentCorroboration: "VERIFIED" },
        legalDates: {
          requiredFields: ["effectivity_date"],
          verifiedFields: [],
        },
      }).status,
    ).toBe("BLOCKED_LEGAL_DATES");

    expect(
      assessCorpusReadiness({
        authorizationChecks: allowed,
        authenticity: { independentCorroboration: "VERIFIED" },
        legalDates: {
          requiredFields: ["effectivity_date"],
          verifiedFields: ["effectivity_date"],
        },
      }).status,
    ).toBe("READY_FOR_CONTROLLED_INGESTION");

    expect(
      assessCorpusReadiness({
        authorizationChecks: allowed,
        authenticity: { independentCorroboration: "NOT_ASSESSED" },
        legalDates: { requiredFields: [], verifiedFields: [] },
      }).status,
    ).toBe("BLOCKED_SOURCE_EVIDENCE");
  });

  it("marks a fully satisfied conditional authorization as conditionally ready", () => {
    const registry = new ActivityAuthorizationRegistry();
    registry.record(
      counsel("temporary_processing", {
        status: "AUTHORIZED_WITH_CONDITIONS",
        conditions: ["attribution"],
      }),
      "counsel",
      "conditional processing",
    );
    const check = registry.check("sc_elibrary", "temporary_processing", {
      satisfiedConditions: ["attribution"],
    });
    expect(check.allowed).toBe(true);
    expect(
      assessCorpusReadiness({
        authorizationChecks: [check],
        authenticity: { independentCorroboration: "VERIFIED" },
        legalDates: { requiredFields: [], verifiedFields: [] },
      }).status,
    ).toBe("CONDITIONALLY_READY");
  });
});
