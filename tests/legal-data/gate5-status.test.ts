import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const status = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/gates/gate-5/gate-5-status.json"),
    "utf8",
  ),
) as {
  verdict: string;
  classification: {
    counsel_determinations: { count: number; status: string };
    authorization: Record<string, number | string>;
    corpus_readiness: Record<string, number | string>;
    implementation: { durable_registry_adapter: string };
  };
  limitations: string[];
};

describe("Gate 5 — final status honesty", () => {
  it("records zero real counsel determinations", () => {
    expect(status.classification.counsel_determinations.count).toBe(0);
    expect(status.classification.counsel_determinations.status).toBe(
      "NOT_RECEIVED",
    );
  });

  it("keeps every authorization cell UNKNOWN", () => {
    expect(status.classification.authorization.authorized).toBe(0);
    expect(status.classification.authorization.authorized_with_conditions).toBe(
      0,
    );
    expect(status.classification.authorization.restricted).toBe(0);
    expect(status.classification.authorization.prohibited).toBe(0);
    expect(status.classification.authorization.unknown).toBe(350);
    expect(status.classification.authorization.cells).toBe(350);
  });

  it("keeps the corpus blocked and adds no documents", () => {
    expect(status.classification.corpus_readiness.new_documents_added).toBe(0);
    expect(
      status.classification.corpus_readiness.ready_for_controlled_ingestion,
    ).toBe(0);
    expect(status.classification.corpus_readiness.blocked_authorization).toBe(
      4,
    );
    expect(status.classification.corpus_readiness.status).toBe(
      "BLOCKED_AUTHORIZATION",
    );
  });

  it("does not claim durable persistence or unconditional acceptance", () => {
    expect(status.classification.implementation.durable_registry_adapter).toBe(
      "NOT_IMPLEMENTED",
    );
    expect(status.verdict).toBe("ACCEPTED_WITH_LIMITATIONS");
    expect(status.limitations.length).toBeGreaterThan(0);
  });
});
