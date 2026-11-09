// @phli/document-engine — Drafting domain types
// Responsibility: see docs/architecture/DOCUMENT_INTELLIGENCE.md

/**
 * The categories of legal document the drafting engine supports.
 * Each category maps to a curated template family.
 */
export type DraftCategory =
  | 'affidavit'
  | 'demand_letter'
  | 'special_power_of_attorney'
  | 'motion'
  | 'pleading'
  | 'corporate_resolution'
  | 'employment_agreement';

/** Lifecycle of a draft. A draft can only be finalized after human approval. */
export type DraftStatus = 'draft' | 'in_review' | 'approved' | 'finalized';

/** A drafting matter: one editable legal document owned by a tenant. */
export interface Draft {
  id: string;
  tenantId: string;
  matterId?: string;
  category: DraftCategory;
  title: string;
  /** Monotonic version number of the current working version. */
  currentVersion: number;
  status: DraftStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** An immutable snapshot of a draft's content. */
export interface DraftVersion {
  id: string;
  draftId: string;
  version: number;
  content: string;
  sections: DraftSection[];
  citations: CitationAttachment[];
  createdBy: string;
  createdAt: string;
  changeSummary?: string;
  /** Set only when a human reviewer explicitly approves this version. */
  approvedBy?: string;
  approvedAt?: string;
}

/** A reusable, tenant-scoped or system-provided drafting template. */
export interface Template {
  id: string;
  /** Absent for system templates shared across tenants. */
  tenantId?: string;
  category: DraftCategory;
  name: string;
  description?: string;
  jurisdiction: string;
  sections: DraftSection[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A supported export target for a finalized draft. */
export interface ExportFormat {
  format: 'pdf' | 'docx' | 'markdown' | 'txt';
  mimeType: string;
  extension: string;
}

/** One ordered section of a draft or template. */
export interface DraftSection {
  id: string;
  heading: string;
  body: string;
  order: number;
  required?: boolean;
}

/**
 * A single inline-assistance request against a draft section.
 * Suggestions are advisory only and never auto-inserted.
 */
export interface InlineAssistance {
  requestId: string;
  draftId: string;
  sectionId?: string;
  mode: 'suggest' | 'rewrite' | 'cite' | 'summarize';
  prompt: string;
  suggestion: string;
  citations: CitationAttachment[];
  createdAt: string;
  accepted?: boolean;
}

/** A verified citation attached to a draft section. */
export interface CitationAttachment {
  id: string;
  citationId: string;
  sourceId: string;
  label: string;
  pinCite?: string;
  verified: boolean;
  attachedAt: string;
}
