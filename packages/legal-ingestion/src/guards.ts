// @phli/legal-ingestion — acquisition guards (URL and filename safety)
// Gate 2. See docs/gates/gate-2/07_SECURITY_AND_GROUNDING.md
//
// No network client is implemented in Gate 2 because no source is authorized.
// These guards exist so that a future connector cannot trivially fetch internal
// addresses or write outside its storage root.

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

const PRIVATE_V4 =
  /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
    return true;
  if (
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  )
    return true;
  if (PRIVATE_V4.test(host)) return true;
  return false;
}

/**
 * Allow only absolute http(s) URLs with a public host and a standard port.
 * Rejects credentials, non-standard schemes, private hosts and fragments of
 * authority embedded in the URL.
 */
export function assertFetchableUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { ok: false, reason: "unsupported_scheme" };
  if (url.username || url.password)
    return { ok: false, reason: "credentials_in_url" };
  if (url.port && url.port !== "80" && url.port !== "443")
    return { ok: false, reason: "non_standard_port" };
  if (isPrivateHost(url.hostname))
    return { ok: false, reason: "private_or_local_host" };
  if (url.hostname.length === 0) return { ok: false, reason: "missing_host" };
  return { ok: true };
}

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += char;
  }
  return out;
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Reduce an untrusted filename to a safe leaf name. Never returns a path. */
export function safeFilename(raw: string, fallback = "document.pdf"): string {
  const leaf = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = stripControlChars(leaf)
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Guard for a content-addressed storage key; rejects traversal and absolute paths. */
export function assertSafeStorageKey(key: string): UrlCheck {
  if (key.length === 0) return { ok: false, reason: "empty_key" };
  if (key.startsWith("/") || /^[A-Za-z]:/.test(key))
    return { ok: false, reason: "absolute_path" };
  if (key.split(/[\\/]/).includes(".."))
    return { ok: false, reason: "path_traversal" };
  if (hasControlChars(key)) return { ok: false, reason: "control_characters" };
  return { ok: true };
}
