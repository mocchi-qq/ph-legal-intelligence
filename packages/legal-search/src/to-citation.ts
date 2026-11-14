// @phli/legal-search — search result to citation passage adapter
// Gate 9. Responsibility: docs/gates/gate-9/

import type { SearchResult } from "./types";

/** The citation package's passage input shape, structurally mirrored here. */
export interface CitationPassageInput {
  citationText: string;
  documentId: string;
  passageId: string;
  location?: string;
  proposition: string;
  relevantDate?: string;
}

/**
 * Adapt a retrieval result into a citation passage. The provision label, where
 * known, becomes both the human-readable citation text and the location; the
 * chunk id is the stable passage id.
 */
export function toCitationInput(
  result: SearchResult,
  proposition: string,
  relevantDate?: string,
): CitationPassageInput {
  const label = result.metadata.provisionLabel;
  return {
    citationText:
      result.citationText ??
      (label ? `${result.documentId} ${label}` : result.documentId),
    documentId: result.documentId,
    passageId: result.chunkId,
    ...(label ? { location: label } : {}),
    proposition,
    relevantDate:
      relevantDate ??
      result.effectiveFrom ??
      result.metadata.asOfDate ??
      undefined,
  };
}
