import type { Context } from "@cloudflare/workers-types";

const API_DATA: Record<string, any> = {
  "/": {
    name: "Philippine Legal Intelligence Platform",
    version: "0.1.0",
    status: "operational",
    endpoints: ["/api/", "/api/health", "/api/ingest", "/api/search"],
  },
  "/health": {
    status: "healthy",
    service: "phli",
  },
};

export async function onRequest(context: Context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace("/api", "");

  const data = API_DATA[pathname] || { error: "Not found" };
  const status = data.error ? 404 : 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
