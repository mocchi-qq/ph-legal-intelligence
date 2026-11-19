import type { Context } from "@cloudflare/workers-types";

export async function onRequest(context: Context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Unified PHLI API endpoints
  if (path === "/api/" || path === "/api") {
    return new Response(
      JSON.stringify({
        name: "Philippine Legal Intelligence Platform",
        version: "0.1.0",
        status: "operational",
        endpoints: ["/api/", "/api/health", "/api/ingest", "/api/search"],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (path === "/api/health") {
    return new Response(
      JSON.stringify({ status: "healthy", service: "phli" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (path === "/api/ingest") {
    return new Response(
      JSON.stringify({
        status: "accepted",
        message: "Ingestion endpoint ready. POST ingestion jobs here.",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
