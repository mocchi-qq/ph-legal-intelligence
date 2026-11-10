// @phli/legal-ingestion — corpus store (artifact preservation + state)
// File-backed store mirrors the R2/D1 split: originals in artifacts/, metadata
// in state.json. The in-memory store is used by tests and the benchmark.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { CorpusState } from "./types";
import { emptyCorpusState } from "./types";

export function sha256(content: string | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(
    typeof content === "string" ? Buffer.from(content, "utf8") : content,
  );
  return hash.digest("hex");
}

function extensionFor(mimeType: string): string {
  if (mimeType === "text/html") return ".html";
  if (mimeType === "application/xhtml+xml") return ".xhtml";
  if (mimeType === "text/plain") return ".txt";
  return ".bin";
}

export class CorpusStore {
  state: CorpusState;
  readonly dir?: string;

  constructor(state: CorpusState = emptyCorpusState(), dir?: string) {
    this.state = state;
    this.dir = dir;
    if (dir) {
      mkdirSync(join(dir, "artifacts"), { recursive: true });
    }
  }

  static memory(): CorpusStore {
    return new CorpusStore();
  }

  static async file(dir: string): Promise<CorpusStore> {
    const statePath = join(dir, "state.json");
    const state = existsSync(statePath)
      ? (JSON.parse(readFileSync(statePath, "utf8")) as CorpusState)
      : emptyCorpusState();
    return new CorpusStore(state, dir);
  }

  /** Preserve the original artifact bytes, content-addressed. Returns the storage key. */
  preserve(
    content: string | Uint8Array,
    mimeType: string,
    hash: string,
  ): { key: string; existed: boolean } {
    const key = `artifacts/${hash}${extensionFor(mimeType)}`;
    if (!this.dir) return { key, existed: false };
    const path = join(this.dir, key);
    const existed = existsSync(path);
    if (!existed) {
      writeFileSync(
        path,
        typeof content === "string" ? Buffer.from(content, "utf8") : content,
      );
    }
    return { key, existed };
  }

  save(): void {
    if (!this.dir) return;
    writeFileSync(
      join(this.dir, "state.json"),
      `${JSON.stringify(this.state, null, 2)}\n`,
    );
  }

  snapshot(): CorpusState {
    return structuredClone(this.state);
  }
}

export { extname };
