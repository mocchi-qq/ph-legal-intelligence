// @phli/legal-ingestion — authority status lookup for the citation verifier
// Gate 10. See docs/architecture/CITATION_VERIFICATION.md
//
// Adapts the D1 authority ledger and the pure projection to the read-only
// `AuthorityStatusLookup` shape the citation engine consumes. Authorization is
// never defaulted: a caller that has not decided whether processing is
// authorized cannot ask for a status, because an unchecked answer is not an
// authorized one.
//
// Gate 18 adds `contextDocumentIds`: the rows of named documents are loaded
// alongside the one asked about, so a citation whose evidence points at its
// source instrument projects against a complete snapshot. Reading scope only —
// authorization stays per (document, activity).

import type { D1AuthorityStore } from "./authority-d1-store";
import {
  type AuthorizationAssertion,
  projectAuthorityState,
} from "./authority-projection";
import type { Activity } from "./authorization";
import type { DocumentActivityAuthorization } from "./document-activity-authorization";

export interface AuthorityLookupOptions {
  /**
   * Gate 13: the one activity this lookup answers for. A verifier asking for a
   * status is asking whether the cited instrument may be presented for that
   * activity, so the activity travels with every request the lookup forwards.
   */
  activity: Activity;
  /**
   * Caller-asserted decision for `activity`. It names the activity it covers, so
   * a lookup whose activity differs from the assertion's is refused by the
   * projection rather than applied. Exactly one of this and
   * `documentActivityAuthorization` must be supplied; an unrecognised decision is
   * treated as `NOT_CHECKED` by the projection, so it never authorizes processing.
   */
  authorizationAssertion?: AuthorizationAssertion;
  /** Registry-backed decision, resolved once per (document, activity). */
  documentActivityAuthorization?: DocumentActivityAuthorization;
  /**
   * Gate 18: documents whose ledger rows must be in scope in addition to the
   * document being asked about.
   *
   * A citation display projects a statement about a source instrument onto a
   * target, and the assertion's evidence names the source version. If only the
   * target is loaded, the source document is absent from the snapshot and the
   * projection reports `MISSING_DOCUMENT`. Naming the context documents here
   * keeps that merge inside the lookup instead of leaving every caller to
   * assemble a snapshot by hand. This widens reading scope only: authorization
   * is still resolved per (document, activity) and is never inherited from the
   * context.
   *
   * An id that has no rows contributes nothing, exactly as it does for the
   * requested document. That is not silent: the projection then reports
   * `EVIDENCE_DOCUMENT_NOT_LOADED` if an evidence record named one of its
   * versions, so a typo in this list surfaces as an abstention rather than as a
   * skipped check.
   */
  contextDocumentIds?: string[];
}

export function createAuthorityStatusLookup(
  store: D1AuthorityStore,
  options: AuthorityLookupOptions,
) {
  // Fail at construction, not per call: a lookup with no authorization input can
  // only ever answer NOT_CHECKED, and that is a configuration error the caller
  // should see once rather than as a silent abstention on every verification.
  if (
    options.authorizationAssertion === undefined &&
    options.documentActivityAuthorization === undefined
  ) {
    throw new Error("authorization_required");
  }

  return async (request: {
    documentId: string;
    provisionId?: string | null;
    asOf: string;
  }) => {
    const snapshot =
      options.contextDocumentIds && options.contextDocumentIds.length > 0
        ? await store.loadStateForMany([
            request.documentId,
            ...options.contextDocumentIds,
          ])
        : await store.loadStateFor(request.documentId);
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
      activity: options.activity,
      authorizationAssertion: options.authorizationAssertion,
      documentActivityAuthorization: options.documentActivityAuthorization,
    });
    return {
      outcome: projection.outcome,
      state: projection.state,
      explanation: projection.explanation,
      abstained: projection.abstained,
      missing: projection.missing,
      versionId: projection.versionId,
      authorizationSource: projection.authorizationSource,
    };
  };
}
