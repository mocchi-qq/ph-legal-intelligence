import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  VerificationLayer,
  CitationVerificationResult,
  CitationVerifier,
  LayerResult,
  LayerResults,
  VerificationMethod,
  VerificationStatus,
  CitationInput,
} from '../../packages/citation-engine/src/index';

describe('@phli/citation-engine citation verification', () => {
  it('documents four verification layers (Identity, Location, Support, Temporal validity)', () => {
    expect(VerificationLayer.IDENTITY).toBe('IDENTITY');
    expect(VerificationLayer.LOCATION).toBe('LOCATION');
    expect(VerificationLayer.SUPPORT).toBe('SUPPORT');
    expect(VerificationLayer.TEMPORAL_VALIDITY).toBe('TEMPORAL_VALIDITY');
    expect(Object.values(VerificationLayer)).toEqual([
      'IDENTITY',
      'LOCATION',
      'SUPPORT',
      'TEMPORAL_VALIDITY',
    ]);
  });

  it('defines citation verification result schema with required fields', () => {
    const result: CitationVerificationResult = {
      citationId: 'cite-123',
      documentId: 'doc-456',
      passageId: 'passage-789',
      citationText: 'People v. Smith, G.R. No. 12345, January 15, 2020',
      identityVerified: true,
      passageVerified: true,
      propositionSupported: true,
      temporalValidity: true,
      verificationMethod: VerificationMethod.AUTOMATED,
      verificationStatus: VerificationStatus.VERIFIED,
      layerResults: {
        [VerificationLayer.IDENTITY]: { passed: true, evidence: 'Authority exists in SC database' },
        [VerificationLayer.LOCATION]: { passed: true, evidence: 'Paragraph 12 matches citation' },
        [VerificationLayer.SUPPORT]: { passed: true, evidence: 'Passage supports the legal proposition' },
        [VerificationLayer.TEMPORAL_VALIDITY]: { passed: true, evidence: 'Law was in force at relevant date' },
      },
    };

    expect(result.citationId).toBe('cite-123');
    expect(result.documentId).toBe('doc-456');
    expect(result.passageId).toBe('passage-789');
    expect(result.citationText).toBe('People v. Smith, G.R. No. 12345, January 15, 2020');
    expect(result.identityVerified).toBe(true);
    expect(result.passageVerified).toBe(true);
    expect(result.propositionSupported).toBe(true);
    expect(result.temporalValidity).toBe(true);
    expect(result.verificationMethod).toBe(VerificationMethod.AUTOMATED);
    expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
    expect(result.layerResults[VerificationLayer.IDENTITY].passed).toBe(true);
    expect(result.layerResults[VerificationLayer.LOCATION].passed).toBe(true);
    expect(result.layerResults[VerificationLayer.SUPPORT].passed).toBe(true);
    expect(result.layerResults[VerificationLayer.TEMPORAL_VALIDITY].passed).toBe(true);
  });

  it('exports verification types for external consumption', () => {
    // Check that the source file re-exports the types
    const indexSource = readFileSync(join(process.cwd(), 'packages/citation-engine/src/index.ts'), 'utf-8');
    expect(indexSource).toContain("export * from './types'");
    expect(indexSource).toContain("export * from './verifier'");
    // Verify enums exist at runtime (they're not erased)
    expect(VerificationLayer).toBeDefined();
    expect(VerificationMethod).toBeDefined();
    expect(VerificationStatus).toBeDefined();
    // Interfaces are type-only (erased), so check they're defined in source files
    const typesSource = readFileSync(join(process.cwd(), 'packages/citation-engine/src/types.ts'), 'utf-8');
    const verifierSource = readFileSync(join(process.cwd(), 'packages/citation-engine/src/verifier.ts'), 'utf-8');
    expect(typesSource).toContain('CitationVerificationResult');
    expect(typesSource).toContain('CitationInput');
    expect(verifierSource).toContain('CitationVerifier');
  });

  it('defines VerificationMethod enum with all values', () => {
    expect(Object.values(VerificationMethod)).toEqual([
      'AUTOMATED',
      'MANUAL',
      'HYBRID',
    ]);
  });

  it('defines VerificationStatus enum with all values', () => {
    expect(Object.values(VerificationStatus)).toEqual([
      'VERIFIED',
      'PARTIALLY_VERIFIED',
      'FAILED',
      'PENDING',
    ]);
  });

  it('allows LayerResult with optional evidence and notes', () => {
    const layerResult: LayerResult = {
      passed: false,
      evidence: 'No matching authority found',
      notes: 'Docket number format invalid',
    };
    expect(layerResult.passed).toBe(false);
    expect(layerResult.evidence).toBe('No matching authority found');
    expect(layerResult.notes).toBe('Docket number format invalid');
  });

  it('allows CitationInput with optional documentId, passageId, relevantDate', () => {
    const input: CitationInput = {
      citationText: 'RA 11900 § 5',
      proposition: 'Vaping products require FDA notification',
    };
    expect(input.citationText).toBe('RA 11900 § 5');
    expect(input.proposition).toBe('Vaping products require FDA notification');
    expect(input.documentId).toBeUndefined();
    expect(input.passageId).toBeUndefined();
    expect(input.relevantDate).toBeUndefined();
  });

  it('allows CitationInput with all fields populated', () => {
    const input: CitationInput = {
      citationText: 'People v. Smith, G.R. No. 12345',
      documentId: 'doc-456',
      passageId: 'passage-789',
      proposition: 'Warrantless search is invalid without exigent circumstances',
      relevantDate: '2024-01-15',
    };
    expect(input.documentId).toBe('doc-456');
    expect(input.passageId).toBe('passage-789');
    expect(input.relevantDate).toBe('2024-01-15');
  });
});