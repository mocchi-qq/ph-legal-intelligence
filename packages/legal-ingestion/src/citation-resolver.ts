export type CitationType =
  | "STATUTE"
  | "EXECUTIVE_ISSUANCE"
  | "ADMINISTRATIVE_ISSUANCE"
  | "CASE"
  | "COURT_RULE"
  | "PROVISION_REFERENCE"
  | "UNKNOWN";

export interface ParsedCitation {
  raw: string;
  normalized: string;
  citationType: CitationType;
  components: {
    instrumentKind?: string;
    instrumentNumber?: string;
    year?: string;
    provisionType?:
      | "ARTICLE"
      | "SECTION"
      | "RULE"
      | "PARAGRAPH"
      | "CLAUSE"
      | "ITEM";
    provisionLabel?: string;
    subdivision?: string;
  };
  confidence: "exact" | "partial";
  warnings: string[];
}

export type ResolutionStatus =
  | "EXACT"
  | "ALIAS"
  | "MULTIPLE_CANDIDATES"
  | "PARTIAL"
  | "NO_MATCH"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_TYPE"
  | "UNCERTAIN";

export interface CitationCandidate {
  documentId: string;
  provisionIdentityId: string | null;
  match: "CANONICAL_ID" | "ALIAS" | "PROVISION_LABEL";
  provenance: string;
}

export interface CitationResolution {
  status: ResolutionStatus;
  raw: string;
  normalized: string;
  parsed: ParsedCitation | null;
  candidates: CitationCandidate[];
  provenance: string[];
}

export interface ResolverProvision {
  provisionIdentityId: string;
  label: string;
}

export interface ResolverDocument {
  id: string;
  documentType: string;
  citationText?: string | null;
  identityKey?: string | null;
  aliases?: string[];
  provisions?: ResolverProvision[];
}

interface InstrumentSpec {
  kind: string;
  citationType: CitationType;
  pattern: RegExp;
}

interface InstrumentMatch {
  kind: string;
  number: string;
  citationType: CitationType;
  index: number;
}

interface ProvisionScan {
  section?: string;
  article?: string;
  rule?: string;
}

/**
 * Jural instrument grammar. Every alternative is anchored on a word boundary so
 * an abbreviation such as "RA" inside a word ("para 5" -> "ra 5") can never be
 * read as an instrument.
 */
const INSTRUMENT_SPECS: InstrumentSpec[] = [
  {
    kind: "REPUBLIC_ACT",
    citationType: "STATUTE",
    pattern: /\b(?:REPUBLIC\s+ACT|R\.?\s*A\.?)\s*(?:NO\.?)?\s*(\d{1,5})/i,
  },
  {
    kind: "EXECUTIVE_ORDER",
    citationType: "EXECUTIVE_ISSUANCE",
    pattern: /\b(?:EXECUTIVE\s+ORDER|E\.?\s*O\.?)\s*(?:NO\.?)?\s*(\d{1,5})/i,
  },
  {
    kind: "PRESIDENTIAL_DECREE",
    citationType: "STATUTE",
    pattern:
      /\b(?:PRESIDENTIAL\s+DECREE|P\.?\s*D\.?)\s*(?:NO\.?)?\s*(\d{1,5})/i,
  },
  {
    kind: "ADMINISTRATIVE_ORDER",
    citationType: "ADMINISTRATIVE_ISSUANCE",
    pattern:
      /\b(?:ADMINISTRATIVE\s+ORDER|A\.?\s*O\.?)\s*(?:NO\.?)?\s*(\d{1,5})/i,
  },
  {
    kind: "MEMORANDUM_CIRCULAR",
    citationType: "ADMINISTRATIVE_ISSUANCE",
    pattern:
      /\b(?:MEMORANDUM\s+CIRCULAR|M\.?\s*C\.?)\s*(?:NO\.?)?\s*(\d{1,5})/i,
  },
  {
    kind: "G.R.",
    citationType: "CASE",
    pattern: /\bG\.\s*R\.\s*(?:NO\.?)?\s*(\d{1,7})/i,
  },
  {
    kind: "A.M.",
    citationType: "COURT_RULE",
    pattern:
      /\bA\.?\s*M\.?\s*(?:NO\.?)?\s*([0-9]{2}-[0-9]{2}-[0-9]{2}(?:-[A-Z]{1,4})?)/i,
  },
];

/**
 * Canonical instrument kind used to build `${canonicalKind}:${number}` identity
 * keys. G.R. and A.M. are the only kinds whose parsed abbreviation differs from
 * the identity-key prefix.
 */
const CANONICAL_IDENTITY_KINDS: Record<string, string> = {
  REPUBLIC_ACT: "REPUBLIC_ACT",
  EXECUTIVE_ORDER: "EXECUTIVE_ORDER",
  PRESIDENTIAL_DECREE: "PRESIDENTIAL_DECREE",
  ADMINISTRATIVE_ORDER: "ADMINISTRATIVE_ORDER",
  MEMORANDUM_CIRCULAR: "MEMORANDUM_CIRCULAR",
  "G.R.": "GR",
  GR: "GR",
  "A.M.": "AM",
  AM: "AM",
};

const SYNTH_PATTERN = /\bSYNTH-(?:ACT|CASE|SEC)-[A-Z0-9-]+\b/i;

/**
 * Provision label grammar: "2", "2A", "2.1", "2-A", "2(a)", "2.1(a)".
 * The trailing lookahead replaces a `\b` because `\b` cannot sit after a
 * closing parenthesis and would silently truncate "2(a)" to "2".
 */
const SECTION_PATTERN =
  /\b(?:SECTION|SEC\.?|S\.)\s*([0-9]{1,4}[A-Za-z]?(?:[.-][0-9A-Za-z]+)*(?:\([A-Za-z0-9]+\))?)(?![A-Za-z0-9])/i;
const ARTICLE_PATTERN = /\b(?:ARTICLE|ART\.?)\s*([IVXLC]+|\d{1,3})\b/i;
const RULE_PATTERN = /\bRULE\s+(\d{1,3}[A-Za-z]?)\b/i;
const TRAILING_DATE_PATTERN = /,\s*(\d{4})-(\d{2})-(\d{2})\s*$/;

export function normalizeCitationText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Normalizes a provision label for comparison. Subdivision markers are kept
 * distinct: "Section 2(a)" -> "SECTION2_A", "Section 2A" -> "SECTION2A",
 * "Sec. 2-A" -> "SECTION2-A".
 */
export function normalizeLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\(/g, "_")
    .replace(/\)/g, "")
    .replace(/[^A-Z0-9_.-]/g, "");
}

function findInstrumentMatches(text: string): InstrumentMatch[] {
  const matches: InstrumentMatch[] = [];
  for (const spec of INSTRUMENT_SPECS) {
    const global = new RegExp(spec.pattern.source, "gi");
    let match = global.exec(text);
    while (match) {
      matches.push({
        kind: spec.kind,
        number: match[1],
        citationType: spec.citationType,
        index: match.index,
      });
      if (match[0].length === 0) global.lastIndex += 1;
      match = global.exec(text);
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function pickPrimaryInstrument(
  matches: InstrumentMatch[],
): InstrumentMatch | null {
  for (const spec of INSTRUMENT_SPECS) {
    const first = matches.find((m) => m.kind === spec.kind);
    if (first) return first;
  }
  return null;
}

function scanProvisions(text: string): ProvisionScan {
  const scan: ProvisionScan = {};
  const section = text.match(SECTION_PATTERN);
  if (section) scan.section = section[1];
  const article = text.match(ARTICLE_PATTERN);
  if (article) scan.article = article[1];
  const rule = text.match(RULE_PATTERN);
  if (rule) scan.rule = rule[1];
  return scan;
}

function applyProvisionScan(scan: ProvisionScan, parsed: ParsedCitation): void {
  const container =
    scan.article !== undefined
      ? `Article ${scan.article}`
      : scan.rule !== undefined
        ? `Rule ${scan.rule}`
        : undefined;

  if (scan.section !== undefined) {
    parsed.components.provisionType = "SECTION";
    parsed.components.provisionLabel = scan.section;
    if (container) parsed.components.subdivision = container;
    return;
  }
  if (scan.rule !== undefined) {
    parsed.components.provisionType = "RULE";
    parsed.components.provisionLabel = scan.rule;
    return;
  }
  if (scan.article !== undefined) {
    parsed.components.provisionType = "ARTICLE";
    parsed.components.provisionLabel = scan.article;
  }
}

export function parsePhilippineCitation(text: string): ParsedCitation | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const base: ParsedCitation = {
    raw: trimmed,
    normalized: normalizeCitationText(trimmed),
    citationType: "UNKNOWN",
    components: {},
    confidence: "partial",
    warnings: [],
  };

  const instrumentMatches = findInstrumentMatches(trimmed);
  const distinctInstruments = new Set(
    instrumentMatches.map((m) => `${m.kind}:${m.number}`),
  );
  const multipleInstruments = distinctInstruments.size > 1;
  const scan = scanProvisions(trimmed);

  let parsed: ParsedCitation;

  const synthMatch = trimmed.match(SYNTH_PATTERN);
  const primary = pickPrimaryInstrument(instrumentMatches);

  if (synthMatch && !primary) {
    parsed = {
      ...base,
      citationType: "UNKNOWN",
      components: {
        instrumentKind: "SYNTHETIC",
        instrumentNumber: synthMatch[0],
      },
      // Synthetic identifiers are fixtures, never authoritative text.
      confidence: "partial",
      warnings: [],
    };
    applyProvisionScan(scan, parsed);
  } else if (primary) {
    parsed = {
      ...base,
      citationType: primary.citationType,
      components: {
        instrumentKind: primary.kind,
        instrumentNumber: primary.number,
      },
      confidence: "exact",
      warnings: [],
    };
    applyProvisionScan(scan, parsed);
  } else if (
    !synthMatch &&
    (scan.section !== undefined || scan.article !== undefined)
  ) {
    parsed = {
      ...base,
      citationType: "PROVISION_REFERENCE",
      components: {},
      confidence: "exact",
      warnings: [],
    };
    applyProvisionScan(scan, parsed);
  } else if (!synthMatch && scan.rule !== undefined) {
    parsed = {
      ...base,
      citationType: "COURT_RULE",
      components: {},
      confidence: "exact",
      warnings: [],
    };
    applyProvisionScan(scan, parsed);
  } else {
    return {
      ...base,
      citationType: "UNKNOWN",
      components: {},
      confidence: "partial",
      warnings: ["unrecognized_format"],
    };
  }

  if (multipleInstruments) {
    // Never pick one instrument when the text names several.
    parsed.components.instrumentKind =
      parsed.components.instrumentKind ?? primary?.kind;
    parsed.warnings = [...parsed.warnings, "multiple_instruments"];
    parsed.confidence = "partial";
  }

  return parsed;
}

function canonicalIdentityKey(parsed: ParsedCitation): string | null {
  const kind = parsed.components.instrumentKind;
  const number = parsed.components.instrumentNumber;
  if (!kind || !number) return null;
  const canonicalKind = CANONICAL_IDENTITY_KINDS[kind];
  if (!canonicalKind) return null;
  return `${canonicalKind}:${number.toUpperCase()}`;
}

function provisionTargets(parsed: ParsedCitation): Set<string> {
  const rawLabel = parsed.components.provisionLabel ?? "";
  const labelType = parsed.components.provisionType ?? "SECTION";
  return new Set([
    normalizeLabel(rawLabel),
    normalizeLabel(`${labelType} ${rawLabel}`),
  ]);
}

function findProvisionMatches(
  doc: ResolverDocument,
  parsed: ParsedCitation,
): ResolverProvision[] {
  const targets = provisionTargets(parsed);
  return (doc.provisions ?? []).filter((p) =>
    targets.has(normalizeLabel(p.label)),
  );
}

export class CitationResolver {
  private documents: ResolverDocument[];

  constructor(documents: ResolverDocument[]) {
    this.documents = documents.map((d) => ({ ...d }));
  }

  private identityCandidates(
    parsed: ParsedCitation,
    trimmed: string,
    normalizedComparison: string,
  ): CitationCandidate[] {
    const identityKey = canonicalIdentityKey(parsed);
    const candidates: CitationCandidate[] = [];

    for (const doc of this.documents) {
      let matchKind: "CANONICAL_ID" | "ALIAS" | null = null;
      let prov: string | null = null;

      if (doc.id === trimmed) {
        matchKind = "CANONICAL_ID";
        prov = "document_id";
      } else if (identityKey && doc.identityKey === identityKey) {
        matchKind = "CANONICAL_ID";
        prov = "identity_key";
      } else if (
        doc.citationText &&
        normalizeCitationText(doc.citationText) === normalizedComparison
      ) {
        matchKind = "CANONICAL_ID";
        prov = "citation_text";
      } else if (doc.aliases) {
        for (const alias of doc.aliases) {
          const normAlias = normalizeCitationText(alias);
          if (
            normAlias === normalizedComparison ||
            normAlias === parsed.normalized
          ) {
            matchKind = "ALIAS";
            prov = "alias";
            break;
          }
        }
      }

      if (matchKind && prov) {
        candidates.push({
          documentId: doc.id,
          provisionIdentityId: null,
          match: matchKind,
          provenance: prov,
        });
      }
    }

    const seen = new Set<string>();
    return candidates.filter((c) => {
      const key = `${c.documentId}|${c.provisionIdentityId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private resolveProvision(
    rawText: string,
    parsed: ParsedCitation,
    doc: ResolverDocument | null,
  ): CitationResolution {
    const base = {
      raw: rawText,
      normalized: parsed.normalized,
      parsed,
    };

    if (!doc) {
      return {
        ...base,
        status: "PARTIAL",
        candidates: [],
        provenance: parsed.components.subdivision
          ? ["composite_container"]
          : ["provision_without_document"],
      };
    }

    const matches = findProvisionMatches(doc, parsed);

    if (matches.length === 0) {
      return {
        ...base,
        status: "NO_MATCH",
        candidates: [],
        provenance: ["provision_not_found"],
      };
    }
    if (matches.length === 1) {
      return {
        ...base,
        status: "EXACT",
        candidates: [
          {
            documentId: doc.id,
            provisionIdentityId: matches[0].provisionIdentityId,
            match: "PROVISION_LABEL",
            provenance: "provision_label",
          },
        ],
        provenance: ["provision_label"],
      };
    }
    return {
      ...base,
      status: "MULTIPLE_CANDIDATES",
      candidates: matches.map((m) => ({
        documentId: doc.id,
        provisionIdentityId: m.provisionIdentityId,
        match: "PROVISION_LABEL" as const,
        provenance: "provision_label",
      })),
      provenance: ["provision_label"],
    };
  }

  resolve(
    rawText: string,
    context?: { documentId?: string },
  ): CitationResolution {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        status: "INVALID_FORMAT",
        raw: rawText,
        normalized: normalizeCitationText(rawText),
        parsed: null,
        candidates: [],
        provenance: ["empty_citation"],
      };
    }

    const parsed = parsePhilippineCitation(trimmed);
    if (!parsed) {
      return {
        status: "INVALID_FORMAT",
        raw: rawText,
        normalized: normalizeCitationText(rawText),
        parsed: null,
        candidates: [],
        provenance: ["empty_citation"],
      };
    }

    // A citation that names more than one instrument can never be resolved to
    // a single document.
    if (parsed.warnings.includes("multiple_instruments")) {
      return {
        status: "MULTIPLE_CANDIDATES",
        raw: rawText,
        normalized: parsed.normalized,
        parsed,
        candidates: [],
        provenance: ["multiple_instruments"],
      };
    }

    let contextDocument: ResolverDocument | null = null;
    if (context?.documentId) {
      contextDocument =
        this.documents.find((d) => d.id === context.documentId) ?? null;
      if (!contextDocument) {
        return {
          status: "NO_MATCH",
          raw: rawText,
          normalized: parsed.normalized,
          parsed,
          candidates: [],
          provenance: ["document_not_found"],
        };
      }
    }

    // A trailing ISO date is metadata, not part of the instrument's identity.
    let comparisonText = trimmed;
    const trailingDate = trimmed.match(TRAILING_DATE_PATTERN);
    if (trailingDate && typeof trailingDate.index === "number") {
      comparisonText = trimmed.slice(0, trailingDate.index).trim();
      parsed.components.year = trailingDate[1];
    }
    const normalizedComparison = normalizeCitationText(comparisonText);

    if (parsed.citationType === "PROVISION_REFERENCE") {
      return this.resolveProvision(rawText, parsed, contextDocument);
    }

    if (
      parsed.citationType === "UNKNOWN" &&
      parsed.warnings.includes("unrecognized_format")
    ) {
      const matches = this.identityCandidates(
        parsed,
        trimmed,
        normalizedComparison,
      );
      if (matches.length === 1) {
        return {
          status: matches[0].match === "ALIAS" ? "ALIAS" : "EXACT",
          raw: rawText,
          normalized: parsed.normalized,
          parsed,
          candidates: matches,
          provenance: [matches[0].provenance],
        };
      }
      if (matches.length > 1) {
        return {
          status: "MULTIPLE_CANDIDATES",
          raw: rawText,
          normalized: parsed.normalized,
          parsed,
          candidates: matches,
          provenance: matches.map((m) => m.provenance),
        };
      }
      return {
        status: "UNSUPPORTED_TYPE",
        raw: rawText,
        normalized: parsed.normalized,
        parsed,
        candidates: [],
        provenance: ["unsupported_citation"],
      };
    }

    const deduped = this.identityCandidates(
      parsed,
      trimmed,
      normalizedComparison,
    );

    let status: ResolutionStatus;
    if (deduped.length > 1) {
      status = "MULTIPLE_CANDIDATES";
    } else if (deduped.length === 1) {
      status = deduped[0].match === "ALIAS" ? "ALIAS" : "EXACT";
    } else {
      status = "NO_MATCH";
    }

    const resolution: CitationResolution = {
      status,
      raw: rawText,
      normalized: parsed.normalized,
      parsed,
      candidates: deduped,
      provenance: deduped.map((c) => c.provenance),
    };

    if (parsed.components.provisionLabel && deduped.length === 1) {
      const doc = this.documents.find((d) => d.id === deduped[0].documentId);
      if (!doc || !doc.provisions) {
        resolution.status = "PARTIAL";
        resolution.provenance.push("provision_not_found");
        return resolution;
      }

      const provMatches = findProvisionMatches(doc, parsed);
      if (provMatches.length === 0) {
        resolution.status = "PARTIAL";
        resolution.provenance.push("provision_not_found");
      } else if (provMatches.length === 1) {
        resolution.candidates.push({
          documentId: doc.id,
          provisionIdentityId: provMatches[0].provisionIdentityId,
          match: "PROVISION_LABEL",
          provenance: "provision_label",
        });
        resolution.provenance.push("provision_label");
      } else {
        resolution.status = "MULTIPLE_CANDIDATES";
        resolution.candidates.push(
          ...provMatches.map((m) => ({
            documentId: doc.id,
            provisionIdentityId: m.provisionIdentityId,
            match: "PROVISION_LABEL" as const,
            provenance: "provision_label",
          })),
        );
        resolution.provenance.push("provision_label");
      }
    } else if (parsed.components.subdivision) {
      // A container was named but no provision label could be applied.
      resolution.status = "PARTIAL";
      resolution.provenance.push("composite_container");
    }

    return resolution;
  }
}
