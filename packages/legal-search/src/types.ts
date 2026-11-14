// @phli/legal-search — Search and retrieval domain types
// Responsibility: see docs/architecture/SEARCH_SPECIFICATION.md
//
// These interfaces describe the hybrid retrieval contract: a query is answered
// by running lexical and semantic retrieval in parallel over the same corpus,
// filtering by metadata, fusing the ranked lists and reranking the survivors.
// Nothing here is bound to a provider — the Cloudflare Vectorize / AI Search
// implementation is an adapter behind `RetrievalConfig` and the search service.

/**
 * The retrieval shape a query asks for. The mode selects the ranking policy,
 * the breadth of fan-out and the answer format the orchestrator should target.
 *
 * - `quick` — one-shot, low-latency lookup.
 * - `standard` — default hybrid retrieval with reranking.
 * - `deep` — iterative, multi-query fan-out for hard research questions.
 * - `comparison` — retrieve across several documents to contrast them.
 * - `statutory` — weight exact provision/phrase matching over semantics.
 * - `educational` — retrieval biased toward teaching material and doctrine.
 * - `professional` — retrieval biased toward authoritative, verified sources.
 */
export type RetrievalMode =
  | "quick"
  | "standard"
  | "deep"
  | "comparison"
  | "statutory"
  | "educational"
  | "professional";

/** How two or more ranked lists are combined into one. */
export type RankFusionMethod =
  | "reciprocal_rank_fusion"
  | "weighted_score"
  | "max_score";

/**
 * A user query. `text` is always present; structured filters and a temporal
 * anchor narrow the corpus without changing the query text.
 */
export interface SearchQuery {
  /** The natural-language or structured query, e.g. `G.R. No. 123456`. */
  text: string;
  /** The retrieval shape; drives ranking policy and breadth. */
  mode: RetrievalMode;
  /** Optional structured narrowing, applied before ranking. */
  filters?: SearchFilters;
  /** ISO-8601 date for point-in-time (as-of) retrieval. */
  asOfDate?: string;
  /** Maximum results the caller wants back, after reranking. */
  limit?: number;
  /** Tenant scope. Retrieval must never cross this boundary. */
  tenantId?: string;
}

/**
 * Structured, pre-ranking constraints. Every field is an AND across fields and
 * an OR within a field's array. All are matched against `ChunkMetadata`.
 */
export interface SearchFilters {
  /** Issuing court, e.g. `Supreme Court`, `Court of Appeals`. */
  court?: string[];
  /** `DocumentType` values, e.g. `REPUBLIC_ACT`, `COURT_DECISION`. */
  documentType?: string[];
  /** Jurisdiction codes, e.g. `PH`, a local government unit code. */
  jurisdiction?: string[];
  /** Inclusive promulgation/publication date range. */
  dateRange?: { from: string; to: string };
  /** Issuing agency or body, e.g. `BIR`, `SEC`, `DOLE`. */
  agency?: string[];
  /** Subject-matter tags. */
  topic?: string[];
  /** `VerificationStatus` values used to gate trust. */
  verificationStatus?: string[];
}

/** One ranked, retrievable passage returned to the caller. */
export interface SearchResult {
  /** Canonical document the passage belongs to. */
  documentId: string;
  /** Human-readable citation for the document, where known. */
  citationText: string | null;
  /** The specific retrievable chunk. */
  chunkId: string;
  /** Fused, reranked relevance in [0, 1]. */
  score: number;
  /** The passage text, ready for grounding a model answer. */
  passage: string;
  /** Denormalised metadata used for filtering, display and ranking. */
  metadata: ChunkMetadata;
  /** Version of the document the passage was retrieved from. */
  versionId: string;
  /** Provision the chunk belongs to, where known. */
  provisionId: string | null;
  /** Point-in-time start of the version's validity (ISO date), where known. */
  effectiveFrom: string | null;
  /** Point-in-time end of the version's validity (ISO date), where known. */
  effectiveTo: string | null;
  /** Character offsets of the passage within its source text, where known. */
  span: { charStart: number; charEnd: number } | null;
  /** Traceable origin of the passage: source, document, version, provision, chunk. */
  provenance: {
    sourceId: string;
    documentId: string;
    versionId: string;
    provisionId: string | null;
    chunkId: string;
  };
  /**
   * True when this passage's document matched an exact identifier query. This
   * is document-level, not a claim that the passage contains the identifier.
   */
  exactMatch: boolean;
  /**
   * Whether the passage's document matched the query's identifier, even if this
   * particular passage does not repeat it.
   */
  exactDocumentMatch: boolean;
  /** Per-signal breakdown, for debugging and evaluation traces. */
  scores?: RetrievalScoreBreakdown;
}

/** The per-signal contributions that produced a result's fused score. */
export interface RetrievalScoreBreakdown {
  lexical?: number;
  semantic?: number;
  rerank?: number;
  authority?: number;
}

/**
 * Denormalised, filterable metadata carried alongside every chunk in the index.
 * Mirrors the `DocumentChunk` model in `@phli/legal-schema` and is the unit of
 * metadata filtering.
 */
export interface ChunkMetadata {
  documentId: string;
  /** `DocumentType` value. */
  documentType: string;
  /** Issuing court, where applicable. */
  court?: string;
  /** Jurisdiction code. */
  jurisdiction: string;
  /** Year of the instrument's controlling date. */
  year: number;
  /** Source registry identifier the chunk was acquired from. */
  sourceId: string;
  /** `VerificationStatus` value. */
  verificationStatus: string;
  /** `AuthorityLevel` value, used by the authority ranking policy. */
  authorityLevel?: string;
  /** Provision/section label, where known. */
  provisionLabel?: string;
  /** Point-in-time validity anchor (ISO date), where known. */
  asOfDate?: string;
  /** Subject-matter tags. */
  topic?: string[];
}

/**
 * Tunable weights and cut-offs for one retrieval run. Defaults are chosen so
 * lexical and semantic contribute equally before reranking, and so only a small
 * candidate set is reranked.
 */
export interface RetrievalConfig {
  /** Weight applied to the lexical (keyword/BM25-style) list. */
  lexicalWeight: number;
  /** Weight applied to the semantic (vector) list. */
  semanticWeight: number;
  /** How many fused candidates are sent to the reranker. */
  rerankTopK: number;
  /** How many reranked results are returned to the caller. */
  finalTopK: number;
  /** Fusion strategy for combining the ranked lists. */
  fusion?: RankFusionMethod;
  /** Optional model identifier used by the reranker. */
  rerankModel?: string;
}
