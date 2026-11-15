// @phli/legal-ingestion — authority status lookup for the citation verifier
// Gate 10. See docs/architecture/CITATION_VERIFICATION.md
//
// Adapts the D1 authority ledger and the pure projection to the read-only
// `AuthorityStatusLookup` shape the citation engine consumes. Authorization is
// never defaulted: a caller that has not decided whether processing is
// authorized cannot ask for a status, because an unchecked answer is not an
// authorized one.

import type { D1AuthorityStore } from "./authority-d1-store";
import { projectAuthorityState } from "./authority-projection";

export interface AuthorityLookupOptions {
  authorization: "AUTHORIZED" | "UNAUTHORIZED" | "NOT_CHECKED";
}

export function createAuthorityStatusLookup(
  store: D1AuthorityStore,
  options: AuthorityLookupOptions,
) {
  return async (request: {
    documentId: string;
    provisionId?: string | null;
    asOf: string;
  }) => {
    const snapshot = await store.loadStateFor(request.documentId);
    const mapping = request.provisionId
      ? snapshot.provisionMappings.find(
          (m) => m.provisionVersionId === request.provisionId,
        )
      : undefined;
    const projection = projectAuthorityState({
      snapshot,
      documentId: request.documentId,
      provisionIdentityId: mapping ? mapping.provisionIdentityId : undefined,
      asOf: request.asOf,
      authorization: options.authorization,
    });
    return {
      outcome: projection.outcome,
      state: projection.state,
      explanation: projection.explanation,
      abstained: projection.abstained,
      missing: projection.missing,
      versionId: projection.versionId,
    };
  };
}
