import type { FileEntry, RepoSource } from "../types.js";

/** In-memory repo, used by tests and the leaderboard fixtures. */
export class MemorySource implements RepoSource {
  constructor(
    readonly name: string,
    private readonly files: Record<string, string>,
  ) {}

  async list(): Promise<FileEntry[]> {
    return Object.entries(this.files).map(([path, text]) => ({ path, size: Buffer.byteLength(text) }));
  }

  async read(path: string): Promise<string | null> {
    return this.files[path] ?? null;
  }
}
