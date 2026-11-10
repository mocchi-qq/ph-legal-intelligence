// @phli/citation-engine — four-layer citation verifier
// Gate 1. See docs/gates/gate-1/07_CITATION_VERIFICATION_REPORT.md
//
// Implemented: identity, location, temporal, and a deterministic lexical
// support proxy. The support proxy is NOT semantic entailment — it checks
// whether the cited passage actually contains the operative terms of the
// proposition. It is conservative: unsupported prose fails rather than passing
// on topical overlap. This limitation is reported, not hidden.

import type {
  CitationInput,
  CitationState,
  CitationVerificationResult,
  LayerResults,
  VerificationLayer,
} from "./types";
import { VerificationMethod, VerificationStatus } from "./types";

export interface CorpusDocumentView {
  id: string;
  title: string;
  citationText?: string | null;
  docketNumber?: string | null;
  identityKey?: string | null;
  legalStatus: string;
  effectivityDate?: string | null;
  repealDate?: string | null;
  promulgationDate?: string | null;
}

export interface CorpusProvisionView {
  id: string;
  documentId: string;
  /** Version this provision belongs to; required for point-in-time lookup. */
  versionId: string;
  label: string;
  text: string;
  legalStatus: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface CorpusChunkView {
  id: string;
  documentId: string;
  versionId?: string | null;
  provisionId?: string | null;
  content: string;
}

export interface CorpusVersionView {
  id: string;
  documentId: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isCurrent: boolean;
}

/** A read-only view the verifier needs; keeps the engine independent of storage. */
export interface CitationCorpusView {
  documents: CorpusDocumentView[];
  versions: CorpusVersionView[];
  provisions: CorpusProvisionView[];
  chunks: CorpusChunkView[];
}

export interface CitationVerifier {
  verify(citation: CitationInput): Promise<CitationVerificationResult>;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "that",
  "this",
  "with",
  "as",
  "at",
  "from",
  "it",
  "its",
  "under",
  "which",
  "shall",
  "may",
  "not",
  "any",
  "all",
  "such",
  "who",
]);

function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9§¶.]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Fraction of the proposition's operative terms present in the passage. */
export function supportCoverage(passage: string, proposition: string): number {
  const wanted = terms(proposition);
  if (wanted.size === 0) return 0;
  const available = terms(passage);
  let covered = 0;
  for (const term of wanted) if (available.has(term)) covered++;
  return covered / wanted.size;
}

/** Conservative threshold: a passage that merely mentions the topic will fail. */
export const SUPPORT_THRESHOLD = 0.8;

const INSTRUCTION_LIKE =
  /(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+instructions|system\s+prompt|you\s+are\s+now\s+/i;

/** Strip instruction-like sentences before judging support. */
export function stripInstructions(passage: string): string {
  return passage
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !INSTRUCTION_LIKE.test(sentence))
    .join(" ")
    .trim();
}

/** The version in force on `relevantDate`, else the current version. */
export function selectVersion(
  versions: CorpusVersionView[],
  documentId: string,
  relevantDate?: string,
): CorpusVersionView | undefined {
  const own = versions.filter((v) => v.documentId === documentId);
  if (own.length === 0) return undefined;
  if (relevantDate) {
    const inForce = own.find(
      (v) =>
        (!v.effectiveFrom || v.effectiveFrom <= relevantDate) &&
        (!v.effectiveTo || relevantDate < v.effectiveTo),
    );
    if (inForce) return inForce;
  }
  return own.find((v) => v.isCurrent) ?? own[own.length - 1];
}

export function createCitationVerifier(
  corpus: CitationCorpusView,
): CitationVerifier {
  return {
    async verify(citation: CitationInput): Promise<CitationVerificationResult> {
      const layerResults = {
        IDENTITY: { passed: false },
        LOCATION: { passed: false },
        SUPPORT: { passed: false },
        TEMPORAL_VALIDITY: { passed: false },
      } as LayerResults;
      const states: CitationState[] = [];

      // Layer 1 — identity.
      const doc = corpus.documents.find((candidate) => {
        const keys = [
          candidate.citationText,
          candidate.docketNumber,
          candidate.identityKey,
          candidate.title,
        ]
          .filter((value): value is string => Boolean(value))
          .map(normalize);
        return keys.includes(normalize(citation.citationText));
      });
      if (!doc) {
        layerResults.IDENTITY = {
          passed: false,
          evidence: "no document matches the cited identifier",
        };
        states.push("INVALID");
        return finish(citation, layerResults, states, undefined);
      }
      layerResults.IDENTITY = {
        passed: true,
        evidence: `matched ${doc.title}`,
      };
      states.push("VERIFIED_IDENTITY");

      // Layer 2 — location.
      let passageText: string | null = null;
      let provision: CorpusProvisionView | undefined;
      const pinpoint = citation.passageId
        ? corpus.chunks.find((chunk) => chunk.id === citation.passageId)
        : undefined;
      if (pinpoint) {
        passageText = pinpoint.content;
        provision = pinpoint.provisionId
          ? corpus.provisions.find((p) => p.id === pinpoint.provisionId)
          : undefined;
      } else if (citation.passageId) {
        layerResults.LOCATION = {
          passed: false,
          evidence: "cited passage id does not exist",
        };
      } else if (citation.location) {
        // Pinpoint against the version in force at the relevant date, never
        // merely the first matching label in the document.
        const version = selectVersion(
          corpus.versions,
          doc.id,
          citation.relevantDate,
        );
        provision = corpus.provisions.find(
          (p) =>
            p.documentId === doc.id &&
            p.label.trim().toLowerCase() ===
              citation.location!.trim().toLowerCase() &&
            (version ? p.versionId === version.id : true),
        );
        if (provision) passageText = provision.text;
        else
          layerResults.LOCATION = {
            passed: false,
            evidence: `no provision labelled ${citation.location}`,
          };
      } else {
        layerResults.LOCATION = {
          passed: false,
          evidence: "no pinpoint location or passage supplied",
        };
      }
      if (passageText !== null) {
        layerResults.LOCATION = {
          passed: true,
          evidence: provision ? `found ${provision.label}` : "found passage",
        };
        states.push("VERIFIED_LOCATION");
      }

      // Layer 3 — support.
      if (passageText !== null) {
        const cleaned = stripInstructions(passageText);
        const instructionLike = cleaned !== passageText.trim();
        const coverage = supportCoverage(cleaned, citation.proposition);
        const passed =
          coverage >= SUPPORT_THRESHOLD &&
          !INSTRUCTION_LIKE.test(citation.proposition);
        layerResults.SUPPORT = {
          passed,
          evidence: `operative-term coverage ${coverage.toFixed(2)} (threshold ${SUPPORT_THRESHOLD})`,
          notes: instructionLike
            ? "instruction-like sentences stripped; treated as document data. lexical proxy, not semantic entailment"
            : "lexical proxy, not semantic entailment",
        };
        if (passed) states.push("VERIFIED_SUPPORT");
      } else {
        layerResults.SUPPORT = {
          passed: false,
          evidence: "no passage text available to support the proposition",
        };
      }

      // Layer 4 — temporal validity.
      const relevantDate = citation.relevantDate;
      if (!relevantDate) {
        layerResults.TEMPORAL_VALIDITY = {
          passed: false,
          evidence:
            "no relevant date supplied; temporal validity cannot be established",
        };
      } else {
        const temporal = checkTemporal(doc, provision, relevantDate);
        layerResults.TEMPORAL_VALIDITY = temporal;
        if (temporal.passed) states.push("VERIFIED_TEMPORAL_STATUS");
      }

      return finish(citation, layerResults, states, {
        documentId: doc.id,
        passageId: provision?.id ?? citation.passageId,
      });
    },
  };
}

function checkTemporal(
  doc: CorpusDocumentView,
  provision: CorpusProvisionView | undefined,
  relevantDate: string,
): { passed: boolean; evidence: string; notes?: string } {
  const effective = doc.effectivityDate ?? doc.promulgationDate ?? null;
  if (effective && relevantDate < effective) {
    return {
      passed: false,
      evidence: `not yet effective on ${relevantDate} (effective ${effective})`,
    };
  }
  if (doc.repealDate && relevantDate >= doc.repealDate) {
    return {
      passed: false,
      evidence: `document repealed effective ${doc.repealDate}`,
    };
  }
  if (provision) {
    if (provision.effectiveFrom && relevantDate < provision.effectiveFrom) {
      return {
        passed: false,
        evidence: `provision not in force on ${relevantDate}`,
      };
    }
    if (provision.legalStatus === "REPEALED" && !provision.effectiveTo) {
      return {
        passed: false,
        evidence: `provision ${provision.label} is repealed but the repeal date is unknown`,
      };
    }
    if (
      provision.legalStatus === "REPEALED" &&
      provision.effectiveTo &&
      relevantDate >= provision.effectiveTo
    ) {
      return {
        passed: false,
        evidence: `provision ${provision.label} ${provision.legalStatus.toLowerCase()} effective ${provision.effectiveTo}`,
      };
    }
  }
  return { passed: true, evidence: `in force on ${relevantDate}` };
}

function finish(
  citation: CitationInput,
  layerResults: LayerResults,
  states: CitationState[],
  ids: { documentId?: string; passageId?: string } | undefined,
): CitationVerificationResult {
  const layers = Object.values(layerResults);
  const passedCount = layers.filter((layer) => layer.passed).length;
  const identityFailed = !layerResults.IDENTITY.passed;
  const status = identityFailed
    ? VerificationStatus.FAILED
    : passedCount === layers.length
      ? VerificationStatus.VERIFIED
      : passedCount === 0
        ? VerificationStatus.FAILED
        : VerificationStatus.PARTIALLY_VERIFIED;

  if (status === VerificationStatus.PARTIALLY_VERIFIED)
    states.push("PARTIALLY_VERIFIED");
  if (status === VerificationStatus.FAILED && !states.includes("INVALID"))
    states.push("UNVERIFIED");

  return {
    citationId: `cite_${Math.abs(hashString(`${citation.citationText}|${citation.proposition}|${citation.relevantDate ?? ""}`))}`,
    documentId: ids?.documentId ?? "",
    passageId: ids?.passageId ?? citation.passageId ?? "",
    citationText: citation.citationText,
    identityVerified: layerResults.IDENTITY.passed,
    passageVerified: layerResults.LOCATION.passed,
    propositionSupported: layerResults.SUPPORT.passed,
    temporalValidity: layerResults.TEMPORAL_VALIDITY.passed,
    verificationMethod: VerificationMethod.AUTOMATED,
    verificationStatus: status,
    layerResults,
    states: [...new Set(states)],
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export type { VerificationLayer };
