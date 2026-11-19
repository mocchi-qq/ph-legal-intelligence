// Gate 19 — fixture authorization for synthetic ingestion tests.
//
// Gate 19 removed the implicit exemption: a `synthetic: true` artifact now runs
// the same four activity checks as any other, with `SYNTHETIC_FIXTURE` as the
// only accepted basis. This helper records exactly those four decisions so a
// test can authorize a fixture without inventing counsel.
//
// It is a test helper, not a production path. A SYNTHETIC_FIXTURE decision says
// "this content is a fixture that may be processed for testing"; it says nothing
// about any real instrument, and it can never authorize a non-synthetic artifact.
import type { DecisionInput } from "../../packages/legal-ingestion/src/index";
import { ActivityAuthorizationRegistry } from "../../packages/legal-ingestion/src/index";

/** Every activity the text ingestion path performs. */
export const FIXTURE_INGESTION_ACTIVITIES = [
  "temporary_processing",
  "persistent_storage",
  "text_extraction",
  "search_indexing",
] as const;

const FIXED_AT = "2026-11-17T00:00:00Z";

export function fixtureDecision(
  activity: DecisionInput["activity"],
  sourceId: string,
): DecisionInput {
  return {
    sourceId,
    activity,
    status: "AUTHORIZED",
    basis: "SYNTHETIC_FIXTURE",
    evidenceRef: `synthetic://fixture-authorization/${sourceId}/${activity}`,
    evidenceLocation: `synthetic://fixture-authorization/${sourceId}`,
    reviewer: "synthetic-fixture-reviewer",
    decisionDate: FIXED_AT.slice(0, 10),
  };
}

/**
 * A registry holding the four ingestion decisions for each named source.
 * Naming a source without a decision is how a test asks for a refusal.
 */
export function fixtureRegistry(
  ...sourceIds: string[]
): ActivityAuthorizationRegistry {
  const registry = new ActivityAuthorizationRegistry();
  for (const sourceId of sourceIds) {
    for (const activity of FIXTURE_INGESTION_ACTIVITIES) {
      registry.record(
        fixtureDecision(activity, sourceId),
        "gate19-fixture-helper",
        "synthetic fixture authorization",
        "test",
        FIXED_AT,
      );
    }
  }
  return registry;
}
