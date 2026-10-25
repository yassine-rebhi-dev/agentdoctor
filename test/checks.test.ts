import { describe, expect, it } from "vitest";
import { MemorySource } from "../src/sources/memory.js";
import { score } from "../src/score.js";
import type { Report } from "../src/types.js";

const run = (files: Record<string, string>): Promise<Report> => score(new MemorySource("test/repo", files));
const byId = (r: Report, id: string) => {
  const c = r.results.find((x) => x.id === id);
  if (!c) throw new Error(`missing check ${id}`);
  return c;
};

const GOOD_AGENTS = "# AGENTS.md\n\n## Commands\n\n```sh\nnpm install\nnpm test\nnpm run lint\n```\n\nUse TypeScript strict mode.\n";
const GOOD_PKG = JSON.stringify({ scripts: { build: "tsc", test: "vitest run", lint: "eslint ." } });

describe("instructions-file", () => {
  it("passes with AGENTS.md", async () => {
    const r = await run({ "AGENTS.md": GOOD_AGENTS });
    expect(byId(r, "instructions-file").status).toBe("pass");
    expect(byId(r, "instructions-file").evidence).toContain("AGENTS.md");
  });
  it("accepts CLAUDE.md, copilot and cursor rules", async () => {
    for (const p of ["CLAUDE.md", ".github/copilot-instructions.md", ".cursor/rules/style.mdc", "GEMINI.md"]) {
      const r = await run({ [p]: GOOD_AGENTS });
      expect(byId(r, "instructions-file").status, p).toBe("pass");
    }
  });
  it("fails without any instructions file and suggests a fix", async () => {
    const c = byId(await run({ "README.md": "# hi" }), "instructions-file");
    expect(c.status).toBe("fail");
    expect(c.points).toBe(0);
    expect(c.fix).toMatch(/AGENTS\.md/);
  });
});

describe("instructions-commands", () => {
  it("passes when the instructions file names runnable commands", async () => {
    expect(byId(await run({ "AGENTS.md": GOOD_AGENTS }), "instructions-commands").status).toBe("pass");
  });
  it("fails when the instructions file is prose only", async () => {
    const r = await run({ "CLAUDE.md": "# Notes\n\nBe nice. Write good code.\n" });
    expect(byId(r, "instructions-commands").status).toBe("fail");
  });
});

describe("instructions-size", () => {
  it("fails a huge instructions file that eats the context window", async () => {
    const r = await run({ "CLAUDE.md": "x ".repeat(30_000) });
    expect(byId(r, "instructions-size").status).toBe("fail");
  });
  it("passes a focused file", async () => {
    expect(byId(await run({ "AGENTS.md": GOOD_AGENTS }), "instructions-size").status).toBe("pass");
  });
});

describe("test-command", () => {
  it("passes with a real npm test script", async () => {
    expect(byId(await run({ "package.json": GOOD_PKG }), "test-command").status).toBe("pass");
  });
  it("fails with npm's placeholder test script", async () => {
    const pkg = JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } });
    expect(byId(await run({ "package.json": pkg }), "test-command").status).toBe("fail");
  });
  it("recognises pytest, cargo and go projects", async () => {
    expect(byId(await run({ "pyproject.toml": "[tool.pytest.ini_options]\n", "tests/test_x.py": "" }), "test-command").status).toBe("pass");
    expect(byId(await run({ "Cargo.toml": "[package]\n", "src/lib.rs": "#[cfg(test)]\nmod tests {}" }), "test-command").status).toBe("pass");
    expect(byId(await run({ "go.mod": "module x\n", "x_test.go": "" }), "test-command").status).toBe("pass");
  });
  it("recognises a Makefile test target", async () => {
    expect(byId(await run({ Makefile: "test:\n\tpytest\n" }), "test-command").status).toBe("pass");
  });
});

describe("lockfile", () => {
  it("passes with a lockfile, fails a node project without one", async () => {
    expect(byId(await run({ "package.json": GOOD_PKG, "pnpm-lock.yaml": "" }), "lockfile").status).toBe("pass");
    expect(byId(await run({ "package.json": GOOD_PKG }), "lockfile").status).toBe("fail");
  });
});

describe("typecheck", () => {
  it("passes strict tsconfig, partial non-strict, auto-pass for typed languages", async () => {
    expect(byId(await run({ "tsconfig.json": '{"compilerOptions":{"strict":true}}' }), "typecheck").status).toBe("pass");
    expect(byId(await run({ "tsconfig.json": '{"compilerOptions":{}}' }), "typecheck").status).toBe("partial");
    expect(byId(await run({ "go.mod": "module x" }), "typecheck").status).toBe("pass");
  });
  it("tolerates comments in tsconfig", async () => {
    const r = await run({ "tsconfig.json": '{\n  // comment\n  "compilerOptions": { "strict": true, }\n}' });
    expect(byId(r, "typecheck").status).toBe("pass");
  });
});

describe("large-files", () => {
  it("flags oversized source files but ignores lockfiles and minified bundles", async () => {
    const big = "a".repeat(120_000);
    const r = await run({ "src/huge.ts": big, "package-lock.json": big, "public/app.min.js": big });
    const c = byId(r, "large-files");
    expect(c.status).not.toBe("pass");
    expect(c.evidence.join(" ")).toContain("src/huge.ts");
    expect(c.evidence.join(" ")).not.toContain("package-lock.json");
  });
});

describe("env-safety", () => {
  it("fails a committed .env, passes .env.example", async () => {
    expect(byId(await run({ ".env": "KEY=1" }), "env-safety").status).toBe("fail");
    expect(byId(await run({ ".env.example": "KEY=" }), "env-safety").status).toBe("pass");
  });
});

describe("score", () => {
  it("is 0-100, sums check points, and grades a well-prepared repo highly", async () => {
    const r = await run({
      "AGENTS.md": GOOD_AGENTS,
      "package.json": GOOD_PKG,
      "package-lock.json": "{}",
      "tsconfig.json": '{"compilerOptions":{"strict":true}}',
      "eslint.config.js": "",
      ".github/workflows/ci.yml": "on: push",
      ".env.example": "",
      "README.md": "# x\n\n## Quick start\n\n```sh\nnpm install\nnpm start\n```\n",
    });
    const max = r.results.reduce((s, c) => s + c.maxPoints, 0);
    expect(max).toBe(100);
    expect(r.score).toBe(r.results.reduce((s, c) => s + c.points, 0));
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe("A");
  });
  it("an empty repo scores low", async () => {
    const r = await run({ "README.md": "hello" });
    expect(r.score).toBeLessThan(25);
  });
});

describe("real-world regressions (found by scoring openai/codex, microsoft/vscode, vercel/next.js, astral-sh/uv)", () => {
  it("only-nested AGENTS.md is partial credit, not a fail", async () => {
    const c = byId(await run({ "codex-rs/tui/AGENTS.md": GOOD_AGENTS }), "instructions-file");
    expect(c.status).toBe("partial");
    expect(c.points).toBeGreaterThan(0);
    expect(c.fix).toMatch(/root/);
  });
  it("finds typed-language and test markers in monorepo subfolders", async () => {
    const r = await run({ "codex-rs/Cargo.toml": "[workspace]", "codex-rs/core/tests/a.rs": "#[test] fn a(){}", "web/tsconfig.json": '{"compilerOptions":{"strict":true}}' });
    expect(byId(r, "typecheck").status).toBe("pass");
  });
  it("large-files ignores tests, fixtures and compiled bundles", async () => {
    const big = "a".repeat(150_000);
    const r = await run({ "crates/uv/tests/lock.rs": big, "packages/next/src/compiled/webpack/bundle5.js": big, "test/fixtures/x.ts": big, "src/foo.test.ts": big });
    expect(byId(r, "large-files").status).toBe("pass");
  });
  it("env-safety ignores .env files in examples/tests/fixtures", async () => {
    const r = await run({ "examples/convex/.env": "X=1", "extensions/x/test/fixtures/.env": "Y=2" });
    expect(byId(r, "env-safety").status).toBe("pass");
    expect(byId(await run({ "apps/web/.env": "SECRET=1" }), "env-safety").status).toBe("fail");
  });
});

describe("package.json-declared tooling", () => {
  it("counts linters declared as devDependencies (xo, eslint, biome, prettier, standard)", async () => {
    const pkg = JSON.stringify({ devDependencies: { xo: "^0.59.0" } });
    expect(byId(await run({ "package.json": pkg }), "lint").status).toBe("pass");
  });
  it("says strictness is unverified when tsconfig extends an npm package", async () => {
    const c = byId(await run({ "tsconfig.json": '{"extends":"@sindresorhus/tsconfig"}' }), "typecheck");
    expect(c.status).toBe("partial");
    expect(c.evidence.join(" ")).toMatch(/@sindresorhus\/tsconfig/);
  });
});

describe("repo kind", () => {
  it("labels mostly-Markdown repos without a code manifest as content", async () => {
    const files: Record<string, string> = { "README.md": "# list" };
    for (let i = 0; i < 20; i++) files[`skills/s${i}/SKILL.md`] = "x";
    expect((await run(files)).kind).toBe("content");
  });
  it("labels projects with a manifest as code", async () => {
    expect((await run({ "package.json": GOOD_PKG, "docs/a.md": "", "docs/b.md": "" })).kind).toBe("code");
  });
});

describe("repo kind thresholds (calibrated on JavaGuide, awesome-claude-skills, markitdown)", () => {
  it("a docs site with a package.json is still content when >= 80% of files are docs", async () => {
    const files: Record<string, string> = { "package.json": "{}" };
    for (let i = 0; i < 9; i++) files[`docs/p${i}.md`] = "x";
    expect((await run(files)).kind).toBe("content");
  });
  it("a deep requirements.txt does not make a skill pack a code project", async () => {
    const files: Record<string, string> = { "skills/gif/requirements.txt": "pillow" };
    for (let i = 0; i < 2; i++) files[`skills/s${i}/SKILL.md`] = "x";
    expect((await run(files)).kind).toBe("content");
  });
});
