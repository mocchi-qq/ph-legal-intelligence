import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import type {
  SearchQuery,
  SearchFilters,
  SearchResult,
  ChunkMetadata,
  RetrievalConfig,
} from '../../packages/legal-search/src/index';
import type {
  GenerationRequest,
  GenerationResult,
  ModelProvider,
  ResearchAnswer,
} from '../../packages/ai-orchestrator/src/index';

const searchDocPath = join(process.cwd(), 'docs/architecture/SEARCH_SPECIFICATION.md');
const researchDocPath = join(process.cwd(), 'docs/architecture/AI_RESEARCH_SPECIFICATION.md');

function readDoc(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('Search specification', () => {
  it('documents the hybrid retrieval architecture', () => {
    const doc = readDoc(searchDocPath);
    expect(doc).toMatch(/hybrid retrieval/i);
    expect(doc).toMatch(/lexical|keyword/i);
    expect(doc).toMatch(/semantic/i);
    expect(doc).toMatch(/metadata filter/i);
    expect(doc).toMatch(/rerank|rank fusion/i);
    expect(doc).toMatch(/authority ranking/i);
  });

  it('specifies lexical search for G.R. numbers, RA numbers and exact case names', () => {
    const doc = readDoc(searchDocPath);
    expect(doc).toMatch(/G\.R\.\s*(?:No\.)?|G\.R\. number/i);
    expect(doc).toMatch(/Republic Act|RA \d+/i);
    expect(doc).toMatch(/exact (?:case )?name|case name/i);
  });

  it('specifies metadata filtering dimensions', () => {
    const doc = readDoc(searchDocPath);
    for (const field of [
      /court/i,
      /document type/i,
      /jurisdiction/i,
      /date/i,
      /agency/i,
      /topic/i,
      /verification status/i,
    ]) {
      expect(doc).toMatch(field);
    }
  });

  it('documents the authority ranking policy factors', () => {
    const doc = readDoc(searchDocPath);
    expect(doc).toMatch(/authority ranking/i);
    expect(doc).toMatch(/official_primary|official primary/i);
    expect(doc).toMatch(/official_secondary|official secondary/i);
    expect(doc).toMatch(/unofficial/i);
    expect(doc).toMatch(/verification status|verification/i);
  });

  it('includes a Mermaid retrieval sequence diagram', () => {
    const doc = readDoc(searchDocPath);
    expect(doc).toMatch(/```mermaid/);
    expect(doc).toMatch(/sequenceDiagram|flowchart/);
  });

  it('cites Cloudflare Vectorize and AI Search limits with URLs', () => {
    const doc = readDoc(searchDocPath);
    expect(doc).toMatch(/Vectorize/);
    expect(doc).toMatch(/AI Search/);
    expect(doc).toMatch(/1536 dimensions/i);
    expect(doc).toMatch(/20,?000,?000|20M/);
    expect(doc).toMatch(/50/);
    expect(doc).toMatch(/developers\.cloudflare\.com\/vectorize/);
    expect(doc).toMatch(/developers\.cloudflare\.com\/ai-search/);
  });
});

describe('AI research specification', () => {
  it('defines the retrieval and reasoning sequence', () => {
    const doc = readDoc(researchDocPath);
    expect(doc).toMatch(/query classification/i);
    expect(doc).toMatch(/legal entity.*date extraction|entity.*date extraction/i);
    expect(doc).toMatch(/parallel retrieval/i);
    expect(doc).toMatch(/citation validation/i);
    expect(doc).toMatch(/evidence validation/i);
  });

  it('documents temporal reasoning, uncertainty and abstention behaviour', () => {
    const doc = readDoc(researchDocPath);
    expect(doc).toMatch(/temporal reasoning/i);
    expect(doc).toMatch(/uncertainty/i);
    expect(doc).toMatch(/abstain|abstention/i);
  });

  it('defines structured answer schemas for legal research, educational and professional formats', () => {
    const doc = readDoc(researchDocPath);
    expect(doc).toMatch(/legal research/i);
    expect(doc).toMatch(/ALAC/i);
    expect(doc).toMatch(/IRAC/i);
    expect(doc).toMatch(/professional/i);
    expect(doc).toMatch(/```json/);
  });

  it('documents the provider-neutral model gateway interface', () => {
    const doc = readDoc(researchDocPath);
    expect(doc).toMatch(/model gateway/i);
    expect(doc).toMatch(/provider[- ]neutral|provider[- ]agnostic/i);
  });

  it('includes a Mermaid orchestration diagram', () => {
    const doc = readDoc(researchDocPath);
    expect(doc).toMatch(/```mermaid/);
  });
});

describe('Search interfaces', () => {
  it('exports the search query and result interfaces with the expected shape', () => {
    expectTypeOf<SearchQuery>().toHaveProperty('text');
    expectTypeOf<SearchQuery>().toHaveProperty('mode');
    expectTypeOf<SearchQuery>().toHaveProperty('asOfDate');
    expectTypeOf<SearchQuery['mode']>().toEqualTypeOf<
      | 'quick'
      | 'standard'
      | 'deep'
      | 'comparison'
      | 'statutory'
      | 'educational'
      | 'professional'
    >();

    expectTypeOf<SearchFilters>().toHaveProperty('court');
    expectTypeOf<SearchFilters>().toHaveProperty('documentType');
    expectTypeOf<SearchFilters>().toHaveProperty('jurisdiction');
    expectTypeOf<SearchFilters>().toHaveProperty('dateRange');
    expectTypeOf<SearchFilters>().toHaveProperty('agency');
    expectTypeOf<SearchFilters>().toHaveProperty('topic');
    expectTypeOf<SearchFilters>().toHaveProperty('verificationStatus');

    expectTypeOf<SearchResult>().toHaveProperty('documentId');
    expectTypeOf<SearchResult>().toHaveProperty('chunkId');
    expectTypeOf<SearchResult>().toHaveProperty('score');
    expectTypeOf<SearchResult>().toHaveProperty('passage');
    expectTypeOf<SearchResult>().toHaveProperty('metadata');

    expectTypeOf<ChunkMetadata>().toHaveProperty('documentId');
    expectTypeOf<ChunkMetadata>().toHaveProperty('documentType');
    expectTypeOf<ChunkMetadata>().toHaveProperty('jurisdiction');
    expectTypeOf<ChunkMetadata>().toHaveProperty('verificationStatus');

    expectTypeOf<RetrievalConfig>().toHaveProperty('lexicalWeight');
    expectTypeOf<RetrievalConfig>().toHaveProperty('semanticWeight');
    expectTypeOf<RetrievalConfig>().toHaveProperty('rerankTopK');
    expectTypeOf<RetrievalConfig>().toHaveProperty('finalTopK');
  });

  it('exports the legal-search entry point re-exporting the interfaces', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/legal-search/src/index.ts'),
      'utf-8',
    );
    expect(source).toMatch(/export \* from '\.\/types'/);
  });
});

describe('AI orchestrator interfaces', () => {
  it('exports the generation and model provider interfaces with the expected shape', () => {
    expectTypeOf<GenerationRequest>().toHaveProperty('prompt');
    expectTypeOf<GenerationRequest>().toHaveProperty('mode');
    expectTypeOf<GenerationResult>().toHaveProperty('text');
    expectTypeOf<GenerationResult>().toHaveProperty('model');
    expectTypeOf<GenerationResult>().toHaveProperty('usage');
    expectTypeOf<ModelProvider>().toHaveProperty('id');
    expectTypeOf<ModelProvider>().toHaveProperty('generate');
    expectTypeOf<ResearchAnswer>().toHaveProperty('answer');
    expectTypeOf<ResearchAnswer>().toHaveProperty('citations');
    expectTypeOf<ResearchAnswer>().toHaveProperty('confidence');
  });

  it('exports the ai-orchestrator entry point re-exporting the interfaces', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/ai-orchestrator/src/index.ts'),
      'utf-8',
    );
    expect(source).toMatch(/export \* from '\.\/types'/);
  });
});
