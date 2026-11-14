// @phli/legal-search — bounded, deterministic retrieval
// Gate 1. See docs/gates/gate-1/06_RETRIEVAL_REPORT.md
//
// Implemented signals: exact identifier, lexical (TF-IDF), metadata filters,
// point-in-time version selection, reciprocal rank fusion.
// NOT implemented: semantic/vector retrieval and cross-encoder reranking.
// These are reported as untested rather than implied to work.

import type { CorpusState } from "@phli/legal-ingestion";
import type {
  ChunkMetadata,
  SearchFilters,
  SearchQuery,
  SearchResult,
} from "./types";

export interface IndexEntry {
  chunkId: string;
  documentId: string;
  /** Zero-based position of the chunk within its document version. */
  chunkIndex: number;
  citationText: string | null;
  versionId: string;
  provisionId: string | null;
  provisionLabel: string | null;
  content: string;
  termFreq: Map<string, number>;
  length: number;
  exactKeys: string[];
  documentType: string;
  title: string;
  court: string | null;
  agency: string | null;
  jurisdiction: string;
  sourceId: string;
  verificationStatus: string;
  legalStatus: string;
  authorityLevel: string;
  year: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  charStart: number | null;
  charEnd: number | null;
}

export interface SearchIndex {
  entries: IndexEntry[];
  docFreq: Map<string, number>;
  total: number;
}

const RRF_K = 60;
const MIN_LEXICAL = 0.02;
// At least half of the query's content terms must occur in the passage. This
// rejects weak shared-token matches (e.g. one common word) without a corpus-
// specific score threshold.
const MIN_TERM_COVERAGE = 0.3;
// An identifier-only query (the query *is* a citation), as opposed to a
// natural-language question that merely cites one. Used to decide whether
// neighbouring documents may still be retrieved lexically.
const IDENTIFIER_ONLY_QUERY =
  /^(?:\S+\s+){0,2}(?:g\.?\s*r\.?|gr|r\.?\s*a\.?|ra|republic\s+act|e\.?\s*o\.?|eo|executive\s+order|p\.?\s*d\.?|pd|presidential\s+decree|b\.?\s*p\.?|bp|batas\s+pambansa|c\.?\s*a\.?|ca|commonwealth\s+act|a\.?\s*m\.?|am|act\s+no\.?)(?!\w)[^\n]{0,40}\d/i;

// A typed legal identifier anywhere in the query, not only at its start: a
// party name followed by a full citation is still an identifier query.
function hasTypedIdentifier(text: string): boolean {
  return (
    /\b(?:G\.\s*R\.|R\.?\s*A\.?|E\.?\s*O\.?|P\.?\s*D\.?|A\.?\s*O\.?|M\.?\s*C\.?|A\.?\s*M\.?|B\.?\s*P\.?|C\.?\s*A\.?)\s*(?:NO\.?)?\s*[0-9]/i.test(
      text,
    ) ||
    /\b(?:REPUBLIC\s+ACT|EXECUTIVE\s+ORDER|PRESIDENTIAL\s+DECREE|ADMINISTRATIVE\s+ORDER|MEMORANDUM\s+CIRCULAR|BATAS\s+PAMBANSA|COMMONWEALTH\s+ACT)\b/i.test(
      text,
    )
  );
}

/**
 * Is the query an identifier lookup, rather than a question that merely cites
 * an identifier? Interrogative and imperative openers ("which law amended
 * Republic Act No. 1002", "find RA 1001") keep their lexical neighbours; only
 * a bare citation is treated as exact-only.
 */
export function isIdentifierQuery(text: string): boolean {
  const trimmed = text.trim();
  if (
    /^(which|what|who|when|where|why|how|does|do|is|are|was|were|explain|find|summari[sz]e|tell|list|show)\b/i.test(
      trimmed,
    )
  )
    return false;
  return hasTypedIdentifier(trimmed);
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

/** Local copy of the shared tokenizer, kept dependency-free for the search package. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§¶.]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Exact query aliases, e.g. `RA 12325` -> the canonical Republic Act key. The
 * forms match anywhere in the query, so a citation embedded after a party name
 * or inside a question is canonicalised the same way as a bare one.
 */
function queryKeys(text: string): string[] {
  const keys = new Set<string>([normalizeKey(text)]);
  const forms: Array<[RegExp, string]> = [
    [
      /\b(?:r\.?\s*a\.?|ra|republic\s+act)(?:\s+no\.?)?\s*(\d{1,5})\b/i,
      "republicact",
    ],
    [
      /\b(?:e\.?\s*o\.?|eo|executive\s+order)(?:\s+no\.?)?\s*(\d{1,5})\b/i,
      "executiveorder",
    ],
    [
      /\b(?:p\.?\s*d\.?|pd|presidential\s+decree)(?:\s+no\.?)?\s*(\d{1,5})\b/i,
      "presidentialdecree",
    ],
    [
      /\b(?:b\.?\s*p\.?|bp|batas\s+pambansa)(?:\s+(?:blg\.?|no\.?))?\s*(\d{1,5})\b/i,
      "bataspambansa",
    ],
    [
      /\b(?:c\.?\s*a\.?|ca|commonwealth\s+act)(?:\s+no\.?)?\s*(\d{1,5})\b/i,
      "commonwealthact",
    ],
    [/\b(?:g\.?\s*r\.?|gr)(?:\s+no\.?)?\s*(\d{1,6})\b/i, "grno"],
  ];
  for (const [re, prefix] of forms) {
    const match = re.exec(text);
    if (match) keys.add(`${prefix}${match[1]}`);
  }
  return [...keys];
}

function yearOf(date: string | null | undefined): number {
  if (!date) return 0;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : 0;
}

function matchesFilters(
  entry: IndexEntry,
  filters: SearchFilters | undefined,
): boolean {
  if (!filters) return true;
  if (
    filters.documentType &&
    !filters.documentType.includes(entry.documentType)
  )
    return false;
  if (filters.court && entry.court && !filters.court.includes(entry.court))
    return false;
  if (filters.agency && entry.agency && !filters.agency.includes(entry.agency))
    return false;
  if (
    filters.jurisdiction &&
    !filters.jurisdiction.includes(entry.jurisdiction)
  )
    return false;
  if (
    filters.verificationStatus &&
    !filters.verificationStatus.includes(entry.verificationStatus)
  )
    return false;
  if (filters.dateRange) {
    const from = yearOf(filters.dateRange.from);
    const to = yearOf(filters.dateRange.to);
    if (entry.year < from || entry.year > to) return false;
  }
  return true;
}

export interface IndexAuthorizationRequest {
  documentId: string;
  sourceId: string;
}

export interface IndexAuthorizationDecision {
  allowed: boolean;
  reason?: string;
}

export interface IndexBuildOptions {
  /** Required. Called before each document's chunks are indexed. */
  authorize: (request: IndexAuthorizationRequest) => IndexAuthorizationDecision;
}

export function buildSearchIndex(
  corpus: CorpusState,
  options: IndexBuildOptions,
): SearchIndex {
  if (!options?.authorize) throw new Error("index_authorization_required");
  const entries: IndexEntry[] = [];
  const docFreq = new Map<string, number>();

  for (const chunk of corpus.chunks) {
    const document = corpus.documents.find((d) => d.id === chunk.documentId);
    if (!document) continue;
    const authorization = options.authorize({
      documentId: document.id,
      sourceId: document.sourceId ?? "unknown",
    });
    if (!authorization.allowed) continue;
    const version = corpus.versions.find((v) => v.id === chunk.versionId);
    const provision = chunk.provisionId
      ? corpus.provisions.find((p) => p.id === chunk.provisionId)
      : undefined;
    const terms = tokenize(chunk.content);
    const termFreq = new Map<string, number>();
    for (const term of terms) termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    for (const term of termFreq.keys())
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);

    entries.push({
      chunkId: chunk.id,
      documentId: document.id,
      chunkIndex: chunk.chunkIndex,
      citationText:
        document.citationText ??
        document.docketNumber ??
        document.identityKey ??
        document.title,
      versionId: chunk.versionId ?? version?.id ?? "",
      provisionId: chunk.provisionId ?? null,
      provisionLabel: provision?.label ?? null,
      content: chunk.content,
      termFreq,
      length: terms.length,
      exactKeys: [
        normalizeKey(document.docketNumber ?? ""),
        normalizeKey(document.citationText ?? ""),
        normalizeKey(document.identityKey ?? ""),
        normalizeKey(document.title),
      ].filter((key) => key.length > 0),
      documentType: document.documentType,
      title: document.title,
      court: document.issuingBody ?? null,
      agency: document.issuingBody ?? null,
      jurisdiction: document.jurisdiction ?? "PH",
      sourceId: document.sourceId ?? "unknown",
      verificationStatus: document.verificationStatus,
      legalStatus: document.legalStatus,
      authorityLevel: document.authorityLevel,
      year: yearOf(
        document.promulgationDate ??
          document.approvalDate ??
          version?.effectiveFrom ??
          null,
      ),
      effectiveFrom: version?.effectiveFrom ?? null,
      effectiveTo: version?.effectiveTo ?? null,
      charStart: chunk.charStart ?? null,
      charEnd: chunk.charEnd ?? null,
    });
  }

  return { entries, docFreq, total: entries.length };
}

function idf(index: SearchIndex, term: string): number {
  const df = index.docFreq.get(term) ?? 0;
  return Math.log(1 + index.total / (1 + df));
}

function lexicalScore(
  index: SearchIndex,
  entry: IndexEntry,
  queryTerms: string[],
): number {
  if (queryTerms.length === 0) return 0;
  let dot = 0;
  let entryNorm = 0;
  for (const [term, tf] of entry.termFreq) {
    const weight = (1 + Math.log(tf)) * idf(index, term);
    entryNorm += weight * weight;
  }
  for (const term of queryTerms) {
    const tf = entry.termFreq.get(term);
    if (tf === undefined) continue;
    dot += (1 + Math.log(tf)) * idf(index, term) * idf(index, term);
  }
  if (entryNorm === 0) return 0;
  return dot / Math.sqrt(entryNorm);
}

// Generic legal vocabulary is ignored when measuring coverage; matching only
// "act" or "data" is not evidence that the passage is about the query.
const COVERAGE_GENERIC = new Set([
  "act",
  "law",
  "code",
  "section",
  "republic",
  "philippines",
  "data",
]);

function termCoverage(entry: IndexEntry, queryTerms: string[]): number {
  const terms = queryTerms.filter((term) => !COVERAGE_GENERIC.has(term));
  if (terms.length === 0) return 1;
  let present = 0;
  for (const term of terms) if (entry.termFreq.has(term)) present += 1;
  return present / terms.length;
}

function isLiveAt(entry: IndexEntry, asOf: string | undefined): boolean {
  if (!asOf) return true;
  // A null effectiveFrom is an unknown start, not an open one: a version whose
  // commencement is unrecorded cannot be shown to be in force at any date.
  // A null effectiveTo is an open end (no recorded end date) and stays live.
  if (entry.effectiveFrom === null) return false;
  if (entry.effectiveFrom > asOf) return false;
  if (entry.effectiveTo !== null && asOf >= entry.effectiveTo) return false;
  return true;
}

/** Retrieve passages. Deterministic for a given index and query. */
export function retrieve(
  index: SearchIndex,
  query: SearchQuery,
  defaultLimit = 10,
): SearchResult[] {
  const limit = query.limit ?? defaultLimit;
  const queryNormalized = queryKeys(query.text);
  const queryTerms = tokenize(query.text);

  const candidates = index.entries.filter(
    (entry) =>
      matchesFilters(entry, query.filters) && isLiveAt(entry, query.asOfDate),
  );

  // Signal 1: exact identifier match. A document-level match decides whether the
  // document was cited; `exactPassage` records whether this particular passage
  // restates the identifier, so callers are never told a blank passage is exact.
  const queryKeySet = new Set(queryNormalized);
  const exactRanking = candidates
    .filter((entry) => entry.exactKeys.some((key) => queryKeySet.has(key)))
    .map((entry) => ({
      entry,
      exactPassage: Array.from(queryKeySet).some(
        (key) => key.length >= 6 && normalizeKey(entry.content).includes(key),
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.exactPassage) - Number(a.exactPassage) ||
        a.entry.chunkId.localeCompare(b.entry.chunkId),
    );

  // Signal 2: lexical relevance.
  // Identifier-shaped queries are exact-only: if no identifier matches, returning
  // fuzzy neighbours would manufacture an authority that does not exist. If one
  // does match, lexical noise from unrelated documents is suppressed. A question
  // that merely cites an identifier ("which law amended RA 1001") keeps its
  // lexical neighbours, because the citing/amending instruments are the answer.
  const identifierQuery = isIdentifierQuery(query.text);
  if (exactRanking.length === 0 && identifierQuery) return [];
  const exactDocumentIds = new Set(
    exactRanking.map((item) => item.entry.documentId),
  );
  const lexicalCandidates = IDENTIFIER_ONLY_QUERY.test(query.text)
    ? candidates.filter((entry) => exactDocumentIds.has(entry.documentId))
    : candidates;

  const lexicalRanking = lexicalCandidates
    .map((entry) => ({ entry, score: lexicalScore(index, entry, queryTerms) }))
    .filter(
      (item) =>
        item.score >= MIN_LEXICAL &&
        termCoverage(item.entry, queryTerms) >= MIN_TERM_COVERAGE,
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.chunkId.localeCompare(b.entry.chunkId),
    );

  // Fusion: reciprocal rank fusion over the two lists.
  const fused = new Map<
    string,
    {
      entry: IndexEntry;
      score: number;
      lexical: number;
      exactPassage: boolean;
    }
  >();
  exactRanking.forEach((item, rank) => {
    fused.set(item.entry.chunkId, {
      entry: item.entry,
      score: 1 / (RRF_K + rank + 1),
      lexical: 0,
      exactPassage: item.exactPassage,
    });
  });
  lexicalRanking.forEach((item, rank) => {
    const current = fused.get(item.entry.chunkId);
    const contribution = 1 / (RRF_K + rank + 1);
    if (current) {
      current.score += contribution;
      current.lexical = item.score;
      // Nothing here adds passage evidence, so exactPassage survives unchanged:
      // it stays true if either list already found the identifier.
    } else {
      fused.set(item.entry.chunkId, {
        entry: item.entry,
        score: contribution,
        lexical: item.score,
        // A lexical-only hit did not match an identifier; never claim it did.
        exactPassage: false,
      });
    }
  });

  return [...fused.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.exactPassage) - Number(a.exactPassage) ||
        a.entry.chunkId.localeCompare(b.entry.chunkId),
    )
    .slice(0, limit)
    .map(({ entry, score, lexical, exactPassage }) => {
      // Document-level: the passage's document matched the identifier, whether
      // or not this particular passage repeats it. Passage-level truthfulness is
      // separate: `exactMatch` additionally requires the number in the text.
      const exact = exactDocumentIds.has(entry.documentId);
      const metadata: ChunkMetadata = {
        documentId: entry.documentId,
        documentType: entry.documentType,
        court: entry.court ?? undefined,
        jurisdiction: entry.jurisdiction,
        year: entry.year,
        sourceId: entry.sourceId,
        verificationStatus: entry.verificationStatus,
        authorityLevel: entry.authorityLevel,
        provisionLabel: entry.provisionLabel ?? undefined,
        asOfDate: query.asOfDate,
      };
      return {
        documentId: entry.documentId,
        citationText: entry.citationText,
        chunkId: entry.chunkId,
        score,
        passage: entry.content,
        metadata,
        versionId: entry.versionId,
        provisionId: entry.provisionId,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: entry.effectiveTo,
        span:
          entry.charStart !== null && entry.charEnd !== null
            ? { charStart: entry.charStart, charEnd: entry.charEnd }
            : null,
        provenance: {
          sourceId: entry.sourceId,
          documentId: entry.documentId,
          versionId: entry.versionId,
          provisionId: entry.provisionId,
          chunkId: entry.chunkId,
        },
        exactMatch: exact,
        scores: { lexical, semantic: 0, rerank: 0, authority: 0 },
      } satisfies SearchResult;
    });
}
