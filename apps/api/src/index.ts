export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Response {
    return new Response("PHLI API", { status: 200 });
  }
} satisfies ExportedHandler<Env>;

interface Env {}
