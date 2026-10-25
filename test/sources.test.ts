import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GitHubSource, parseGitHubTarget } from "../src/sources/github.js";
import { LocalSource } from "../src/sources/local.js";

describe("parseGitHubTarget", () => {
  it.each([
    ["owner/repo", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["github.com/owner/repo/tree/dev/src", { owner: "owner", repo: "repo", ref: "dev" }],
    ["git@github.com:owner/repo.git", { owner: "owner", repo: "repo" }],
  ])("%s", (input, want) => {
    expect(parseGitHubTarget(input)).toEqual(want);
  });
  it("rejects local paths and junk", () => {
    expect(parseGitHubTarget("./src")).toBeNull();
    expect(parseGitHubTarget("/home/me/project")).toBeNull();
    expect(parseGitHubTarget("not a repo")).toBeNull();
  });
});

describe("GitHubSource", () => {
  it("lists the tree and reads raw files through the injected fetch", async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      if (url.endsWith("/repos/o/r")) return new Response(JSON.stringify({ default_branch: "main" }));
      if (url.includes("/git/trees/main")) return new Response(JSON.stringify({ truncated: false, tree: [
        { path: "AGENTS.md", type: "blob", size: 10 }, { path: "src", type: "tree" }] }));
      if (url === "https://raw.githubusercontent.com/o/r/main/AGENTS.md") return new Response("npm test");
      return new Response("", { status: 404 });
    };
    const s = new GitHubSource({ owner: "o", repo: "r" }, { fetch: fake as typeof fetch });
    expect(await s.list()).toEqual([{ path: "AGENTS.md", size: 10 }]);
    expect(await s.read("AGENTS.md")).toBe("npm test");
    expect(await s.read("missing.md")).toBeNull();
    expect(calls.every((u) => u.startsWith("https://api.github.com/") || u.startsWith("https://raw.githubusercontent.com/"))).toBe(true);
  });
  it("explains rate limiting instead of failing silently", async () => {
    const fake = async () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403, headers: { "x-ratelimit-remaining": "0" } });
    const s = new GitHubSource({ owner: "o", repo: "r" }, { fetch: fake as unknown as typeof fetch });
    await expect(s.list()).rejects.toThrow(/rate limit/i);
  });
});

describe("LocalSource", () => {
  it("uses git's view of the repo, so ignored files (like a local .env) don't count", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdoctor-"));
    writeFileSync(join(dir, "AGENTS.md"), "npm test");
    writeFileSync(join(dir, ".gitignore"), ".env\n");
    writeFileSync(join(dir, ".env"), "SECRET=1");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export {}");
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "-A"], { cwd: dir });
    const paths = (await new LocalSource(dir).list()).map((f) => f.path).sort();
    expect(paths).toEqual([".gitignore", "AGENTS.md", "src/a.ts"]);
    expect(await new LocalSource(dir).read("AGENTS.md")).toBe("npm test");
  });
  it("falls back to walking the directory outside git, skipping node_modules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdoctor-"));
    writeFileSync(join(dir, "README.md"), "# x");
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "junk.js"), "");
    const paths = (await new LocalSource(dir).list()).map((f) => f.path);
    expect(paths).toEqual(["README.md"]);
  });
  it("refuses to read outside the repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdoctor-"));
    expect(await new LocalSource(dir).read("../../etc/passwd")).toBeNull();
  });
});

describe("GitHubSource resilience", () => {
  it("retries a transient network failure once", async () => {
    let n = 0;
    const flaky = async (url: string) => {
      if (n++ === 0) throw new TypeError("fetch failed");
      if (url.endsWith("/repos/o/r")) return new Response(JSON.stringify({ default_branch: "main" }));
      return new Response(JSON.stringify({ truncated: false, tree: [] }));
    };
    const s = new GitHubSource({ owner: "o", repo: "r" }, { fetch: flaky as typeof fetch });
    expect(await s.list()).toEqual([]);
  });
});
