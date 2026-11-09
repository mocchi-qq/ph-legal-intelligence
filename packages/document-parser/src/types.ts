// @phli/document-parser — Parsed document domain types
// Responsibility: see docs/architecture/DOCUMENT_INTELLIGENCE.md

/** One structural section recovered from a parsed document. */
export interface DocumentSection {
  id: string;
  heading?: string;
  text: string;
  level: number;
  order: number;
  pageNumber?: number;
}

/** The structural outline recovered from a parsed document. */
export interface DocumentStructure {
  title?: string;
  sections: DocumentSection[];
  headings: string[];
  tableCount: number;
}

/** A clause extracted from a document, with offsets into the normalized text. */
export interface ExtractedClause {
  id: string;
  type: string;
  text: string;
  sectionId?: string;
  startOffset: number;
  endOffset: number;
  /** Parser confidence in the extraction, from 0 to 1. */
  confidence: number;
}

/** The output of parsing one uploaded document. */
export interface ParseResult {
  documentId: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  pageCount: number;
  text: string;
  structure: DocumentStructure;
  clauses: ExtractedClause[];
  warnings: string[];
  parserVersion: string;
  parsedAt: string;
}

/** Options that control parsing. OCR is opt-in per file type. */
export interface ParserOptions {
  ocr: boolean;
  language?: string;
  maxPages?: number;
  extractClauses?: boolean;
  retainLayout?: boolean;
}
