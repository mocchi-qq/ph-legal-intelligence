// @phli/ai-orchestrator — evidence-only answer grounding
// Gate 1. See docs/gates/gate-1/07_CITATION_VERIFICATION_REPORT.md
//
// This composer does not call a model. It assembles an answer strictly from
// passages whose citations passed verification. If no citation is fully
// verified it abstains. This is what "grounded" means at Gate 1; whether a
// generative model can be constrained to the same standard is unverified.

import type {
  CitationInput,
  CitationVerificationResult,
} from "@phli/citation-engine";

// String literal to keep this package free of a runtime dependency on the engine.
const VERIFIED = "VERIFIED";

export interface CitedEvidence {
  documentTitle: string;
  citation: CitationInput;
  result: CitationVerificationResult;
  passage: string;
}

export interface GroundedAnswer {
  question: string;
  asOfDate?: string;
  shortAnswer: string;
  authorities: Array<{
    title: string;
    citation: string;
    passage: string;
    states: string[];
  }>;
  limitations: string[];
  verifiedCount: number;
  unverifiedCount: number;
  abstained: boolean;
  missingInformation: string[];
  evidenceOnly: true;
}

const INJECTION =
  /(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+instructions|system\s+prompt|you\s+are\s+now\s+/i;
const FACT_SPECIFIC = /\b(my client|our client|our company|i |we )\b/i;

function sanitize(passage: string): string {
  return passage
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !INJECTION.test(sentence))
    .join(" ")
    .trim();
}

export function composeGroundedAnswer(
  question: string,
  evidence: CitedEvidence[],
  options: { asOfDate?: string } = {},
): GroundedAnswer {
  const verified = evidence.filter(
    (item) => item.result.verificationStatus === VERIFIED,
  );
  const unverified = evidence.filter(
    (item) => item.result.verificationStatus !== VERIFIED,
  );
  const limitations: string[] = [];
  const missingInformation: string[] = [];

  if (unverified.length > 0) {
    limitations.push(
      `${unverified.length} citation(s) were not fully verified and are excluded from the answer: ` +
        unverified.map((item) => item.citation.citationText).join("; "),
    );
  }
  for (const item of unverified) {
    const failed = Object.entries(item.result.layerResults)
      .filter(([, layer]) => !layer.passed)
      .map(([name]) => name.toLowerCase());
    limitations.push(
      `${item.citation.citationText}: failed ${failed.join(", ")}`,
    );
  }

  for (const item of evidence) {
    if (
      INJECTION.test(item.passage) ||
      INJECTION.test(item.citation.proposition)
    ) {
      limitations.push(
        `${item.citation.citationText}: passage contains instruction-like text; treated as document data, not an instruction`,
      );
    }
  }

  if (verified.length === 0) {
    missingInformation.push(
      "no fully verified authority supports this question",
    );
    return {
      question,
      asOfDate: options.asOfDate,
      shortAnswer:
        "Insufficient verified authority to answer. No citation passed identity, location, support and temporal checks.",
      authorities: [],
      limitations,
      verifiedCount: 0,
      unverifiedCount: unverified.length,
      abstained: true,
      missingInformation,
      evidenceOnly: true,
    };
  }

  const authorities = verified.map((item) => ({
    title: item.documentTitle,
    citation: item.citation.citationText,
    // Remove instruction-like sentences before display. The passage is data,
    // never an instruction, and is not echoed back into the answer.
    passage: sanitize(item.passage),
    states: item.result.states ?? [],
  }));

  const factSpecific = FACT_SPECIFIC.test(question);
  if (factSpecific) {
    missingInformation.push(
      "fact-specific application not performed: the question depends on facts not supplied",
    );
    limitations.push(
      "The answer states the legal framework only; it does not apply it to unstated facts.",
    );
  }

  const shortAnswer =
    (factSpecific ? "Legal framework only (facts not supplied). " : "") +
    "Based only on verified authorities: " +
    authorities
      .map((authority, index) => `[${index + 1}] ${authority.passage}`)
      .join(" ");

  limitations.push(
    "Answer assembled from cited passages only; no model-generated legal conclusion was added.",
  );
  if (options.asOfDate) {
    limitations.push(
      `Temporal scope: authority checked as in force on ${options.asOfDate}.`,
    );
  }

  return {
    question,
    asOfDate: options.asOfDate,
    shortAnswer,
    authorities,
    limitations,
    verifiedCount: verified.length,
    unverifiedCount: unverified.length,
    abstained: false,
    missingInformation,
    evidenceOnly: true,
  };
}
