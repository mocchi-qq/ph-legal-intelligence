// Gate 7 — repository contract parity: the in-memory adapter and the D1 adapter
// must produce identical authorization projections for identical state.
import { describe, expect, it } from "vitest";
import {
  type CounselActivity,
  type CounselDetermination,
  CounselDeterminationRepository,
  type CounselRegistry,
  D1CounselRegistry,
  InMemoryCounselRegistry,
  projectFromState,
} from "../../packages/legal-ingestion/src/index";
import { SqliteD1Database } from "../helpers/d1-sqlite";

const SOURCE = "synthetic_parity_source";
const NOW = "2026-11-14T12:00:00Z";

function professional() {
  return {
    id: "c_parity",
    name: "Synthetic Parity Counsel",
    firm: null,
    jurisdiction: "PH",
    capacity: "Legal counsel",
    verificationStatus: "VERIFIED" as const,
    verificationEvidenceRef: "synthetic://parity/verification",
    verifiedBy: "synthetic-registrar",
    verifiedAt: "2026-11-14",
  };
}

function base(
  overrides: Partial<CounselDetermination> = {},
): CounselDetermination {
  return {
    id: "det_parity",
    sourceId: SOURCE,
    documentIds: [],
    counselId: "c_parity",
    dateReceived: "2026-11-14",
    dateIssued: "2026-11-14",
    effectiveDate: "2026-11-01",
    expiryDate: "2027-11-01",
    status: "VERIFIED_FOR_RECORDING",
    scope: "Synthetic parity determination",
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
        evidenceRef: "synthetic://parity/evidence",
      },
    ],
    evidenceRefs: ["synthetic://parity/evidence"],
    decisionDocumentRef: "synthetic://parity/decision",
    decisionDocumentHash: "c".repeat(64),
    recordedBy: "synthetic-registrar",
    supersedesId: null,
    notes: null,
    ...overrides,
  };
}

async function registries(): Promise<{
  memory: CounselRegistry;
  d1: CounselRegistry;
  close: () => void;
}> {
  const repo = new CounselDeterminationRepository();
  const memory = new InMemoryCounselRegistry(repo);
  const database = new SqliteD1Database();
  database.applyMigrations();
  const d1 = new D1CounselRegistry(database);
  for (const registry of [memory, d1])
    await registry.registerProfessional(
      professional(),
      "synthetic-registrar",
      "setup",
    );
  return { memory, d1, close: () => database.close() };
}

async function projectionOf(
  registry: CounselRegistry,
  activity: CounselActivity,
  options: { documentId?: string | null; satisfiedConditions?: string[] } = {},
) {
  const state = await registry.loadState(SOURCE);
  return projectFromState(state, SOURCE, activity, { now: NOW, ...options });
}

describe("Gate 7 — in-memory / D1 projection parity", () => {
  it("denies identically with no determination", async () => {
    const { memory, d1, close } = await registries();
    const a = await projectionOf(memory, "downloading");
    const b = await projectionOf(d1, "downloading");
    expect(a).toEqual(b);
    expect(a.reason).toBe("no_verified_determination");
    close();
  });

  it("denies identically when the activity is not covered", async () => {
    const { memory, d1, close } = await registries();
    for (const registry of [memory, d1])
      await registry.recordDetermination(
        base(),
        "synthetic-registrar",
        "record",
      );
    const a = await projectionOf(memory, "quotation");
    const b = await projectionOf(d1, "quotation");
    expect(a).toEqual(b);
    expect(a.reason).toBe("activity_not_covered");
    close();
  });

  it("allows identically for a valid decision", async () => {
    const { memory, d1, close } = await registries();
    for (const registry of [memory, d1])
      await registry.recordDetermination(
        base(),
        "synthetic-registrar",
        "record",
      );
    const a = await projectionOf(memory, "downloading");
    const b = await projectionOf(d1, "downloading");
    expect(a).toEqual(b);
    expect(a.allowed).toBe(true);
    close();
  });

  it("denies identically on document scope", async () => {
    const { memory, d1, close } = await registries();
    const det = base({ documentIds: ["doc_a"] });
    for (const registry of [memory, d1])
      await registry.recordDetermination(det, "synthetic-registrar", "record");
    for (const options of [
      {},
      { documentId: "doc_b" },
      { documentId: "doc_a" },
    ]) {
      const a = await projectionOf(memory, "downloading", options);
      const b = await projectionOf(d1, "downloading", options);
      expect(a).toEqual(b);
    }
    expect(
      (await projectionOf(d1, "downloading", { documentId: "doc_a" })).allowed,
    ).toBe(true);
    close();
  });

  it("denies identically on expiry and effective date", async () => {
    const { memory, d1, close } = await registries();
    for (const registry of [memory, d1]) {
      await registry.recordDetermination(
        base({ id: "expired", expiryDate: "2026-11-13" }),
        "synthetic-registrar",
        "expired",
      );
    }
    const a = await projectionOf(memory, "downloading");
    const b = await projectionOf(d1, "downloading");
    expect(a).toEqual(b);
    expect(a.reason).toBe("expired");
    close();
  });

  it("denies identically on an unmet condition", async () => {
    const { memory, d1, close } = await registries();
    const det = base({
      activityDecisions: [
        {
          activity: "downloading",
          status: "APPROVED_WITH_CONDITIONS",
          scope: null,
          conditions: ["counsel_review_logged"],
          limitations: [],
          permittedUsers: [],
          effectiveDate: null,
          expiryDate: null,
          evidenceRef: null,
        },
      ],
    });
    for (const registry of [memory, d1])
      await registry.recordDetermination(
        det,
        "synthetic-registrar",
        "conditional",
      );
    const unmetMemory = await projectionOf(memory, "downloading");
    const unmetD1 = await projectionOf(d1, "downloading");
    expect(unmetMemory).toEqual(unmetD1);
    expect(unmetMemory.reason).toBe("conditions_unmet:counsel_review_logged");
    const metMemory = await projectionOf(memory, "downloading", {
      satisfiedConditions: ["counsel_review_logged"],
    });
    const metD1 = await projectionOf(d1, "downloading", {
      satisfiedConditions: ["counsel_review_logged"],
    });
    expect(metMemory).toEqual(metD1);
    expect(metD1.allowed).toBe(true);
    close();
  });

  it("denies identically on revocation and supersession", async () => {
    const { memory, d1, close } = await registries();
    for (const registry of [memory, d1]) {
      await registry.recordDetermination(
        base({ id: "old" }),
        "synthetic-registrar",
        "old",
      );
      await registry.recordDetermination(
        base({ id: "new", scope: "replacement" }),
        "synthetic-registrar",
        "new",
      );
    }
    for (const registry of [memory, d1])
      await registry.supersede(
        "old",
        "new",
        "synthetic-registrar",
        "superseded",
      );
    const a = await projectionOf(memory, "downloading");
    const b = await projectionOf(d1, "downloading");
    expect(a).toEqual(b);
    expect(a.determinationId).toBe("new");

    for (const registry of [memory, d1])
      await registry.revoke("new", "synthetic-registrar", "revoked");
    const revokedMemory = await projectionOf(memory, "downloading");
    const revokedD1 = await projectionOf(d1, "downloading");
    expect(revokedMemory).toEqual(revokedD1);
    expect(revokedMemory.allowed).toBe(false);
    close();
  });

  it("denies identically when two determinations conflict", async () => {
    const { memory, d1, close } = await registries();
    for (const registry of [memory, d1]) {
      await registry.recordDetermination(
        base({ id: "a" }),
        "synthetic-registrar",
        "a",
      );
      await registry.recordDetermination(
        base({ id: "b" }),
        "synthetic-registrar",
        "b",
      );
    }
    const a = await projectionOf(memory, "downloading");
    const b = await projectionOf(d1, "downloading");
    expect(a).toEqual(b);
    expect(a.reason).toBe("conflicting_determinations");
    close();
  });
});
