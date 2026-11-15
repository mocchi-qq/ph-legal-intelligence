// @phli/legal-search — bounded, deterministic retrieval
// Gate 1. See docs/gates/gate-1/06_RETRIEVAL_REPORT.md
//
// Implemented signals: exact identifier, lexical (TF-IDF), metadata filters,
// point-in-time version selection, reciprocal rank fusion.
// NOT implemented: semantic/vector retrieval and cross-encoder reranking.
// These are reported as untested rather than implied to work.

import type {
  CorpusState,
  DocumentActivityAuthorization,
  DocumentActivityDecision,
} from "@phli/legal-ingestion";
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

/**
 * A built, searchable index.
 *
 * The index enforces `search_indexing` authorization at BUILD time only:
 * `buildSearchIndex` asks once per document and indexes the document only when
 * the answer is `AUTHORIZED`. `retrieve` performs no read-time authorization,
 * so every chunk in `entries` is searchable and merely holding an index is
 * sufficient to search it. A caller that needs `viewing` or `citation_display`
 * enforced must check those activities itself, for its own request, before it
 * returns or displays results.
 */
export interface SearchIndex {
  entries: IndexEntry[];
  docFreq: Map<string, number>;
  total: number;
  /**
   * One decision per document that had at least one chunk and whose
   * `search_indexing` decision was not `AUTHORIZED`, sorted by `documentId`.
   * A document with no chunks was never evaluated — the build authorizes from
   * the chunk list — so it does not appear here, and its absence is not a grant.
   * The decision is kept so a refusal is visible rather than silently skipped;
   * decisions for authorized documents are not retained.
   */
  excludedDocuments: DocumentActivityDecision[];
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

export interface IndexBuildOptions {
  /**
   * Required. Consulted once per document, for the `search_indexing` activity
   * with role `TARGET`. The activity is fixed by this builder, so a caller
   * cannot index under a different one, and the answer is a whole
   * `DocumentActivityDecision` rather than a bare boolean.
   */
  authorization: DocumentActivityAuthorization;
}

/**
 * A decision a resolver returned in a shape this build cannot read. Exclusion
 * is the only safe reading of an unreadable answer, and it is still reported.
 * `reason` names the check that failed; document, activity and role are the
 * build's own question, never the resolver's claim.
 */
function unusableDecision(
  documentId: string,
  reason: string,
): DocumentActivityDecision {
  return {
    documentId,
    activity: "search_indexing",
    role: "TARGET",
    decision: "NOT_CHECKED",
    sourceId: null,
    status: null,
    reason,
    decisionRef: null,
  };
}

/** The only decisions the projection vocabulary defines. */
const CANONICAL_DECISIONS: ReadonlySet<string> = new Set<string>([
  "AUTHORIZED",
  "UNAUTHORIZED",
  "NOT_CHECKED",
]);

function isCanonicalDecision(
  value: unknown,
): value is DocumentActivityDecision["decision"] {
  return typeof value === "string" && CANONICAL_DECISIONS.has(value);
}

/**
 * Normalise whatever the resolver returned into a decision this build may act
 * on. Gate 13 removed the bare `AUTHORIZED` scalar from the authority
 * projection; this is the same bypass at the index boundary, so an answer is
 * usable only when every part of it agrees with the question actually asked:
 *
 * - `invalid_decision` — not an object, or `decision` is not a canonical
 *   literal. Without this, a JavaScript caller (or a cast) hands back
 *   `{ decision: "AUTHORIZED" }` and the document is indexed with nothing
 *   checked.
 * - `unknown_activity` — `activity` is missing or not a string.
 * - `activity_mismatch` — `activity` is a string but not `search_indexing`.
 * - `document_mismatch` — `documentId` is missing, not a string, or a
 *   different document.
 *
 * Anything else is a fail-closed NOT_CHECKED. The identity fields of the
 * returned decision are always the build's, so a resolver cannot relabel which
 * document and activity it answered.
 */
function asDecision(
  documentId: string,
  value: unknown,
): DocumentActivityDecision {
  if (typeof value !== "object" || value === null)
    return unusableDecision(documentId, "invalid_decision");
  const answer = value as Record<string, unknown>;
  if (!isCanonicalDecision(answer.decision))
    return unusableDecision(documentId, "invalid_decision");
  const activity = answer.activity;
  if (typeof activity !== "string")
    return unusableDecision(documentId, "unknown_activity");
  if (activity !== "search_indexing")
    return unusableDecision(documentId, "activity_mismatch");
  const claimedDocumentId = answer.documentId;
  if (
    typeof claimedDocumentId !== "string" ||
    claimedDocumentId.trim() === "" ||
    claimedDocumentId !== documentId
  )
    return unusableDecision(documentId, "document_mismatch");
  return {
    ...(answer as unknown as DocumentActivityDecision),
    documentId,
    activity: "search_indexing",
    role: "TARGET",
  };
}

/**
 * Build a searchable index from the corpus, asking `search_indexing` for each
 * document and refusing it unless the answer is `AUTHORIZED`.
 *
 * This is the only place that authorization is enforced: `retrieve` does no
 * read-time check, so the built index is searchable by whoever holds it.
 *
 * The per-document memo is keyed by document id because this build fixes the
 * activity (`search_indexing`) and the role (`TARGET`) for every call, so one
 * document can only be asked one question here. A build that varied the
 * activity per call would need a memo keyed by document and activity.
 */
export function buildSearchIndex(
  corpus: CorpusState,
  options: IndexBuildOptions,
): SearchIndex {
  if (typeof options?.authorization !== "function")
    throw new Error("index_authorization_required");
  const authorization = options.authorization;
  const entries: IndexEntry[] = [];
  const docFreq = new Map<string, number>();
  // Authorization is a property of a document, not of each of its chunks, so
  // each document is asked once and every chunk inherits that one answer. A
  // document is therefore indexed entirely or not at all.
  const decisions = new Map<string, DocumentActivityDecision>();
  const decide = (documentId: string): DocumentActivityDecision => {
    const cached = decisions.get(documentId);
    if (cached !== undefined) return cached;
    const decision = asDecision(
      documentId,
      authorization({
        documentId,
        activity: "search_indexing",
        role: "TARGET",
      }),
    );
    decisions.set(documentId, decision);
    return decision;
  };

  for (const chunk of corpus.chunks) {
    const document = corpus.documents.find((d) => d.id === chunk.documentId);
    if (!document) continue;
    if (decide(document.id).decision !== "AUTHORIZED") continue;
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

  // Sorted so the report of what was refused is deterministic regardless of the
  // order chunks happen to arrive in.
  const excludedDocuments = [...decisions.values()]
    .filter((decision) => decision.decision !== "AUTHORIZED")
    .sort((a, b) =>
      a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0,
    );

  return { entries, docFreq, total: entries.length, excludedDocuments };
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
  // restates the identifier. It serves only as an ordering tie-breaker — within
  // the exact ranking, and again in the final fused sort — and is not exposed on
  // `SearchResult`, so callers see only the document-level `exactMatch`.
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
    .map(({ entry, score, lexical }) => {
      // `exactMatch` is document-level: the passage's document matched the
      // identifier, whether or not this passage repeats it. Passage-level
      // repetition is tracked separately as `exactPassage` and is used only
      // for ordering, never returned.
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
