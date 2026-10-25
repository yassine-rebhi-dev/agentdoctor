import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main, parseArgs, sourceFor } from "../src/cli.js";
import { badgeSvg, markdown } from "../src/report/render.js";
import { GitHubSource } from "../src/sources/github.js";
import { LocalSource } from "../src/sources/local.js";

afterEach(() => vi.restoreAllMocks());

describe("parseArgs", () => {
  it("defaults to the current directory", () => expect(parseArgs([]).target).toBe("."));
  it("parses options", () => {
    const a = parseArgs(["owner/repo", "--json", "--min-score", "70", "--badge", "b.svg"]);
    expect(a).toMatchObject({ target: "owner/repo", json: true, minScore: 70, badge: "b.svg" });
  });
  it("rejects unknown flags and bad scores", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown option/);
    expect(() => parseArgs(["--min-score", "abc"])).toThrow(/0-100/);
  });
});

describe("sourceFor", () => {
  it("routes owner/repo and URLs to GitHub, paths to disk", () => {
    expect(sourceFor("vercel/next.js")).toBeInstanceOf(GitHubSource);
    expect(sourceFor("https://github.com/a/b")).toBeInstanceOf(GitHubSource);
    expect(sourceFor(".")).toBeInstanceOf(LocalSource);
  });
});

describe("main", () => {
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdoctor-cli-"));
    writeFileSync(join(dir, "README.md"), "# x");
    return dir;
  };
  it("exits 1 below --min-score and writes a badge", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = repo();
    const badge = join(dir, "badge.svg");
    expect(await main([dir, "--min-score", "90", "--badge", badge])).toBe(1);
    expect(readFileSync(badge, "utf8")).toMatch(/^<svg[\s\S]*agent-ready[\s\S]*\/100/);
  });
  it("prints valid JSON with --json", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => void out.push(s));
    expect(await main([repo(), "--json"])).toBe(0);
    const r = JSON.parse(out.join(""));
    expect(r.results).toHaveLength(12);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("renderers", () => {
  it("badge colour tracks score; markdown lists every check", () => {
    expect(badgeSvg({ score: 95 })).toContain("#2ea043");
    expect(badgeSvg({ score: 10 })).toContain("#d73a49");
    const md = markdown({
      repo: "a/b", kind: "code", score: 50, grade: "D",
      results: [{ id: "x", title: "X", status: "fail", points: 0, maxPoints: 5, evidence: [], fix: "do it", source: "" }],
    });
    expect(md).toContain("| ✘ | X | 0/5 | do it |");
  });
});
