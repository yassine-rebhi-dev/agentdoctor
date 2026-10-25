import type { FileEntry, RepoSource } from "../types.js";

export interface GitHubTarget {
  owner: string;
  repo: string;
  ref?: string;
}

const NAME = "[A-Za-z0-9_.-]+";
const URL_RE = new RegExp(`^(?:https?://)?(?:www\\.)?github\\.com/(${NAME})/(${NAME}?)(?:\\.git)?(?:/tree/([^/]+))?(?:/.*)?$`);
const SSH_RE = new RegExp(`^git@github\\.com:(${NAME})/(${NAME}?)(?:\\.git)?$`);
const SHORT_RE = new RegExp(`^(${NAME})/(${NAME})$`);
const MAX_READ = 1_000_000;

/** "owner/repo", a github.com URL (optionally /tree/<ref>), or an SSH remote. Returns null for anything else. */
export function parseGitHubTarget(input: string): GitHubTarget | null {
  const s = input.trim();
  if (s.startsWith(".") || s.startsWith("/") || s.startsWith("~")) return null;
  const m = s.match(URL_RE) ?? s.match(SSH_RE) ?? s.match(SHORT_RE);
  if (!m) return null;
  const t: GitHubTarget = { owner: m[1]!, repo: m[2]!.replace(/\.git$/, "") };
  if (m[3]) t.ref = m[3];
  return t;
}

interface Options {
  token?: string;
  fetch?: typeof fetch;
}

/** Reads a public repo through the GitHub API (2 calls) + raw.githubusercontent.com (no API quota). */
export class GitHubSource implements RepoSource {
  readonly name: string;
  private ref?: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly t: GitHubTarget, private readonly opts: Options = {}) {
    this.name = `${t.owner}/${t.repo}`;
    this.ref = t.ref;
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** fetch with one retry on network errors (not on HTTP errors). */
  private async get(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetch(url, init);
    } catch {
      return this.fetch(url, init);
    }
  }

  private async api(path: string): Promise<any> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (this.opts.token) headers.Authorization = `Bearer ${this.opts.token}`; // only ever sent to api.github.com
    const r = await this.get(`https://api.github.com${path}`, { headers });
    if (r.status === 403 || r.status === 429) {
      throw new Error(r.headers.get("x-ratelimit-remaining") === "0"
        ? "GitHub API rate limit reached (60 requests/hour without a token). Set GITHUB_TOKEN or try again later."
        : `GitHub refused the request (${r.status}).`);
    }
    if (r.status === 404) throw new Error(`Repository ${this.name} not found (or private).`);
    if (!r.ok) throw new Error(`GitHub API error ${r.status} for ${path}`);
    return r.json();
  }

  async list(): Promise<FileEntry[]> {
    if (!this.ref) this.ref = (await this.api(`/repos/${this.name}`)).default_branch as string;
    const tree = await this.api(`/repos/${this.name}/git/trees/${encodeURIComponent(this.ref)}?recursive=1`);
    return (tree.tree as Array<{ path: string; type: string; size?: number }>)
      .filter((e) => e.type === "blob")
      .map((e) => ({ path: e.path, size: e.size ?? 0 }));
  }

  async read(path: string): Promise<string | null> {
    if (!this.ref) await this.list();
    const url = `https://raw.githubusercontent.com/${this.name}/${encodeURIComponent(this.ref!)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const r = await this.get(url);
    if (!r.ok) return null;
    const text = await r.text();
    return text.length > MAX_READ ? null : text;
  }
}
