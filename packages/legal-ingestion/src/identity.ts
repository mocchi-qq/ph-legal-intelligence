// @phli/legal-ingestion — legal identifier parsing and exact resolution
// Gate 2. See docs/gates/gate-2/04_LEGAL_IDENTITY_AND_STRUCTURE.md
//
// Identity is never inferred from title similarity. A parsed identifier resolves
// only to an exact kind+number match; anything else is NO_MATCH or AMBIGUOUS.

export type LegalIdentifierKind =
  | "REPUBLIC_ACT"
  | "EXECUTIVE_ORDER"
  | "PRESIDENTIAL_DECREE"
  | "ADMINISTRATIVE_ORDER"
  | "MEMORANDUM_CIRCULAR"
  | "GR"
  | "AM";

export interface ParsedIdentifier {
  kind: LegalIdentifierKind;
  /** Normalized number, e.g. `1001` or `25-11-28-SC`. */
  number: string;
  /** Canonical identity key form, e.g. `REPUBLIC_ACT:1001`. */
  normalized: string;
  confidence: "exact";
}

interface Pattern {
  kind: LegalIdentifierKind;
  regex: RegExp;
}

// Order matters: longest/most specific first.
const PATTERNS: Pattern[] = [
  {
    kind: "REPUBLIC_ACT",
    regex: /\b(?:Republic\s+Act|R\.?\s*A\.?)\s*(?:No\.?)?\s*(\d{1,5})\b/i,
  },
  {
    kind: "EXECUTIVE_ORDER",
    regex: /\b(?:Executive\s+Order|E\.?\s*O\.?)\s*(?:No\.?)?\s*(\d{1,5})\b/i,
  },
  {
    kind: "PRESIDENTIAL_DECREE",
    regex:
      /\b(?:Presidential\s+Decree|P\.?\s*D\.?)\s*(?:No\.?)?\s*(\d{1,5})\b/i,
  },
  {
    kind: "ADMINISTRATIVE_ORDER",
    regex:
      /\b(?:Administrative\s+Order|A\.?\s*O\.?)\s*(?:No\.?)?\s*(\d{1,5})\b/i,
  },
  {
    kind: "MEMORANDUM_CIRCULAR",
    regex:
      /\b(?:Memorandum\s+Circular|M\.?\s*C\.?)\s*(?:No\.?)?\s*(\d{1,5})\b/i,
  },
  { kind: "GR", regex: /\bG\.\s*R\.\s*(?:No\.?)?\s*(\d{1,7})\b/i },
  {
    kind: "AM",
    regex:
      /\bA\.?\s*M\.?\s*(?:No\.?)?\s*([0-9]{2}-[0-9]{2}-[0-9]{2}(?:-[A-Z]{1,4})?)\b/i,
  },
];

/** Parse the first recognizable legal identifier in text. Returns null if none. */
export function parseLegalIdentifier(text: string): ParsedIdentifier | null {
  for (const { kind, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;
    const number = match[1]!.toUpperCase();
    return {
      kind,
      number,
      normalized: `${kind}:${number}`,
      confidence: "exact",
    };
  }
  return null;
}

export interface IdentityCandidate {
  identityKey: string;
  issuingBody?: string | null;
  documentType?: string | null;
}

export type IdentityResolution =
  | { status: "MATCH"; candidate: IdentityCandidate }
  | { status: "NO_MATCH" }
  | { status: "AMBIGUOUS"; candidates: IdentityCandidate[] };

/**
 * Resolve a parsed identifier against explicit candidates. Never falls back to
 * a neighbouring identifier or a title match.
 */
export function resolveIdentity(
  parsed: ParsedIdentifier,
  candidates: IdentityCandidate[],
  issuingBody?: string,
): IdentityResolution {
  const exact = candidates.filter((candidate) => {
    const parsedCandidate = parseLegalIdentifier(
      candidate.identityKey.replace(/[_:]/g, " "),
    );
    return (
      parsedCandidate !== null &&
      parsedCandidate.kind === parsed.kind &&
      parsedCandidate.number === parsed.number
    );
  });

  if (exact.length === 0) return { status: "NO_MATCH" };
  if (exact.length === 1) return { status: "MATCH", candidate: exact[0]! };

  if (issuingBody) {
    const byAuthority = exact.filter(
      (candidate) =>
        candidate.issuingBody?.toLowerCase() === issuingBody.toLowerCase(),
    );
    if (byAuthority.length === 1)
      return { status: "MATCH", candidate: byAuthority[0]! };
  }
  return { status: "AMBIGUOUS", candidates: exact };
}

export interface StructureUnit {
  id: string;
  parentId: string | null;
  kind:
    | "PART"
    | "TITLE"
    | "CHAPTER"
    | "ARTICLE"
    | "SECTION"
    | "SUBSECTION"
    | "PARAGRAPH"
    | "RULE"
    | "ANNEX"
    | "SCHEDULE";
  label: string;
  ordinal: number;
  text: string;
}

/**
 * Parse a simple statutory outline from labelled lines. Labels are taken from
 * the text; missing numbers are never invented.
 */
export function parseStatutoryOutline(normalizedText: string): StructureUnit[] {
  const linePattern =
    /^(ARTICLE|Article|CHAPTER|Chapter|TITLE|Title|PART|Part|Section|SECTION|Rule|RULE|Annex|ANNEX)\s+([0-9A-Za-zIVXLC-]+)[.:]?\s*(.*)$/;
  const units: StructureUnit[] = [];
  const lines = normalizedText.split("\n");
  let ordinal = 0;
  for (const line of lines) {
    const match = linePattern.exec(line.trim());
    if (!match) continue;
    const raw = match[1]!.toUpperCase();
    const kind: StructureUnit["kind"] =
      raw === "ARTICLE"
        ? "ARTICLE"
        : raw === "CHAPTER"
          ? "CHAPTER"
          : raw === "TITLE"
            ? "TITLE"
            : raw === "PART"
              ? "PART"
              : raw === "RULE"
                ? "RULE"
                : raw === "ANNEX"
                  ? "ANNEX"
                  : "SECTION";
    ordinal += 1;
    units.push({
      id: `${kind.toLowerCase()}-${match[2]}`,
      parentId: null,
      kind,
      label: `${match[1]} ${match[2]}`,
      ordinal,
      text: match[3]?.trim() ?? "",
    });
  }
  return units;
}
