import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const requiredDirs = ['product', 'research', 'architecture', 'security', 'privacy', 'data-governance', 'ingestion', 'retrieval', 'ai-evaluation', 'api', 'operations', 'decisions'];

describe('Documentation hierarchy', () => {
  it('has all required doc directories', () => {
    const docsPath = join(process.cwd(), 'docs');
    const dirs = readdirSync(docsPath).filter(f => statSync(join(docsPath, f)).isDirectory());
    for (const d of requiredDirs) expect(dirs).toContain(d);
  });
  it('has ADR template', () => {
    expect(() => readFileSync(join(process.cwd(), 'docs/decisions/ADR_TEMPLATE.md'), 'utf-8')).not.toThrow();
  });
  it('has initial ADR stubs 0001-0012', () => {
    const adrs = readdirSync(join(process.cwd(), 'docs/decisions')).filter(f => f.endsWith('.md') && f.startsWith('ADR-'));
    expect(adrs.length).toBeGreaterThanOrEqual(12);
  });
});

function readFileSync(filePath: string, encoding: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  return fs.readFileSync(filePath, encoding);
}