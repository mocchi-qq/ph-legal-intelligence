type Env = Record<string, unknown>;

export default {
  async queue(
    batch: MessageBatch<unknown>,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log("Processing", batch.messages.length, "messages");
  },
} satisfies ExportedHandler<Env>;
