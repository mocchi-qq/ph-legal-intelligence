// @phli/legal-ingestion — deterministic extraction, normalization, segmentation
// No OCR, no ML. Anything this module cannot extract is reported, never invented.

export interface ExtractResult {
  text: string;
  normalizedText: string;
  ocrUsed: boolean;
  warnings: string[];
}

const HTML_BLOCK =
  /<\/(p|div|section|article|li|tr|h[1-6]|blockquote|table|ul|ol)>/gi;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  sect: "§",
  para: "¶",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, body: string) => {
      if (body.startsWith("#")) {
        const hex = body[1]?.toLowerCase() === "x";
        const code = Number.parseInt(
          hex ? body.slice(2) : body.slice(1),
          hex ? 16 : 10,
        );
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

/** Extract readable text from an HTML or plain-text artifact. */
export function extractText(content: string, mimeType: string): ExtractResult {
  const warnings: string[] = [];
  let raw = content;

  if (mimeType === "text/html" || mimeType === "application/xhtml+xml") {
    raw = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(HTML_BLOCK, "$&\n")
      .replace(/<[^>]+>/g, " ");
    raw = decodeHtmlEntities(raw);
  } else if (mimeType !== "text/plain") {
    warnings.push(`unsupported_mime:${mimeType}`);
  }

  const normalizedText = normalizeText(raw);
  if (normalizedText.length === 0) warnings.push("empty_extraction");
  if (normalizedText.length > 0 && normalizedText.length < 40) {
    warnings.push("suspiciously_short_extraction");
  }

  return { text: raw, normalizedText, ocrUsed: false, warnings };
}

/** Normalize whitespace without repairing wording. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ProvisionSeed {
  provisionType: string;
  label: string;
  text: string;
  ordinal: number;
  startOffset: number;
  endOffset: number;
}

const LAW_LIKE = new Set([
  "CONSTITUTION",
  "STATUTE",
  "REPUBLIC_ACT",
  "COMMONWEALTH_ACT",
  "PRESIDENTIAL_DECREE",
  "BATAS_PAMBANSA",
  "EXECUTIVE_ORDER",
  "ADMINISTRATIVE_ORDER",
  "AGENCY_REGULATION",
  "COURT_RULE",
  "COURT_CIRCULAR",
  "TREATY",
  "LOCAL_ORDINANCE",
]);

const HEADING =
  /(?:^|\n)[ \t]*(Section[ \t]+[0-9]+[A-Za-z0-9-]*|SECTION[ \t]+[0-9]+[A-Za-z0-9-]*|SEC\.[ \t]+[0-9]+[A-Za-z0-9-]*|Article[ \t]+[IVXLC]+|ARTICLE[ \t]+[IVXLC]+|Rule[ \t]+[0-9.]+)[.):]?[ \t]*/g;

/** Split a legal instrument into provisions, preserving offsets into normalized text. */
export function segmentProvisions(
  normalizedText: string,
  documentType: string,
): ProvisionSeed[] {
  if (normalizedText.length === 0) return [];

  if (LAW_LIKE.has(documentType)) {
    const matches = [...normalizedText.matchAll(HEADING)];
    if (matches.length === 0) {
      return [
        {
          provisionType: "SECTION",
          // Non-committal: no heading was found, so no section number is invented.
          label: "unsegmented",
          text: normalizedText,
          ordinal: 1,
          startOffset: 0,
          endOffset: normalizedText.length,
        },
      ];
    }

    const seeds: ProvisionSeed[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const start = match.index ?? 0;
      const bodyStart = start + match[0].length;
      const end =
        i + 1 < matches.length
          ? (matches[i + 1]!.index ?? normalizedText.length)
          : normalizedText.length;
      const rawBody = normalizedText.slice(bodyStart, end);
      const leading = rawBody.length - rawBody.trimStart().length;
      const body = rawBody.trim();
      const startOffset = bodyStart + leading;
      const endOffset = startOffset + body.length;
      const label = match[1]!.replace(/\s+/g, " ").trim();
      const upper = label.toUpperCase();
      seeds.push({
        provisionType: upper.startsWith("ARTICLE")
          ? "ARTICLE"
          : upper.startsWith("RULE")
            ? "RULE"
            : "SECTION",
        label,
        text: body.length > 0 ? body : label,
        ordinal: i + 1,
        // The span covers exactly the body text; an empty body falls back to
        // the heading label, so the span covers the label's length at bodyStart.
        startOffset: body.length > 0 ? startOffset : bodyStart,
        endOffset: body.length > 0 ? endOffset : bodyStart + label.length,
      });
    }
    return seeds;
  }

  // Decisions and other prose instruments: paragraph-level segmentation.
  const seeds: ProvisionSeed[] = [];
  const parts = [...normalizedText.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)];
  let ordinal = 0;
  for (const part of parts) {
    const text = part[0].trim();
    if (text.length === 0) continue;
    const start = part.index ?? 0;
    seeds.push({
      provisionType: "PARAGRAPH",
      label: `¶ ${ordinal + 1}`,
      text,
      ordinal: ordinal + 1,
      startOffset: start,
      endOffset: start + part[0].length,
    });
    ordinal++;
  }
  return seeds;
}

export interface ChunkSeed {
  provisionOrdinal: number;
  chunkKind: string;
  chunkIndex: number;
  content: string;
  charStart: number;
  charEnd: number;
}

const MAX_CHUNK = 900;

/** Split provisions into retrievable chunks, keeping offsets to the normalized text. */
export function segmentChunks(provisions: ProvisionSeed[]): ChunkSeed[] {
  const chunks: ChunkSeed[] = [];
  for (const provision of provisions) {
    if (provision.text.length <= MAX_CHUNK) {
      chunks.push({
        provisionOrdinal: provision.ordinal,
        chunkKind: "provision",
        chunkIndex: chunks.length,
        content: provision.text,
        charStart: provision.startOffset,
        charEnd: provision.endOffset,
      });
      continue;
    }

    // Sentence-bounded split. Sentence positions are tracked against
    // provision.text so each chunk's span describes its own content instead of
    // inheriting the provision's span.
    const sentences = provision.text.split(/(?<=[.;:])\s+/);
    let buffer = "";
    let bufferStart = 0;
    let searchFrom = 0;
    const pushBuffer = () => {
      const content = buffer.trim();
      const lead = buffer.length - buffer.trimStart().length;
      const charStart = provision.startOffset + bufferStart + lead;
      chunks.push({
        provisionOrdinal: provision.ordinal,
        chunkKind: "provision",
        chunkIndex: chunks.length,
        content,
        charStart,
        charEnd: charStart + content.length,
      });
      buffer = "";
    };
    for (const sentence of sentences) {
      // Locate this sentence in order: searching from just past the previous
      // one keeps repeated sentence text from resolving to an earlier match.
      const at = provision.text.indexOf(sentence, searchFrom);
      const position = at === -1 ? searchFrom : at;
      searchFrom = position + sentence.length;
      if (
        buffer.length > 0 &&
        buffer.length + sentence.length + 1 > MAX_CHUNK
      ) {
        pushBuffer();
      }
      if (buffer.length === 0) bufferStart = position;
      buffer += `${buffer ? " " : ""}${sentence}`;
    }
    if (buffer.trim().length > 0) pushBuffer();
  }
  return chunks;
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

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§¶.]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}
