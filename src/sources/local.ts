import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { FileEntry, RepoSource } from "../types.js";

const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", "target", ".next", ".turbo", ".cache"]);
const MAX_READ = 1_000_000;

/** A directory on disk. Prefers `git ls-files` (tracked + untracked, minus ignored) so the score matches what gets committed. */
export class LocalSource implements RepoSource {
  readonly name: string;
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
    this.name = dir;
  }

  async list(): Promise<FileEntry[]> {
    const paths = this.gitFiles() ?? this.walk(this.root);
    return paths.flatMap((p) => {
      try {
        return [{ path: p, size: statSync(join(this.root, p)).size }];
      } catch {
        return []; // deleted but still in the index
      }
    });
  }

  async read(path: string): Promise<string | null> {
    const full = resolve(this.root, path);
    if (full !== this.root && !full.startsWith(this.root + sep)) return null;
    try {
      if (statSync(full).size > MAX_READ) return null;
      return readFileSync(full, "utf8");
    } catch {
      return null;
    }
  }

  private gitFiles(): string[] | null {
    try {
      const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
        cwd: this.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024,
      });
      return out.split("\0").filter(Boolean);
    } catch {
      return null;
    }
  }

  private walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) this.walk(join(dir, e.name), out);
      } else if (e.isFile()) {
        out.push(relative(this.root, join(dir, e.name)).split(sep).join("/"));
      }
    }
    return out;
  }
}
