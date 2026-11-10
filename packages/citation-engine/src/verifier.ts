// @phli/citation-engine — Verifier interface
// Responsibility: see docs/architecture/CITATION_VERIFICATION.md

import type { CitationInput, CitationVerificationResult } from "./types";

/**
 * Interface for citation verification implementations.
 *
 * Implementations must verify all four layers (Identity, Location, Support,
 * Temporal Validity) and return a complete CitationVerificationResult.
 */
export interface CitationVerifier {
  /**
   * Verify a citation against the legal corpus.
   *
   * @param citation - The citation to verify, including the proposition it supports
   * @returns Complete verification result with per-layer details
   */
  verify(citation: CitationInput): Promise<CitationVerificationResult>;
}
