import { describe, expect, it } from "vitest";
import {
  fetchLegalDocument,
  isPrivateAddress,
} from "../../packages/legal-ingestion/src/index";

const publicResolve = async () => ["93.184.216.34"];

function response(body: string, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

describe("Gate 2 — guarded transport", () => {
  it("fetches an allowed document and records its hash", async () => {
    const body = "<html><body>Section 1. Synthetic.</body></html>";
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: publicResolve,
      fetchImpl: async () =>
        response(body, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-length": String(body.length),
          },
        }),
    });
    expect(result.status).toBe("OK");
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.redirects).toBe(0);
    expect(result.bytes?.length).toBe(body.length);
  });

  it("rejects a host that resolves to a private address", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: async () => ["127.0.0.1"],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toBe("dns_resolves_to_private_address");
  });

  it("rejects a redirect that targets a private host", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: async (host) =>
        host === "example.gov.ph" ? ["93.184.216.34"] : ["10.0.0.5"],
      fetchImpl: async () =>
        response("", {
          status: 302,
          headers: { location: "http://internal.example/doc" },
        }),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toBe("dns_resolves_to_private_address");
    expect(result.redirects).toBe(1);
  });

  it("rejects too many redirects", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: publicResolve,
      maxRedirects: 1,
      fetchImpl: async () =>
        response("", { status: 302, headers: { location: "/next" } }),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toBe("too_many_redirects");
  });

  it("detects truncation from a Content-Length mismatch", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: publicResolve,
      fetchImpl: async () =>
        response("abc", {
          status: 200,
          headers: { "content-type": "text/html", "content-length": "100" },
        }),
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toContain("truncated");
  });

  it("rejects unsupported MIME types", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/doc.zip", {
      resolve: publicResolve,
      fetchImpl: async () =>
        response("PK", {
          status: 200,
          headers: { "content-type": "application/zip" },
        }),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toContain("unsupported_mime");
  });

  it("rejects oversized bodies", async () => {
    const body = "x".repeat(200);
    const result = await fetchLegalDocument("https://example.gov.ph/doc", {
      resolve: publicResolve,
      maxBytes: 50,
      fetchImpl: async () =>
        response(body, {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toContain("too_large");
  });

  it("reports HTTP failures without throwing", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/missing", {
      resolve: publicResolve,
      fetchImpl: async () =>
        response("nope", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("http_404");
  });

  it("rejects empty bodies", async () => {
    const result = await fetchLegalDocument("https://example.gov.ph/empty", {
      resolve: publicResolve,
      fetchImpl: async () =>
        response("", {
          status: 200,
          headers: { "content-type": "text/plain", "content-length": "0" },
        }),
    });
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("empty_body");
  });

  it("classifies private, loopback, link-local and IPv4-mapped addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.5",
      "172.20.0.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
  });
});
