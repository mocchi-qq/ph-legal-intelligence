import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  CitationAttachment,
  Draft,
  DraftSection,
  DraftVersion,
  ExportFormat,
  InlineAssistance,
  Template,
} from "../../packages/document-engine/src/index";
import type {
  DocumentStructure,
  ExtractedClause,
  ParseResult,
  ParserOptions,
} from "../../packages/document-parser/src/index";

const documentPath = join(
  process.cwd(),
  "docs/architecture/DOCUMENT_INTELLIGENCE.md",
);

function readDocument(): string {
  return readFileSync(documentPath, "utf-8");
}

describe("Document intelligence specification", () => {
  it("documents the private document upload pipeline", () => {
    const doc = readDocument();
    expect(doc).toMatch(/R2/i);
    expect(doc).toMatch(/private bucket|private R2/i);
    expect(doc).toMatch(/file validation/i);
    expect(doc).toMatch(/OCR/i);
    expect(doc).toMatch(/chunking/i);
    expect(doc).toMatch(/sensitive data/i);
    expect(doc).toMatch(/tenant-isolated index|tenant-isolated indexing/i);
  });

  it("requires malware scanning before a document reaches the parser", () => {
    const doc = readDocument();
    expect(doc).toMatch(/malware scan/i);
    expect(doc).toMatch(/quarantin/i);
    expect(doc).toMatch(/ClamAV|antivirus/i);
  });

  it("defends against prompt injection in uploaded documents", () => {
    const doc = readDocument();
    expect(doc).toMatch(/prompt injection/i);
    expect(doc).toMatch(/untrusted/i);
    expect(doc).toMatch(/instruction/i);
    expect(doc).toMatch(/data, not instructions|treat.*as data/i);
  });

  it("isolates documents across tenants", () => {
    const doc = readDocument();
    expect(doc).toMatch(/cross-tenant isolation/i);
    expect(doc).toMatch(/tenant_id/);
    expect(doc).toMatch(/row-level security|RLS/i);
  });

  it("defines retention and deletion behaviour", () => {
    const doc = readDocument();
    expect(doc).toMatch(/retention/i);
    expect(doc).toMatch(/deletion|deleted|delete/i);
    expect(doc).toMatch(/data subject|right to erasure/i);
  });

  it("lists the supported drafting categories", () => {
    const doc = readDocument().toLowerCase();
    const categories = [
      "affidavit",
      "demand letter",
      "special power of attorney",
      "motion",
      "pleading",
      "corporate resolution",
      "employment agreement",
    ];
    for (const category of categories) {
      expect(doc).toContain(category);
    }
  });

  it("documents the drafting editor features", () => {
    const doc = readDocument();
    expect(doc).toMatch(/rich[- ]text editor/i);
    expect(doc).toMatch(/inline assistance/i);
    expect(doc).toMatch(/citation/i);
    expect(doc).toMatch(/version/i);
    expect(doc).toMatch(/template/i);
  });

  it("requires human approval before a draft is finalized", () => {
    const doc = readDocument();
    expect(doc).toMatch(/human approval/i);
    expect(doc).toMatch(/finali[sz]/i);
    expect(doc).toMatch(
      /no draft.*(?:filed|finalized)|shall not be (?:filed|finalized)/i,
    );
  });
});

describe("Document engine types", () => {
  it("exports the draft model types with the expected shape", () => {
    expectTypeOf<Draft>().toHaveProperty("id");
    expectTypeOf<Draft["status"]>().toEqualTypeOf<
      "draft" | "in_review" | "approved" | "finalized"
    >();
    expectTypeOf<Draft>().toHaveProperty("tenantId");

    expectTypeOf<DraftVersion>().toHaveProperty("draftId");
    expectTypeOf<DraftVersion>().toHaveProperty("content");

    expectTypeOf<Template>().toHaveProperty("category");
    expectTypeOf<DraftSection>().toHaveProperty("body");
    expectTypeOf<InlineAssistance>().toHaveProperty("mode");
    expectTypeOf<CitationAttachment>().toHaveProperty("verified");
    expectTypeOf<ExportFormat>().toHaveProperty("format");
  });

  it("exports the document engine entry point", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/document-engine/src/index.ts"),
      "utf-8",
    );
    expect(source).toMatch(/export \* from ["']\.\/types["']/);
  });
});

describe("Document parser types", () => {
  it("exports the parser model types with the expected shape", () => {
    expectTypeOf<ParseResult>().toHaveProperty("structure");
    expectTypeOf<ParseResult>().toHaveProperty("clauses");
    expectTypeOf<DocumentStructure>().toHaveProperty("sections");
    expectTypeOf<ExtractedClause>().toHaveProperty("text");
    expectTypeOf<ExtractedClause>().toHaveProperty("confidence");
    expectTypeOf<ParserOptions>().toHaveProperty("ocr");
  });

  it("exports the document parser entry point", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/document-parser/src/index.ts"),
      "utf-8",
    );
    expect(source).toMatch(/export \* from ["']\.\/types["']/);
  });
});
