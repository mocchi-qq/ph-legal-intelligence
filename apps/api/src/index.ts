type Env = Record<string, unknown>;

export default {
  fetch(_req: Request, _env: Env, _ctx: ExecutionContext): Response {
    return new Response("PHLI API", { status: 200 });
  },
} satisfies ExportedHandler<Env>;
