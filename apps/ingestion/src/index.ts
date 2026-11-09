export default {
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("Processing", batch.messages.length, "messages");
  }
} satisfies ExportedHandler<Env>;

interface Env {}
