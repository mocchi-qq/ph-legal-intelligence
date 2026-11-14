// @phli/legal-schema — Package entry point
//
// The single source of truth for the Philippine legal data model: the document
// type taxonomy and controlled vocabularies (`taxonomy.ts`) and the four-object
// model interfaces and edge records (`types.ts`).
//
// Usage:
//   import { DocumentType, LegalStatus } from '@phli/legal-schema';
//
// See docs/architecture/LEGAL_DATA_MODEL.md and
// docs/architecture/LEGAL_TEMPORAL_MODEL.md for the model these types encode.

export * from "./authority";
export * from "./taxonomy";
export * from "./types";
