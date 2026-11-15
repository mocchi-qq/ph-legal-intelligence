// @phli/citation-engine — four-layer citation verifier
// Gate 1. See docs/gates/gate-1/07_CITATION_VERIFICATION_REPORT.md
//
// Implemented: identity, location, temporal, and a deterministic lexical
// support proxy. The support proxy is NOT semantic entailment — it checks
// whether the cited passage actually contains the operative terms of the
// proposition. It is conservative: unsupported prose fails rather than passing
// on topical overlap. This limitation is reported, not hidden.

import type {
  AuthorityStatusView,
  CitationInput,
  CitationState,
  CitationVerificationResult,
  CitationVerifierOptions,
  LayerResults,
  SupportClass,
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

/**
 * Canonical form of a provision label, so `"2"`, `"Section 2"` and `"Sec. 2"`
 * all compare equal while `"Section 2(a)"` stays distinct from `"Section 2A"`.
 * Delimiters that carry legal meaning (`-`, `(`, `)`) are preserved.
 */
export function normalizeProvisionLabel(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(SECTION|SEC\.?|S\.)(?=\d|\()/, "");
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
export interface VersionSelection {
  version: CorpusVersionView | null;
  /** True when more than one version covers the supplied date. */
  conflict: boolean;
}

export function selectVersion(
  versions: CorpusVersionView[],
  documentId: string,
  relevantDate?: string,
): VersionSelection {
  const own = versions.filter((v) => v.documentId === documentId);
  if (own.length === 0) return { version: null, conflict: false };
  // A supplied date must resolve to exactly one version; never fall back to
  // the current text when the point-in-time version cannot be established.
  if (typeof relevantDate === "string" && relevantDate.trim().length > 0) {
    const inForce = own.filter(
      (v) =>
        (!v.effectiveFrom || v.effectiveFrom <= relevantDate) &&
        (!v.effectiveTo || relevantDate < v.effectiveTo),
    );
    if (inForce.length === 1) return { version: inForce[0], conflict: false };
    if (inForce.length > 1) return { version: null, conflict: true };
    return { version: null, conflict: false };
  }
  return {
    version: own.find((v) => v.isCurrent) ?? own[own.length - 1] ?? null,
    conflict: false,
  };
}

export function createCitationVerifier(
  corpus: CitationCorpusView,
  options: CitationVerifierOptions = {},
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
      let supportClass: SupportClass = "INSUFFICIENT_CONTEXT";
      let supportMethod: "lexical_proxy" | "technical_annotation" =
        "lexical_proxy";
      let temporalSource: "authority_projection" | "legacy_fields" =
        "legacy_fields";
      let authorityStatus: AuthorityStatusView | null = null;

      // Layer 1 — identity. Collect every match; an identifier that resolves
      // to more than one document is ambiguous and must not be guessed.
      const wanted = normalize(citation.citationText);
      const matches = corpus.documents.filter((candidate) => {
        const keys = [
          candidate.citationText,
          candidate.docketNumber,
          candidate.identityKey,
          candidate.title,
        ]
          .filter((value): value is string => Boolean(value))
          .map(normalize);
        return keys.includes(wanted);
      });
      if (matches.length === 0) {
        layerResults.IDENTITY = {
          passed: false,
          evidence: "no document matches the cited identifier",
        };
        states.push("INVALID");
        return finish(
          citation,
          layerResults,
          states,
          undefined,
          supportClass,
          supportMethod,
          temporalSource,
          authorityStatus,
        );
      }
      if (matches.length > 1) {
        layerResults.IDENTITY = {
          passed: false,
          evidence: "ambiguous_identity",
          notes: `${matches.length} documents match the cited identifier (${matches
            .map((candidate) => candidate.id)
            .join(
              ", ",
            )}); identity cannot be established from an ambiguous identifier`,
        };
        states.push("INVALID");
        return finish(
          citation,
          layerResults,
          states,
          undefined,
          supportClass,
          supportMethod,
          temporalSource,
          authorityStatus,
        );
      }
      const doc = matches[0] as CorpusDocumentView;
      layerResults.IDENTITY = {
        passed: true,
        evidence: `matched ${doc.title}`,
      };
      states.push("VERIFIED_IDENTITY");

      // Layer 2 — location.
      let passageText: string | null = null;
      let provision: CorpusProvisionView | undefined;
      let locationFailure: { evidence: string; notes?: string } | undefined;
      if (citation.passageId) {
        const pinpoint = corpus.chunks.find(
          (chunk) => chunk.id === citation.passageId,
        );
        if (!pinpoint) {
          locationFailure = { evidence: "cited passage id does not exist" };
        } else if (pinpoint.documentId !== doc.id) {
          // Ownership: a passage can only support a citation to its own document.
          locationFailure = { evidence: "passage_document_mismatch" };
        } else {
          passageText = pinpoint.content;
          if (pinpoint.provisionId) {
            const candidate = corpus.provisions.find(
              (p) => p.id === pinpoint.provisionId,
            );
            if (candidate && candidate.documentId !== doc.id) {
              passageText = null;
              locationFailure = { evidence: "provision_document_mismatch" };
            } else {
              provision = candidate;
            }
          }
        }
      } else if (citation.location) {
        // Pinpoint against the version in force at the relevant date, never
        // merely the first matching label in the document.
        const selection = selectVersion(
          corpus.versions,
          doc.id,
          citation.relevantDate,
        );
        if (selection.conflict) {
          locationFailure = {
            evidence: "overlapping_versions",
            notes: `more than one version of ${doc.id} covers ${citation.relevantDate}`,
          };
        } else if (citation.relevantDate && !selection.version) {
          locationFailure = {
            evidence: "no_version_in_force",
            notes: `no version of ${doc.id} covers ${citation.relevantDate}`,
          };
        } else {
          provision = corpus.provisions.find(
            (p) =>
              p.documentId === doc.id &&
              normalizeProvisionLabel(p.label) ===
                normalizeProvisionLabel(citation.location as string) &&
              (selection.version ? p.versionId === selection.version.id : true),
          );
          if (provision) passageText = provision.text;
          else
            locationFailure = {
              evidence: `no provision labelled ${citation.location}`,
            };
        }
      } else {
        locationFailure = {
          evidence: "no pinpoint location or passage supplied",
        };
      }
      if (locationFailure) {
        layerResults.LOCATION = {
          passed: false,
          evidence: locationFailure.evidence,
          ...(locationFailure.notes ? { notes: locationFailure.notes } : {}),
        };
      } else if (passageText !== null) {
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
        if (citation.supportAnnotation) {
          supportMethod = "technical_annotation";
          const annotation = citation.supportAnnotation;
          supportClass =
            annotation === "FULL_SUPPORT"
              ? "FULL_SUPPORT"
              : annotation === "PARTIAL_SUPPORT"
                ? "PARTIAL_SUPPORT"
                : annotation === "CONTRADICTED"
                  ? "CONTRADICTED"
                  : annotation === "INSUFFICIENT_CONTEXT"
                    ? "INSUFFICIENT_CONTEXT"
                    : "NO_SUPPORT";
          const passed = annotation === "FULL_SUPPORT";
          layerResults.SUPPORT = {
            passed,
            evidence: `reviewed label ${annotation}`,
            notes:
              "technical annotation supplied by the evaluation set; not legal validation",
          };
          if (passed) states.push("VERIFIED_SUPPORT");
        } else {
          const coverage = supportCoverage(cleaned, citation.proposition);
          const instructionSafe = !INSTRUCTION_LIKE.test(citation.proposition);
          const passed = coverage >= SUPPORT_THRESHOLD && instructionSafe;
          const propositionKey = normalize(citation.proposition);
          const passageKey = normalize(cleaned);
          const directQuote =
            propositionKey.length >= 25 && passageKey.includes(propositionKey);
          supportClass = directQuote
            ? "DIRECT_QUOTE"
            : passed
              ? "LEXICAL_ONLY"
              : "NO_SUPPORT";
          layerResults.SUPPORT = {
            passed,
            evidence: `operative-term coverage ${coverage.toFixed(2)} (threshold ${SUPPORT_THRESHOLD})`,
            notes: instructionLike
              ? "instruction-like sentences stripped; treated as document data. lexical proxy, not semantic entailment"
              : "lexical proxy, not semantic entailment",
          };
          if (passed) states.push("VERIFIED_SUPPORT");
        }
      } else {
        supportClass = "INSUFFICIENT_CONTEXT";
        layerResults.SUPPORT = {
          passed: false,
          evidence: "no passage text available to support the proposition",
        };
      }

      // Layer 4 — temporal validity. When a reviewed authority projection is
      // supplied it decides the layer; the legacy date fields are only a
      // fallback and are labelled as such in the result.
      const relevantDate = citation.relevantDate;
      if (!relevantDate) {
        layerResults.TEMPORAL_VALIDITY = {
          passed: false,
          evidence:
            "no relevant date supplied; temporal validity cannot be established",
        };
      } else if (options.authority) {
        const status = await options.authority({
          documentId: doc.id,
          provisionId: provision?.id ?? null,
          asOf: relevantDate,
        });
        const operative = [
          "IN_FORCE",
          "AMENDED",
          "PARTIALLY_AMENDED",
          "REINSTATED",
          "CONSOLIDATED",
          "RENUMBERED",
        ].includes(status.state);
        // A determined, operative state is still not enough: an abstained
        // projection makes no claim, and a version that does not cover the
        // as-of date means the cited text is not the one in effect.
        const missing = status.missing ?? [];
        const passed =
          status.outcome === "DETERMINED_WITH_REVIEWED_EVIDENCE" &&
          operative &&
          status.abstained === false &&
          !missing.includes("VERSION_NOT_IN_EFFECT");
        layerResults.TEMPORAL_VALIDITY = {
          passed,
          evidence: `${status.outcome}/${status.state}: ${status.explanation}`,
        };
        if (passed) states.push("VERIFIED_TEMPORAL_STATUS");
        temporalSource = "authority_projection";
        // Provenance travels with the recorded status: the layer's pass
        // predicate above is unchanged, but a reader can tell whether the
        // authorization behind it came from the registry or from the caller.
        authorityStatus = {
          ...status,
          ...(status.authorizationSource !== undefined
            ? { authorizationSource: status.authorizationSource }
            : {}),
        };
      } else {
        const temporal = checkTemporal(doc, provision, relevantDate);
        layerResults.TEMPORAL_VALIDITY = temporal;
        if (temporal.passed) states.push("VERIFIED_TEMPORAL_STATUS");
        temporalSource = "legacy_fields";
        authorityStatus = null;
      }

      return finish(
        citation,
        layerResults,
        states,
        {
          documentId: doc.id,
          passageId: provision?.id ?? citation.passageId,
        },
        supportClass,
        supportMethod,
        temporalSource,
        authorityStatus,
      );
    },
  };
}

function checkTemporal(
  doc: CorpusDocumentView,
  provision: CorpusProvisionView | undefined,
  relevantDate: string,
): { passed: boolean; evidence: string; notes?: string } {
  // A terminal status with no end date cannot be evaluated: fail closed rather
  // than assume the text was still in force.
  if (
    (doc.legalStatus === "REPEALED" ||
      doc.legalStatus === "EXPIRED" ||
      doc.legalStatus === "SUPERSEDED") &&
    !doc.repealDate
  ) {
    return {
      passed: false,
      evidence: "end_date_unknown",
      notes: `document ${doc.id} is ${doc.legalStatus} but no repeal/end date is recorded`,
    };
  }
  if (doc.legalStatus === "NOT_YET_EFFECTIVE" && !doc.effectivityDate) {
    return {
      passed: false,
      evidence: "effectivity_date_unknown",
      notes: `document ${doc.id} is NOT_YET_EFFECTIVE but no effectivity date is recorded`,
    };
  }
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
  supportClass: SupportClass,
  supportMethod: "lexical_proxy" | "technical_annotation",
  temporalSource: "authority_projection" | "legacy_fields" = "legacy_fields",
  authorityStatus: AuthorityStatusView | null = null,
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

  const hashKey = [
    citation.citationText,
    citation.proposition,
    citation.relevantDate ?? "",
    ids?.documentId ?? citation.documentId ?? "",
    citation.location ?? "",
    ids?.passageId ?? citation.passageId ?? "",
  ].join("|");

  return {
    citationId: `cite_${Math.abs(hashString(hashKey))}`,
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
    supportClass,
    supportMethod,
    temporalSource,
    authorityStatus,
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
