// @phli/document-parser — controlled PDF inspection and native text extraction
// Gate 2. See docs/gates/gate-2/03_PDF_PARSING_AND_OCR.md
//
// Design constraints:
//   - Original bytes are never modified; extraction reads a temporary copy.
//   - Tools are invoked with execFile (no shell), a timeout, and a size limit.
//   - A missing tool returns UNAVAILABLE; a bad file returns REJECTED. Neither throws.
//   - OCR is an interface with no provider on this host; it is never simulated.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PdfStatus =
  | "OK"
  | "LOW_QUALITY"
  | "EMPTY"
  | "REJECTED"
  | "UNAVAILABLE"
  | "FAILED";

export interface PdfInspection {
  status: PdfStatus;
  pageCount: number | null;
  pdfVersion: string | null;
  encrypted: boolean | null;
  reason?: string;
}

export interface PdfExtraction {
  status: PdfStatus;
  text: string;
  pageCount: number | null;
  method: "native_text" | "none";
  flags: string[];
  reason?: string;
}

export interface PdfOptions {
  maxBytes?: number;
  timeoutMs?: number;
  layout?: boolean;
  /** Default 500. Inspected page counts above this are rejected. */
  maxPages?: number;
  /** `preferred` (default) uses available OS limits/network isolation; `off` for tests only. */
  sandbox?: "preferred" | "off";
  /**
   * Required before any temporary file is written. It must check the canonical
   * `temporary_local_storage` decision for this source/document. Missing or
   * denied authorization rejects the operation before mkdtemp/write.
   */
  authorizeTemporaryStorage?: () => { allowed: boolean; reason?: string };
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT = 15_000;

let toolsCache: { pdftotext: boolean; pdfinfo: boolean } | undefined;
let sandboxCache: { prlimit: boolean; unshareNet: boolean } | undefined;

export interface SandboxCapabilities {
  prlimit: boolean;
  unshareNet: boolean;
}

export function sandboxCapabilities(): SandboxCapabilities {
  if (sandboxCache) return sandboxCache;
  const probe = (cmd: string): boolean => {
    try {
      execFileSync("sh", ["-c", `command -v ${cmd}`], {
        stdio: "ignore",
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  };
  sandboxCache = { prlimit: probe("prlimit"), unshareNet: probe("unshare") };
  return sandboxCache;
}

export function checkPageLimit(
  pageCount: number | null,
  maxPages = 500,
): boolean {
  return pageCount === null || pageCount <= maxPages;
}

/** Run a parser tool under OS resource limits and, when available, network isolation. */
function runTool(command: string, args: string[], options: PdfOptions): string {
  const caps = sandboxCapabilities();
  const useSandbox = options.sandbox !== "off";
  let finalCommand = command;
  let finalArgs = args;
  let isolated = false;

  if (useSandbox && caps.unshareNet) {
    finalCommand = "unshare";
    finalArgs = ["-n", command, ...args];
    isolated = true;
  }
  if (useSandbox && caps.prlimit) {
    finalCommand = "prlimit";
    finalArgs = [
      "--as=536870912",
      "--cpu=20",
      "--nproc=64",
      "--fsize=67108864",
      "--",
      finalCommand,
      ...finalArgs,
    ];
  }
  const output = execFileSync(finalCommand, finalArgs, {
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT,
    maxBuffer: 20 * 1024 * 1024,
    encoding: "utf8",
  });
  if (useSandbox && !isolated && caps.unshareNet === false) {
    // No network isolation available; resource limits may still apply. Never claim sandboxing.
  }
  return output;
}

export function pdfToolsAvailable(): { pdftotext: boolean; pdfinfo: boolean } {
  if (toolsCache) return toolsCache;
  const probe = (cmd: string): boolean => {
    try {
      execFileSync("sh", ["-c", `command -v ${cmd}`], {
        stdio: "ignore",
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  };
  toolsCache = { pdftotext: probe("pdftotext"), pdfinfo: probe("pdfinfo") };
  return toolsCache;
}

function temporaryStorageRejection(options: PdfOptions): string | null {
  if (!options.authorizeTemporaryStorage)
    return "temporary_storage_authorization_missing";
  const result = options.authorizeTemporaryStorage();
  if (!result.allowed)
    return `temporary_storage_not_authorized:${result.reason ?? "denied"}`;
  return null;
}

function withTempFile<T>(bytes: Uint8Array, fn: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "phli-pdf-"));
  const path = join(dir, "input.pdf");
  try {
    writeFileSync(path, bytes, { mode: 0o600 });
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-"
  );
}

function rejectReason(bytes: Uint8Array, options: PdfOptions): string | null {
  if (!isPdf(bytes)) return "not_a_pdf";
  const max = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (bytes.length > max) return `too_large:${bytes.length}>${max}`;
  return null;
}

export function inspectPdf(
  bytes: Uint8Array,
  options: PdfOptions = {},
): PdfInspection {
  const rejected = rejectReason(bytes, options);
  if (rejected)
    return {
      status: "REJECTED",
      pageCount: null,
      pdfVersion: null,
      encrypted: null,
      reason: rejected,
    };
  const tools = pdfToolsAvailable();
  if (!tools.pdfinfo)
    return {
      status: "UNAVAILABLE",
      pageCount: null,
      pdfVersion: null,
      encrypted: null,
      reason: "pdfinfo_missing",
    };

  const storageDenied = temporaryStorageRejection(options);
  if (storageDenied)
    return {
      status: "REJECTED",
      pageCount: null,
      pdfVersion: null,
      encrypted: null,
      reason: storageDenied,
    };

  try {
    return withTempFile(bytes, (path) => {
      const out = runTool("pdfinfo", [path], options);
      const pageMatch = out.match(/^Pages:\s+(\d+)/m);
      const versionMatch = out.match(/^PDF version:\s+([\d.]+)/m);
      const encrypted = /^Encrypted:\s+yes/m.test(out);
      const pageCount = pageMatch ? Number.parseInt(pageMatch[1]!, 10) : null;
      if (!checkPageLimit(pageCount, options.maxPages)) {
        return {
          status: "REJECTED" as const,
          pageCount,
          pdfVersion: versionMatch?.[1] ?? null,
          encrypted,
          reason: `too_many_pages:${pageCount}>${options.maxPages ?? 500}`,
        };
      }
      return {
        status: "OK" as const,
        pageCount,
        pdfVersion: versionMatch?.[1] ?? null,
        encrypted,
      };
    });
  } catch (error) {
    return {
      status: "FAILED",
      pageCount: null,
      pdfVersion: null,
      encrypted: null,
      reason:
        error instanceof Error ? error.message.slice(0, 200) : "pdfinfo_failed",
    };
  }
}

/** Assess extracted text quality. Never repairs content. */
export function assessTextQuality(
  text: string,
  pageCount: number | null,
): { flags: string[]; status: PdfStatus } {
  const flags: string[] = [];
  const pages = text
    .split("\f")
    .filter(
      (page, index, all) => index < all.length - 1 || page.trim().length > 0,
    );
  const nonSpace = text.replace(/\s/g, "").length;
  if (nonSpace === 0) return { flags: ["empty_text"], status: "EMPTY" };

  const perPage = pageCount && pageCount > 0 ? nonSpace / pageCount : nonSpace;
  if (perPage < 40) flags.push("low_text_density");

  const emptyPages = pages.filter(
    (page) => page.replace(/\s/g, "").length === 0,
  ).length;
  if (emptyPages > 0) flags.push(`empty_pages:${emptyPages}`);

  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  if (replacement / Math.max(1, text.length) > 0.005)
    flags.push("garbled_characters");

  let controls = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 && code !== 9 && code !== 10 && code !== 12 && code !== 13)
      controls += 1;
  }
  if (controls / Math.max(1, text.length) > 0.005)
    flags.push("control_characters");

  if (!/[.!?;:]/.test(text)) flags.push("no_punctuation");

  return { flags, status: flags.length > 0 ? "LOW_QUALITY" : "OK" };
}

/** Extract native PDF text. OCR is never attempted here. */
export function extractPdfText(
  bytes: Uint8Array,
  options: PdfOptions = {},
): PdfExtraction {
  const rejected = rejectReason(bytes, options);
  if (rejected) {
    return {
      status: "REJECTED",
      text: "",
      pageCount: null,
      method: "none",
      flags: [],
      reason: rejected,
    };
  }
  const tools = pdfToolsAvailable();
  if (!tools.pdftotext) {
    return {
      status: "UNAVAILABLE",
      text: "",
      pageCount: null,
      method: "none",
      flags: [],
      reason: "pdftotext_missing",
    };
  }

  const storageDenied = temporaryStorageRejection(options);
  if (storageDenied) {
    return {
      status: "REJECTED",
      text: "",
      pageCount: null,
      method: "none",
      flags: [],
      reason: storageDenied,
    };
  }

  try {
    return withTempFile(bytes, (path) => {
      const args = ["-enc", "UTF-8"];
      if (options.layout) args.push("-layout");
      args.push(path, "-");
      const text = runTool("pdftotext", args, options);
      const inspection = tools.pdfinfo
        ? inspectPdf(bytes, options)
        : { pageCount: null };
      const quality = assessTextQuality(text, inspection.pageCount);
      return {
        status: quality.status,
        text,
        pageCount: inspection.pageCount,
        method: "native_text" as const,
        flags: quality.flags,
      };
    });
  } catch (error) {
    return {
      status: "FAILED",
      text: "",
      pageCount: null,
      method: "none",
      flags: [],
      reason:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "pdftotext_failed",
    };
  }
}

// ---------------------------------------------------------------------------
// OCR — interface only. No provider exists on this host, and none is simulated.
// ---------------------------------------------------------------------------

export interface OcrRequest {
  bytes: Uint8Array;
  language: string;
  page: number;
}

export interface OcrResult {
  text: string;
  confidence: number | null;
  engine: string;
  engineVersion: string;
}

export interface OcrProvider {
  readonly available: boolean;
  readonly engineName: string;
  recognise(request: OcrRequest): Promise<OcrResult>;
}

export function ocrEligibility(extraction: PdfExtraction): {
  eligible: boolean;
  reason: string;
} {
  if (extraction.status === "REJECTED" || extraction.status === "FAILED") {
    return {
      eligible: false,
      reason: `extraction_${extraction.status.toLowerCase()}`,
    };
  }
  if (extraction.status === "UNAVAILABLE")
    return { eligible: false, reason: "extractor_unavailable" };
  if (extraction.status === "EMPTY")
    return { eligible: true, reason: "no_native_text" };
  if (extraction.flags.includes("low_text_density"))
    return { eligible: true, reason: "low_text_density" };
  return { eligible: false, reason: "native_text_sufficient" };
}

/** Placeholder used to represent "no OCR on this host" without pretending it ran. */
export const NO_OCR_PROVIDER: OcrProvider = {
  available: false,
  engineName: "none",
  async recognise() {
    throw new Error("OCR unavailable: no provider is installed on this host");
  },
};
