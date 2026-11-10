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
}

export interface SearchIndex {
  entries: IndexEntry[];
  docFreq: Map<string, number>;
  total: number;
}

const RRF_K = 60;
const MIN_LEXICAL = 0.02;
const IDENTIFIER_QUERY =
  /(\bg\.?r\.?\s*no\.?|\ba\.?m\.?\s*no\.?|\bact\s+no\.?|\brepublic\s+act\b|\bexecutive\s+order\b|\be\.?o\.?\s*no\.?)\s*\d/i;

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

export function buildSearchIndex(corpus: CorpusState): SearchIndex {
  const entries: IndexEntry[] = [];
  const docFreq = new Map<string, number>();

  for (const chunk of corpus.chunks) {
    const document = corpus.documents.find((d) => d.id === chunk.documentId);
    if (!document) continue;
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

function isLiveAt(entry: IndexEntry, asOf: string | undefined): boolean {
  if (!asOf) return true;
  if (entry.effectiveFrom && entry.effectiveFrom > asOf) return false;
  if (entry.effectiveTo && asOf >= entry.effectiveTo) return false;
  return true;
}

/** Retrieve passages. Deterministic for a given index and query. */
export function retrieve(
  index: SearchIndex,
  query: SearchQuery,
  defaultLimit = 10,
): SearchResult[] {
  const limit = query.limit ?? defaultLimit;
  const queryNormalized = normalizeKey(query.text);
  const queryTerms = tokenize(query.text);

  const candidates = index.entries.filter(
    (entry) =>
      matchesFilters(entry, query.filters) && isLiveAt(entry, query.asOfDate),
  );

  // Signal 1: exact identifier match (document-level).
  const exactRanking = candidates
    .filter((entry) => entry.exactKeys.some((key) => key === queryNormalized))
    .sort((a, b) => a.chunkId.localeCompare(b.chunkId));

  // Signal 2: lexical relevance.
  // Identifier-shaped queries are exact-only: if no identifier matches, returning
  // fuzzy neighbours would manufacture an authority that does not exist. If one
  // does match, lexical noise from unrelated documents is suppressed.
  const identifierQuery = IDENTIFIER_QUERY.test(query.text);
  if (exactRanking.length === 0 && identifierQuery) return [];
  const lexicalCandidates = identifierQuery
    ? candidates.filter((entry) =>
        exactRanking.some((exact) => exact.documentId === entry.documentId),
      )
    : candidates;

  const lexicalRanking = lexicalCandidates
    .map((entry) => ({ entry, score: lexicalScore(index, entry, queryTerms) }))
    .filter((item) => item.score >= MIN_LEXICAL)
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.chunkId.localeCompare(b.entry.chunkId),
    );

  // Fusion: reciprocal rank fusion over the two lists.
  const fused = new Map<
    string,
    { entry: IndexEntry; score: number; lexical: number; exact: boolean }
  >();
  exactRanking.forEach((entry, rank) => {
    fused.set(entry.chunkId, {
      entry,
      score: 1 / (RRF_K + rank + 1),
      lexical: 0,
      exact: true,
    });
  });
  lexicalRanking.forEach((item, rank) => {
    const current = fused.get(item.entry.chunkId);
    const contribution = 1 / (RRF_K + rank + 1);
    if (current) {
      current.score += contribution;
      current.lexical = item.score;
    } else {
      fused.set(item.entry.chunkId, {
        entry: item.entry,
        score: contribution,
        lexical: item.score,
        exact: false,
      });
    }
  });

  return [...fused.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.exact) - Number(a.exact) ||
        a.entry.chunkId.localeCompare(b.entry.chunkId),
    )
    .slice(0, limit)
    .map(({ entry, score, lexical, exact }) => {
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
        chunkId: entry.chunkId,
        score,
        passage: entry.content,
        metadata,
        scores: { lexical, semantic: 0, rerank: 0, authority: 0 },
      } satisfies SearchResult;
    });
}
