import { describe, expect, it } from "vitest";
import {
  assessTextQuality,
  checkPageLimit,
  extractPdfText,
  inspectPdf,
  isPdf,
  NO_OCR_PROVIDER,
  ocrEligibility,
  pdfToolsAvailable,
  sandboxCapabilities,
} from "../../packages/document-parser/src/index";
import { makeTestPdf } from "../helpers/pdf";

const tools = pdfToolsAvailable();
const hasPoppler = tools.pdftotext && tools.pdfinfo;
const pdf = makeTestPdf([
  "Synthetic Republic Act No. 1001",
  "Section 1. A synthetic duty applies to covered entities.",
]);

describe("Gate 2 — PDF inspection and extraction", () => {
  it("recognises the PDF signature", () => {
    expect(isPdf(pdf)).toBe(true);
    expect(isPdf(Uint8Array.from(Buffer.from("not a pdf")))).toBe(false);
  });

  it("rejects non-PDF bytes without throwing", () => {
    const result = inspectPdf(Uint8Array.from(Buffer.from("plain text")));
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toBe("not_a_pdf");
  });

  it("rejects files over the size limit", () => {
    const result = extractPdfText(pdf, { maxBytes: 10 });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toContain("too_large");
  });

  it("reports sandbox capabilities explicitly", () => {
    const caps = sandboxCapabilities();
    expect(typeof caps.prlimit).toBe("boolean");
    expect(typeof caps.unshareNet).toBe("boolean");
  });

  it("enforces a page-count limit", () => {
    expect(checkPageLimit(10, 500)).toBe(true);
    expect(checkPageLimit(501, 500)).toBe(false);
    expect(checkPageLimit(null, 500)).toBe(true);
  });

  it("rejects an inspected document above the page limit", () => {
    const result = inspectPdf(pdf, { maxPages: 0 });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toContain("too_many_pages");
  });

  it("reports tool availability explicitly", () => {
    expect(typeof tools.pdftotext).toBe("boolean");
    expect(typeof tools.pdfinfo).toBe("boolean");
  });

  it.skipIf(!hasPoppler)("inspects a valid PDF", () => {
    const inspection = inspectPdf(pdf);
    expect(inspection.status).toBe("OK");
    expect(inspection.pageCount).toBe(1);
    expect(inspection.encrypted).toBe(false);
  });

  it.skipIf(!hasPoppler)(
    "extracts native text and preserves the original bytes",
    () => {
      const before = Buffer.from(pdf).toString("base64");
      const result = extractPdfText(pdf);
      expect(result.status, JSON.stringify(result.flags)).toBe("OK");
      expect(result.method).toBe("native_text");
      expect(result.pageCount).toBe(1);
      expect(result.text).toContain(
        "A synthetic duty applies to covered entities",
      );
      expect(Buffer.from(pdf).toString("base64")).toBe(before);
    },
  );

  it.skipIf(!hasPoppler)("fails a corrupted PDF without throwing", () => {
    const corrupt = Uint8Array.from(
      Buffer.from("%PDF-1.4\nthis is not a real pdf body"),
    );
    const result = extractPdfText(corrupt);
    expect(["FAILED", "REJECTED", "EMPTY"]).toContain(result.status);
    expect(result.text).toBe("");
  });

  it("flags empty and low-density text", () => {
    expect(assessTextQuality("   \n\n  ", 1).status).toBe("EMPTY");
    const low = assessTextQuality("x", 10);
    expect(low.status).toBe("LOW_QUALITY");
    expect(low.flags).toContain("low_text_density");
  });

  it("flags replacement characters as garbled", () => {
    const text = `Section 1. ${"a".repeat(290)}\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD`;
    const quality = assessTextQuality(text, 1);
    expect(quality.flags).toContain("garbled_characters");
  });

  it("marks OCR eligible only when native text is insufficient", () => {
    expect(
      ocrEligibility({
        status: "EMPTY",
        text: "",
        pageCount: 3,
        method: "native_text",
        flags: [],
      }).eligible,
    ).toBe(true);
    expect(
      ocrEligibility({
        status: "OK",
        text: "enough native text",
        pageCount: 1,
        method: "native_text",
        flags: [],
      }).eligible,
    ).toBe(false);
  });

  it("does not pretend OCR is available", async () => {
    expect(NO_OCR_PROVIDER.available).toBe(false);
    await expect(
      NO_OCR_PROVIDER.recognise({ bytes: pdf, language: "eng", page: 1 }),
    ).rejects.toThrow(/unavailable/i);
  });
});
