// @phli/legal-ingestion — temporal authority queries over a ledger
//
// A thin, storage-free entry point for "what did the law say on this date?"
// questions. The decision logic itself lives in authority-projection.ts so
// every adapter answers as-of queries the same way.

import type { AuthorityProjection, EffectAssertion } from "@phli/legal-schema";
import type { AuthorityLedger, AuthoritySnapshot } from "./authority-ledger";
import { projectAuthorityState } from "./authority-projection";

export interface TemporalQueryRequest {
  documentId: string;
  provisionIdentityId?: string | null;
  asOf: string;
  authorization: "AUTHORIZED" | "UNAUTHORIZED" | "NOT_CHECKED";
  satisfiedConditions?: string[];
}

export function queryAuthorityAsOf(
  ledger: AuthorityLedger,
  request: TemporalQueryRequest,
): AuthorityProjection {
  return projectAuthorityState({ ...request, snapshot: ledger.snapshot() });
}

export function listApplicableAssertions(
  snapshot: AuthoritySnapshot,
  documentId: string,
  asOf: string,
  provisionIdentityId?: string | null,
): EffectAssertion[] {
  return snapshot.assertions
    .filter((a) => a.targetDocumentId === documentId)
    .filter(
      (a) =>
        provisionIdentityId === undefined ||
        a.targetProvisionIdentityId === (provisionIdentityId ?? null),
    )
    .filter(
      (a) => a.claimedEffectiveDate !== null && a.claimedEffectiveDate <= asOf,
    )
    .sort(
      (a, b) =>
        (a.claimedEffectiveDate ?? "").localeCompare(
          b.claimedEffectiveDate ?? "",
        ) || a.id.localeCompare(b.id),
    );
}
