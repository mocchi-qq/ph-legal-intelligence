import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const status = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/gates/gate-6/gate-6-status.json"),
    "utf8",
  ),
) as {
  verdict: string;
  classification: {
    implementation: Record<string, string>;
    counsel_determinations: { count: number; status: string };
    authorization: Record<string, number>;
    corpus_readiness: Record<string, number | string>;
    taxonomy: {
      canonical_activities: number;
      gate4_enforced_activities: number;
      reconciled: boolean;
    };
    security: Record<string, boolean>;
  };
  limitations: string[];
};

describe("Gate 6 — final status honesty", () => {
  it("keeps counsel determinations at zero and all authorization cells UNKNOWN", () => {
    expect(status.classification.counsel_determinations.count).toBe(0);
    expect(status.classification.counsel_determinations.status).toBe(
      "NOT_RECEIVED",
    );
    expect(status.classification.authorization.authorized).toBe(0);
    expect(status.classification.authorization.unknown).toBe(350);
    expect(status.classification.authorization.cells).toBe(350);
  });

  it("does not claim D1 adapter or D1 runtime validation", () => {
    expect(status.classification.implementation.d1_adapter).toBe(
      "NOT_IMPLEMENTED",
    );
    expect(status.classification.implementation.d1_runtime_validation).toBe(
      "NOT_TESTED",
    );
    expect(status.verdict).toBe("ACCEPTED_WITH_LIMITATIONS");
  });

  it("confirms the enforcement closures and canonical taxonomy", () => {
    expect(
      status.classification.implementation.temporary_local_storage_gate,
    ).toBe("IMPLEMENTED");
    expect(status.classification.implementation.reindex_gate).toBe(
      "IMPLEMENTED",
    );
    expect(status.classification.taxonomy.reconciled).toBe(true);
    expect(status.classification.taxonomy.canonical_activities).toBe(16);
    expect(status.classification.taxonomy.gate4_enforced_activities).toBe(14);
    expect(
      status.classification.security.temporary_local_storage_before_write,
    ).toBe(true);
    expect(status.classification.security.reindex_requires_authorizer).toBe(
      true,
    );
  });

  it("keeps the corpus blocked and adds no documents", () => {
    expect(status.classification.corpus_readiness.new_documents_added).toBe(0);
    expect(
      status.classification.corpus_readiness.ready_for_controlled_ingestion,
    ).toBe(0);
    expect(status.classification.corpus_readiness.blocked_authorization).toBe(
      4,
    );
    expect(
      status.classification.security.stale_authorization_after_revocation,
    ).toBe(false);
    expect(
      status.classification.security.automatic_deletion_on_revocation,
    ).toBe(false);
  });
});
