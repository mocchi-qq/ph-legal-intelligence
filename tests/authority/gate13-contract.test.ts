// Gate 13 — document/activity authorization contract.
// Every fixture is fictional. No Philippine law is represented or implied.
import { describe, expect, it } from "vitest";
import {
  type Activity,
  ActivityAuthorizationRegistry,
  createRegistryAuthorization,
  type DecisionInput,
  type DocumentRole,
  isCanonicalActivity,
  memoizeDocumentActivity,
} from "../../packages/legal-ingestion/src/index";

const DOCUMENT_ID = "SYNTH-DOC-1";
const SOURCE_ID = "SYNTH-SRC-1";
const OTHER_DOCUMENT_ID = "SYNTH-DOC-2";

const FIXTURE = {
  evidenceRef: "SYNTH-EVIDENCE-1",
  reviewer: "SYNTH-REVIEWER",
  decisionDate: "2026-01-01",
};

function fixture(
  activity: DecisionInput["activity"],
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    sourceId: SOURCE_ID,
    activity,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    ...FIXTURE,
    ...overrides,
  };
}

function registryWith(
  ...inputs: DecisionInput[]
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const input of inputs)
    registry.record(input, "SYNTH-AUTHOR", "synthetic fixture");
  return registry;
}

function resolverOver(
  registry: ActivityAuthorizationRegistry,
  overrides: {
    now?: string;
    satisfiedConditions?: readonly string[];
    allowedBases?: readonly DecisionInput["basis"][];
    sourceOfDocument?: (documentId: string) => string | null;
  } = {},
) {
  return createRegistryAuthorization({
    registry,
    sourceOfDocument:
      overrides.sourceOfDocument ??
      ((documentId) =>
        documentId === DOCUMENT_ID || documentId === OTHER_DOCUMENT_ID
          ? SOURCE_ID
          : null),
    now: overrides.now,
    satisfiedConditions: overrides.satisfiedConditions,
    allowedBases: overrides.allowedBases,
  });
}

describe("Gate 13 — document/activity authorization contract", () => {
  describe("recorded decisions", () => {
    it("AUTHORIZES a document whose source is authorized for the activity", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry);

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });

      expect(decision).toMatchObject({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        decision: "AUTHORIZED",
        sourceId: SOURCE_ID,
        status: "AUTHORIZED",
        reason: "authorized",
      });
      expect(decision.decisionRef).toBe(
        registry.latest(SOURCE_ID, "viewing")?.id,
      );
      expect(decision.decisionRef).toBeTruthy();
    });

    it("AUTHORIZES a conditional decision once every condition is satisfied", () => {
      const registry = registryWith(
        fixture("citation_display", {
          status: "AUTHORIZED_WITH_CONDITIONS",
          conditions: ["attribution"],
        }),
      );
      const authorize = resolverOver(registry, {
        satisfiedConditions: ["attribution"],
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "citation_display",
        role: "EVIDENCE",
      });

      expect(decision.decision).toBe("AUTHORIZED");
      expect(decision.status).toBe("AUTHORIZED_WITH_CONDITIONS");
      expect(decision.reason).toBe("authorized_with_conditions_satisfied");
    });

    it("refuses a conditional decision with an unmet condition", () => {
      const registry = registryWith(
        fixture("citation_display", {
          status: "AUTHORIZED_WITH_CONDITIONS",
          conditions: ["attribution", "no-redistribution"],
        }),
      );
      const authorize = resolverOver(registry, {
        satisfiedConditions: ["attribution"],
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
      });

      expect(decision.decision).toBe("UNAUTHORIZED");
      expect(decision.status).toBe("AUTHORIZED_WITH_CONDITIONS");
      expect(decision.reason.startsWith("conditions_unmet")).toBe(true);
      expect(decision.reason).toContain("no-redistribution");
      expect(decision.reason).not.toContain("attribution");
    });

    it("refuses a prohibited decision", () => {
      const registry = registryWith(
        fixture("downloading", {
          status: "PROHIBITED",
          basis: "NONE",
          evidenceRef: null,
          reviewer: null,
          decisionDate: null,
          notes: "SYNTH-prohibited for the fixture",
        }),
      );
      const authorize = resolverOver(registry);

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "downloading",
        role: "SOURCE",
      });

      expect(decision.decision).toBe("UNAUTHORIZED");
      expect(decision.status).toBe("PROHIBITED");
      expect(decision.reason).toBe("prohibited");
      expect(decision.decisionRef).toBeTruthy();
    });

    it("refuses a restricted decision", () => {
      const registry = registryWith(
        fixture("redistribution", { status: "RESTRICTED" }),
      );
      const authorize = resolverOver(registry);

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "redistribution",
        role: "SOURCE",
      });

      expect(decision.decision).toBe("UNAUTHORIZED");
      expect(decision.status).toBe("RESTRICTED");
      expect(decision.reason).toBe("restricted");
    });

    it("refuses an expired decision when now is past its expiry", () => {
      const registry = registryWith(
        fixture("viewing", { expiresAt: "2026-01-01T00:00:00Z" }),
      );
      const authorize = resolverOver(registry, {
        now: "2026-06-01T00:00:00Z",
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });

      expect(decision.decision).toBe("UNAUTHORIZED");
      expect(decision.status).toBe("AUTHORIZED");
      expect(decision.reason).toBe("authorization_expired");
    });

    it("refuses a decision whose basis the caller does not accept", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry, {
        allowedBases: ["COUNSEL_DETERMINATION"],
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });

      expect(decision.decision).toBe("UNAUTHORIZED");
      expect(decision.reason).toBe("basis_not_accepted:SYNTHETIC_FIXTURE");
    });

    it("does not leak an authorized activity into a different activity", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry);

      const viewing = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });
      const indexing = authorize({
        documentId: DOCUMENT_ID,
        activity: "search_indexing",
        role: "TARGET",
      });

      expect(viewing.decision).toBe("AUTHORIZED");
      // The registry has no record for (SOURCE_ID, search_indexing), so the
      // adapter reports "nobody decided" rather than borrowing the viewing
      // authorization. It is NOT an authorization for indexing.
      expect(indexing.decision).toBe("NOT_CHECKED");
      expect(indexing.reason).toBe("no_decision_recorded");
      expect(indexing.status).toBeNull();
      expect(indexing.decisionRef).toBeNull();
    });
  });

  describe("clock discipline", () => {
    const EXPIRY = "2026-06-01T00:00:00Z";
    const BEFORE_EXPIRY = "2026-01-15T00:00:00Z";
    const AFTER_EXPIRY = "2026-12-31T00:00:00Z";

    it("evaluates expiry at the as-of instant of the question", () => {
      const registry = registryWith(fixture("viewing", { expiresAt: EXPIRY }));
      const authorize = resolverOver(registry);

      const askedWhileLive = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: BEFORE_EXPIRY,
      });
      const askedAfterExpiry = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: AFTER_EXPIRY,
      });

      expect(askedWhileLive.decision).toBe("AUTHORIZED");
      expect(askedWhileLive.reason).toBe("authorized");
      expect(askedAfterExpiry.decision).toBe("UNAUTHORIZED");
      expect(askedAfterExpiry.reason).toBe("authorization_expired");
    });

    it("lets asOf beat options.now in both directions", () => {
      const registry = registryWith(fixture("viewing", { expiresAt: EXPIRY }));
      const askedBefore = resolverOver(registry, { now: AFTER_EXPIRY })({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: BEFORE_EXPIRY,
      });
      const askedAfter = resolverOver(registry, { now: BEFORE_EXPIRY })({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: AFTER_EXPIRY,
      });

      expect(askedBefore.decision).toBe("AUTHORIZED");
      expect(askedBefore.reason).toBe("authorized");
      expect(askedAfter.decision).toBe("UNAUTHORIZED");
      expect(askedAfter.reason).toBe("authorization_expired");
    });

    it("uses the registry default clock when neither asOf nor now is given", () => {
      const registry = registryWith(
        fixture("viewing", { expiresAt: "2999-01-01T00:00:00Z" }),
        fixture("citation_display", { expiresAt: "2020-01-01T00:00:00Z" }),
      );
      const authorize = resolverOver(registry);

      const unexpired = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });
      const expired = authorize({
        documentId: DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
      });

      expect(unexpired.decision).toBe("AUTHORIZED");
      expect(expired.decision).toBe("UNAUTHORIZED");
      expect(expired.reason).toBe("authorization_expired");
    });

    it("fails closed when asOf is present but not a parseable instant", () => {
      // The fixture is unexpired, so a wall-clock evaluation would have
      // AUTHORIZED this call. An unusable as-of must not become an authorization.
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry);

      for (const asOf of ["not-a-date", ""]) {
        const decision = authorize({
          documentId: DOCUMENT_ID,
          activity: "viewing",
          role: "TARGET",
          asOf,
        });

        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("invalid_as_of");
        expect(decision.status).toBeNull();
        expect(decision.decisionRef).toBeNull();
      }
    });
  });

  describe("undecided", () => {
    it("reports NOT_CHECKED when no decision was ever recorded", () => {
      const registry = registryWith();
      const authorize = resolverOver(registry);

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "citation_display",
        role: "TARGET",
      });

      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("no_decision_recorded");
      expect(decision.sourceId).toBe(SOURCE_ID);
      expect(decision.status).toBeNull();
      expect(decision.decisionRef).toBeNull();
    });
  });

  describe("fails closed", () => {
    it("rejects an empty, blank or non-string documentId", () => {
      const registry = registryWith(fixture("viewing"));
      let lookups = 0;
      const authorize = resolverOver(registry, {
        sourceOfDocument: (documentId) => {
          lookups += 1;
          return documentId === DOCUMENT_ID ? SOURCE_ID : null;
        },
      });

      for (const documentId of ["", "   ", 123, null, undefined]) {
        const decision = authorize({
          documentId: documentId as unknown as string,
          activity: "viewing",
          role: "TARGET",
        });
        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("unknown_document");
        expect(decision.sourceId).toBeNull();
        expect(decision.status).toBeNull();
        expect(decision.decisionRef).toBeNull();
      }
      // An unusable document never reaches the source resolver.
      expect(lookups).toBe(0);
    });

    it("rejects an activity outside the Gate 4 vocabulary", () => {
      const registry = registryWith(fixture("viewing"));
      let lookups = 0;
      const authorize = resolverOver(registry, {
        sourceOfDocument: () => {
          lookups += 1;
          return SOURCE_ID;
        },
      });

      expect(isCanonicalActivity("teleportation")).toBe(false);
      for (const activity of ["teleportation", "", null, 42]) {
        const decision = authorize({
          documentId: DOCUMENT_ID,
          activity: activity as unknown as Activity,
          role: "TARGET",
        });
        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("unknown_activity");
        expect(decision.sourceId).toBeNull();
        expect(decision.status).toBeNull();
        expect(decision.decisionRef).toBeNull();
      }
      expect(lookups).toBe(0);
    });

    it("rejects a role outside the three literals", () => {
      const registry = registryWith(fixture("viewing"));
      let lookups = 0;
      const authorize = resolverOver(registry, {
        sourceOfDocument: () => {
          lookups += 1;
          return SOURCE_ID;
        },
      });

      for (const role of ["PROCESSOR", "target", "", 7]) {
        const decision = authorize({
          documentId: DOCUMENT_ID,
          activity: "viewing",
          role: role as unknown as DocumentRole,
        });
        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("unknown_role");
        expect(decision.sourceId).toBeNull();
      }
      expect(lookups).toBe(0);
    });

    it("reports NOT_CHECKED when the document has no known source", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry, {
        sourceOfDocument: () => null,
      });
      const blank = resolverOver(registry, { sourceOfDocument: () => "" });
      const request = {
        documentId: DOCUMENT_ID,
        activity: "viewing" as const,
        role: "TARGET" as const,
      };

      for (const decision of [authorize(request), blank(request)]) {
        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("no_source_for_document");
        expect(decision.sourceId).toBeNull();
        expect(decision.status).toBeNull();
        expect(decision.decisionRef).toBeNull();
      }
    });

    it("does not propagate a throwing source lookup", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry, {
        sourceOfDocument: () => {
          throw new Error("SYNTH source lookup unavailable");
        },
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });

      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("source_lookup_failed");
      expect(decision.sourceId).toBeNull();
      expect(decision.decisionRef).toBeNull();
    });

    it("does not propagate a throwing registry", () => {
      const authorize = createRegistryAuthorization({
        registry: {
          check() {
            throw new Error("SYNTH registry unavailable");
          },
        } as unknown as ActivityAuthorizationRegistry,
        sourceOfDocument: () => SOURCE_ID,
      });

      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });

      expect(decision.decision).toBe("NOT_CHECKED");
      expect(decision.reason).toBe("registry_error");
      expect(decision.sourceId).toBeNull();
      expect(decision.status).toBeNull();
      expect(decision.decisionRef).toBeNull();
    });

    it("does not authorize a malformed request at runtime", () => {
      const registry = registryWith(fixture("viewing"));
      const authorize = resolverOver(registry);

      for (const request of [null, undefined, 42, {}]) {
        const decision = authorize(request as never);
        expect(decision.decision).toBe("NOT_CHECKED");
        expect(decision.reason).toBe("unknown_document");
      }
    });
  });

  describe("memoisation", () => {
    function counting() {
      const registry = registryWith(
        fixture("viewing"),
        fixture("citation_display"),
      );
      let lookups = 0;
      const authorize = memoizeDocumentActivity(
        createRegistryAuthorization({
          registry,
          sourceOfDocument: (documentId) => {
            lookups += 1;
            return documentId === DOCUMENT_ID ||
              documentId === OTHER_DOCUMENT_ID
              ? SOURCE_ID
              : null;
          },
        }),
      );
      return { authorize, lookups: () => lookups };
    }

    it("resolves once per (documentId, activity) across roles and repeats", () => {
      const { authorize, lookups } = counting();

      const first = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });
      const second = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "SOURCE",
      });
      const third = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "EVIDENCE",
      });

      expect(lookups()).toBe(1);
      expect(second).toBe(first);
      expect(third).toBe(first);
      // Authorization belongs to document + activity; role is who asked first.
      expect(second.role).toBe("TARGET");
      expect(third.decision).toBe("AUTHORIZED");
    });

    it("keeps separate entries per activity and per document", () => {
      const { authorize, lookups } = counting();
      const request = (documentId: string, activity: Activity) =>
        authorize({ documentId, activity, role: "TARGET" });

      request(DOCUMENT_ID, "viewing");
      expect(lookups()).toBe(1);
      request(DOCUMENT_ID, "citation_display");
      expect(lookups()).toBe(2);
      request(OTHER_DOCUMENT_ID, "viewing");
      expect(lookups()).toBe(3);

      // Repeats of every distinct pair resolve nothing new.
      request(DOCUMENT_ID, "viewing");
      request(DOCUMENT_ID, "citation_display");
      request(OTHER_DOCUMENT_ID, "viewing");
      expect(lookups()).toBe(3);
    });

    it("caches a denial rather than retrying it", () => {
      const { authorize, lookups } = counting();

      const first = authorize({
        documentId: "SYNTH-DOC-UNKNOWN",
        activity: "viewing",
        role: "TARGET",
      });
      const second = authorize({
        documentId: "SYNTH-DOC-UNKNOWN",
        activity: "viewing",
        role: "SOURCE",
      });

      expect(first.reason).toBe("no_source_for_document");
      expect(lookups()).toBe(1);
      expect(second).toBe(first);
      expect(second.decision).toBe("NOT_CHECKED");
    });

    it("does not let a caller rewrite a cached decision", () => {
      const { authorize } = counting();
      const decision = authorize({
        documentId: DOCUMENT_ID,
        activity: "search_indexing",
        role: "TARGET",
      });

      expect(decision.decision).toBe("NOT_CHECKED");
      expect(() => {
        (decision as { decision: string }).decision = "AUTHORIZED";
      }).toThrow();
      expect(decision.decision).toBe("NOT_CHECKED");
    });

    // One `viewing` authorization that expires at EXPIRY, resolved through a
    // memoised adapter whose source lookups are counted.
    const EXPIRY = "2026-06-01T00:00:00Z";
    const BEFORE_EXPIRY = "2026-01-15T00:00:00Z";
    const AFTER_EXPIRY = "2026-12-31T00:00:00Z";

    function countingToExpiry() {
      const registry = registryWith(fixture("viewing", { expiresAt: EXPIRY }));
      let lookups = 0;
      const authorize = memoizeDocumentActivity(
        createRegistryAuthorization({
          registry,
          sourceOfDocument: (documentId) => {
            lookups += 1;
            return documentId === DOCUMENT_ID ? SOURCE_ID : null;
          },
        }),
      );
      return { authorize, lookups: () => lookups };
    }

    it("keys the memo on the as-of instant, so an expiry verdict cannot answer another instant's question", () => {
      const { authorize, lookups } = countingToExpiry();

      const before = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: BEFORE_EXPIRY,
      });
      const after = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
        asOf: AFTER_EXPIRY,
      });

      expect(before.decision).toBe("AUTHORIZED");
      expect(after.decision).toBe("UNAUTHORIZED");
      expect(after.reason).toBe("authorization_expired");
      // Two instants are two questions: neither answer may be reused.
      expect(after).not.toBe(before);
      expect(lookups()).toBe(2);
    });

    it("still resolves the same pair at the same as-of instant once", () => {
      const { authorize, lookups } = countingToExpiry();
      const request = {
        documentId: DOCUMENT_ID,
        activity: "viewing" as const,
        role: "TARGET" as const,
        asOf: BEFORE_EXPIRY,
      };

      const first = authorize(request);
      const second = authorize({ ...request, role: "SOURCE" });

      expect(lookups()).toBe(1);
      expect(second).toBe(first);
      expect(second.decision).toBe("AUTHORIZED");
      expect(second.role).toBe("TARGET");
    });

    it("keeps requests that omit asOf in one bucket", () => {
      const { authorize, lookups } = countingToExpiry();

      const first = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "TARGET",
      });
      const second = authorize({
        documentId: DOCUMENT_ID,
        activity: "viewing",
        role: "SOURCE",
      });

      expect(lookups()).toBe(1);
      expect(second).toBe(first);
      expect(second.decision).toBe(first.decision);
    });
  });
});
