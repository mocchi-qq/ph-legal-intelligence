import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CATEGORY_DISTRIBUTION: Record<string, number> = {
  constitutional_law: 50,
  civil_law: 70,
  criminal_law: 60,
  labor_law: 60,
  taxation: 50,
  commercial_law: 50,
  remedial_law: 60,
  administrative_law: 40,
  legal_research_citations: 30,
  historical_law_versions: 30,
};

describe('Legal benchmark fixtures', () => {
  it('questions.json exists with 500 entries', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'legal-data/benchmark-fixtures/questions.json'), 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(500);
  });

  it('has correct category distribution', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'legal-data/benchmark-fixtures/questions.json'), 'utf-8'));
    const counts: Record<string, number> = {};
    for (const q of data) counts[q.category] = (counts[q.category] ?? 0) + 1;
    for (const [cat, n] of Object.entries(CATEGORY_DISTRIBUTION)) {
      expect(counts[cat]).toBe(n);
    }
  });

  it('each question has required fields', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'legal-data/benchmark-fixtures/questions.json'), 'utf-8'));
    const required = ['id', 'category', 'question', 'issue', 'expected_authorities', 'applicable_date', 'expected_conclusion', 'required_citations', 'known_ambiguities', 'expert_review_status'];
    for (const q of data) {
      for (const f of required) expect(q).toHaveProperty(f);
      expect(q.expert_review_status).toBe('PENDING');
      expect(Array.isArray(q.expected_authorities)).toBe(true);
      expect(Array.isArray(q.required_citations)).toBe(true);
    }
  });

  it('question ids are unique', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'legal-data/benchmark-fixtures/questions.json'), 'utf-8'));
    const ids = new Set(data.map((q: { id: string }) => q.id));
    expect(ids.size).toBe(500);
  });

  it('benchmark doc defines evaluation metrics', () => {
    const content = readFileSync(join(process.cwd(), 'docs/ai-evaluation/LEGAL_BENCHMARK.md'), 'utf-8');
    const metrics = ['Recall@10', 'Precision@5', 'MRR', 'Citation identity accuracy', 'Citation passage accuracy', 'Claim support rate', 'Temporal correctness', 'Abstention quality', 'Answer completeness'];
    for (const m of metrics) expect(content.toLowerCase()).toContain(m.toLowerCase());
  });

  it('benchmark doc defines launch gates and red-team scenarios', () => {
    const content = readFileSync(join(process.cwd(), 'docs/ai-evaluation/LEGAL_BENCHMARK.md'), 'utf-8');
    expect(content).toMatch(/launch gate/i);
    expect(content).toMatch(/red.team/i);
  });

  it('evaluator stubs exist', () => {
    const content = readFileSync(join(process.cwd(), 'apps/benchmark/src/evaluators/index.ts'), 'utf-8');
    expect(content).toContain('RecallAt10Evaluator');
    expect(content).toContain('CitationIdentityAccuracyEvaluator');
  });
});