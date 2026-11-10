// @phli/legal-ingestion — guarded acquisition transport
// Gate 2. See docs/gates/gate-2/02_ACQUISITION_AND_PROVENANCE.md
//
// This is the only code that performs a network request. It is bounded:
//   - only http(s), public hosts, standard ports;
//   - DNS is resolved and every address is checked (defeats textual SSRF tricks);
//   - redirects are manual, bounded, and re-checked at each hop;
//   - Content-Length mismatch is treated as truncation;
//   - size, timeout and MIME are enforced.
// It is used for the owner-authorized internal pilot only.

import { lookup as dnsLookup } from "node:dns/promises";
import { assertFetchableUrl, isPrivateAddress } from "./guards";
import { sha256 } from "./store";

export type FetchStatus = "OK" | "REJECTED" | "FAILED";

export interface FetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  /** Injectable for deterministic tests. */
  fetchImpl?: typeof fetch;
  /** Injectable DNS resolver for deterministic tests. */
  resolve?: (hostname: string) => Promise<string[]>;
}

export interface FetchResult {
  status: FetchStatus;
  bytes?: Uint8Array;
  finalUrl?: string;
  contentType?: string;
  httpStatus?: number;
  sha256?: string;
  redirects: number;
  reason?: string;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT = 20_000;
const DEFAULT_REDIRECTS = 3;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/html",
  "application/xhtml+xml",
  "text/plain",
]);

const DEFAULT_UA =
  "PHLI-research-pilot/0.1 (bounded internal evaluation; project owner authorized)";

async function resolveHost(
  hostname: string,
  resolve?: FetchOptions["resolve"],
): Promise<string[]> {
  if (resolve) return resolve(hostname);
  const records = await dnsLookup(hostname, { all: true });
  return records.map((record) => record.address);
}

/**
 * Fetch one document under the bounded policy. Never throws for expected
 * failures; returns REJECTED or FAILED with a reason.
 */
export async function fetchLegalDocument(
  rawUrl: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRedirects = options.maxRedirects ?? DEFAULT_REDIRECTS;
  const fetchImpl = options.fetchImpl ?? fetch;
  let redirects = 0;
  let current = rawUrl;

  try {
    while (redirects <= maxRedirects) {
      const urlCheck = assertFetchableUrl(current);
      if (!urlCheck.ok)
        return {
          status: "REJECTED",
          redirects,
          reason: `unsafe_url:${urlCheck.reason}`,
        };

      const host = new URL(current).hostname;
      const addresses = await resolveHost(host, options.resolve);
      if (addresses.length === 0)
        return { status: "FAILED", redirects, reason: "dns_no_records" };
      if (addresses.some((address) => isPrivateAddress(address))) {
        return {
          status: "REJECTED",
          redirects,
          reason: "dns_resolves_to_private_address",
        };
      }

      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "user-agent": options.userAgent ?? DEFAULT_UA,
          accept: "text/html,application/pdf,text/plain;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          return {
            status: "FAILED",
            redirects,
            reason: "redirect_without_location",
          };
        redirects += 1;
        if (redirects > maxRedirects)
          return {
            status: "REJECTED",
            redirects,
            reason: "too_many_redirects",
          };
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) {
        return {
          status: "FAILED",
          redirects,
          httpStatus: response.status,
          reason: `http_${response.status}`,
        };
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase();
      if (!ALLOWED_MIME.has(contentType)) {
        return {
          status: "REJECTED",
          redirects,
          httpStatus: response.status,
          contentType,
          reason: `unsupported_mime:${contentType}`,
        };
      }

      const declaredLength = Number.parseInt(
        response.headers.get("content-length") ?? "",
        10,
      );
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.length > maxBytes) {
        return {
          status: "REJECTED",
          redirects,
          httpStatus: response.status,
          contentType,
          reason: `too_large:${buffer.length}>${maxBytes}`,
        };
      }
      if (Number.isFinite(declaredLength) && declaredLength !== buffer.length) {
        return {
          status: "FAILED",
          redirects,
          httpStatus: response.status,
          contentType,
          reason: `truncated:${buffer.length}/${declaredLength}`,
        };
      }
      if (buffer.length === 0)
        return {
          status: "FAILED",
          redirects,
          httpStatus: response.status,
          contentType,
          reason: "empty_body",
        };

      return {
        status: "OK",
        bytes: buffer,
        finalUrl: current,
        contentType,
        httpStatus: response.status,
        sha256: sha256(buffer),
        redirects,
      };
    }
    return { status: "REJECTED", redirects, reason: "too_many_redirects" };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 200) : "fetch_failed";
    return { status: "FAILED", redirects, reason };
  }
}
