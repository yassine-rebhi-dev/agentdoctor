import { METHOD_URL } from "./meta.js";
import type { Check, Context } from "./types.js";

const AGENTS_MD = "https://agents.md";
const CLAUDE_MEMORY = "https://docs.anthropic.com/en/docs/claude-code/memory";
const METHOD = METHOD_URL;

/** Files agents load as standing instructions. Order = preference when reporting. */
const INSTRUCTION_FILES = [
  /^AGENTS\.md$/i,
  /^CLAUDE\.md$/i,
  /^GEMINI\.md$/i,
  /^\.github\/copilot-instructions\.md$/,
  /^\.cursor\/rules\/.+\.mdc?$/,
  /^\.cursorrules$/,
  /^\.windsurfrules$/,
  /^\.clinerules(\/.+)?$/,
];
const COMMAND = /(^|\n)\s*(\$\s*)?(npm|pnpm|yarn|bun|npx|make|just|cargo|go|pytest|uv|poetry|pip|python3?|ruff|mypy|tox|nox|gradle|\.\/gradlew|mvn|dotnet|deno|bundle|rake|mix|task)\b[^\n]*|`(npm|pnpm|yarn|bun|make|just|cargo|go|pytest|uv|poetry|ruff|mvn|gradle|dotnet|deno) [^`]+`/;
const NPM_PLACEHOLDER = /no test specified/i;
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "poetry.lock", "uv.lock",
  "Pipfile.lock", "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock", "pdm.lock", "flake.lock", "mix.lock"];
const TYPED_LANG_MARKERS = ["go.mod", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "Package.swift", "pubspec.yaml"];
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|scala|ex|exs|vue|svelte)$/;
const NOT_HANDWRITTEN = /(^|\/)(node_modules|dist|build|vendor|vendored|third_party|\.next|out|coverage|generated|__generated__|compiled)\/|\.min\.|\.bundle\.|-lock\.|\.lock$|\.snap$|\.d\.ts$/;
/** Tests, fixtures, examples and benchmarks: big files and throwaway .env files are normal there. */
const NON_PRODUCT = /(^|\/)(tests?|__tests__|spec|specs|fixtures?|__fixtures__|testdata|test-data|benches|bench|benchmarks?|examples?|samples?|demos?)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$/;
const NESTED_INSTRUCTIONS = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/i;
const LARGE_BYTES = 100_000;

const top = (ctx: Context, name: string) => ctx.paths.has(name);
/** First file called `name` at the root or up to two folders down (monorepo sub-projects), shallowest first. */
const near = (ctx: Context, name: string): string | undefined =>
  ctx.files.map((f) => f.path).filter((p) => (p === name || p.endsWith(`/${name}`)) && p.split("/").length <= 3)
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
const rootInstructionFiles = (ctx: Context) =>
  ctx.files.map((f) => f.path).filter((p) => INSTRUCTION_FILES.some((re) => re.test(p)))
    .sort((a, b) => INSTRUCTION_FILES.findIndex((re) => re.test(a)) - INSTRUCTION_FILES.findIndex((re) => re.test(b)));
const nestedInstructionFiles = (ctx: Context) =>
  ctx.files.map((f) => f.path).filter((p) => p.includes("/") && NESTED_INSTRUCTIONS.test(p) && !p.startsWith(".github/") && !NON_PRODUCT.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length);
/** Root-level files if any, else nested ones (AGENTS.md allows per-directory files; the nearest one applies). */
const instructionFiles = (ctx: Context) => {
  const root = rootInstructionFiles(ctx);
  return root.length ? root : nestedInstructionFiles(ctx);
};

async function json(ctx: Context, path: string): Promise<Record<string, any> | null> {
  const t = await ctx.read(path);
  if (t == null) return null;
  try {
    // tolerate JSONC (tsconfig): strip comments and trailing commas
    return JSON.parse(t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

export const instructionsFile: Check = {
  id: "instructions-file",
  title: "Agent instructions file",
  maxPoints: 20,
  source: AGENTS_MD,
  async run(ctx) {
    const found = rootInstructionFiles(ctx);
    if (found.length) return { status: "pass", points: 20, evidence: found.slice(0, 5) };
    const nested = nestedInstructionFiles(ctx);
    if (nested.length) return { status: "partial", points: 10, evidence: nested.slice(0, 5),
      fix: "Only sub-folder instruction files exist. Add a root AGENTS.md so agents get the project-wide commands and conventions before they reach a sub-folder." };
    return { status: "fail", points: 0, evidence: [],
      fix: "Add an AGENTS.md at the repo root (read by Codex, Cursor, Copilot and others; symlink or copy it to CLAUDE.md for Claude Code) describing how to install, build, test and lint." };
  },
};

export const instructionsCommands: Check = {
  id: "instructions-commands",
  title: "Instructions include runnable commands",
  maxPoints: 10,
  source: AGENTS_MD,
  async run(ctx) {
    const files = instructionFiles(ctx);
    for (const f of files) {
      const t = (await ctx.read(f)) ?? "";
      const m = t.match(COMMAND);
      if (m) return { status: "pass", points: 10, evidence: [`${f}: ${m[0].trim().slice(0, 60)}`] };
    }
    return { status: "fail", points: 0, evidence: files,
      fix: "List the exact commands an agent should run (install, build, test, lint) in a code block, so it never has to guess." };
  },
};

export const instructionsSize: Check = {
  id: "instructions-size",
  title: "Instructions are focused (fit the context budget)",
  maxPoints: 5,
  source: CLAUDE_MEMORY,
  async run(ctx) {
    const files = instructionFiles(ctx);
    if (!files.length) return { status: "fail", points: 0, evidence: [], fix: "Add an instructions file first (see above)." };
    const sizes = ctx.files.filter((f) => files.includes(f.path));
    const total = sizes.reduce((s, f) => s + f.size, 0);
    const ev = [`${files.length} file(s), ${(total / 1024).toFixed(1)} KB (~${Math.round(total / 4).toLocaleString("en")} tokens) loaded into every session`];
    if (total > 40_000) return { status: "fail", points: 0, evidence: ev,
      fix: "Cut standing instructions below ~40 KB (~10k tokens): keep commands and conventions, move reference material to docs the agent can open on demand." };
    if (total > 20_000) return { status: "partial", points: 3, evidence: ev, fix: "Consider trimming instructions below ~20 KB; everything here costs context on every turn." };
    if (total < 60) return { status: "partial", points: 2, evidence: ev, fix: "The instructions file is nearly empty; add commands and conventions." };
    return { status: "pass", points: 5, evidence: ev };
  },
};

export const testCommand: Check = {
  id: "test-command",
  title: "One discoverable test command",
  maxPoints: 15,
  source: METHOD,
  async run(ctx) {
    const pkg = await json(ctx, "package.json");
    const t = pkg?.scripts?.test;
    if (typeof t === "string" && !NPM_PLACEHOLDER.test(t)) return { status: "pass", points: 15, evidence: [`package.json scripts.test: ${t}`] };
    const mk = (await ctx.read("Makefile")) ?? (await ctx.read("justfile")) ?? "";
    if (/^test\s*:/m.test(mk)) return { status: "pass", points: 15, evidence: ["Makefile/justfile `test` target"] };
    const paths = [...ctx.paths];
    const py = (await ctx.read("pyproject.toml")) ?? "";
    if ((/\[tool\.pytest/.test(py) || top(ctx, "pytest.ini") || top(ctx, "tox.ini") || top(ctx, "noxfile.py")) && paths.some((p) => /(^|\/)test_[^/]+\.py$|_test\.py$/.test(p)))
      return { status: "pass", points: 15, evidence: ["pytest configuration + test files"] };
    if (near(ctx, "Cargo.toml") && paths.some((p) => p.endsWith(".rs"))) {
      for (const p of paths.filter((x) => x.endsWith(".rs")).slice(0, 40)) {
        if (/(^|\/)tests\//.test(p) || /#\[(cfg\(test\)|test)\]/.test((await ctx.read(p)) ?? ""))
          return { status: "pass", points: 15, evidence: ["cargo test (Rust tests found)"] };
      }
    }
    if (near(ctx, "go.mod") && paths.some((p) => p.endsWith("_test.go"))) return { status: "pass", points: 15, evidence: ["go test ./... (_test.go files found)"] };
    if (paths.some((p) => /(^|\/)(test|tests|__tests__|spec)\//.test(p) || /\.(test|spec)\.[jt]sx?$/.test(p)))
      return { status: "partial", points: 6, evidence: ["test files exist but no single command runs them"],
        fix: "Expose one command that runs the whole suite (e.g. `\"test\": \"vitest run\"` in package.json or a `make test` target) and mention it in AGENTS.md." };
    return { status: "fail", points: 0, evidence: [],
      fix: "Agents verify their own changes by running tests. Add a test suite and a single `test` command." };
  },
};

export const taskScripts: Check = {
  id: "task-scripts",
  title: "Build / dev commands are scripted",
  maxPoints: 5,
  source: METHOD,
  async run(ctx) {
    const pkg = await json(ctx, "package.json");
    const s = Object.keys(pkg?.scripts ?? {});
    const runners = ["Makefile", "justfile", "Taskfile.yml", "Taskfile.yaml", "noxfile.py", "tox.ini"].filter((f) => top(ctx, f));
    const py = (await ctx.read("pyproject.toml")) ?? "";
    const ev = [...(s.length ? [`package.json scripts: ${s.slice(0, 6).join(", ")}`] : []), ...runners,
      ...(/\[(project\.scripts|tool\.poe\.tasks|tool\.hatch\.envs)/.test(py) ? ["pyproject task definitions"] : [])];
    if (ev.length || top(ctx, "Cargo.toml") || top(ctx, "go.mod")) return { status: "pass", points: 5, evidence: ev.length ? ev : ["standard toolchain commands (cargo / go)"] };
    return { status: "fail", points: 0, evidence: [], fix: "Script the common tasks (build, dev, lint) in package.json, a Makefile or a justfile." };
  },
};

export const lint: Check = {
  id: "lint",
  title: "Linter / formatter configured",
  maxPoints: 8,
  source: METHOD,
  async run(ctx) {
    const paths = [...ctx.paths];
    const cfg = paths.filter((p) => !p.includes("/") && /^(\.?eslint(rc)?(\..+)?|eslint\.config\.[cm]?[jt]s|biome\.jsonc?|\.prettierrc(\..+)?|prettier\.config\.[cm]?js|ruff\.toml|\.ruff\.toml|\.flake8|\.pylintrc|\.golangci\.ya?ml|rustfmt\.toml|\.rustfmt\.toml|clippy\.toml|\.rubocop\.yml|\.swiftlint\.yml|deno\.jsonc?|\.editorconfig|dprint\.json|oxlintrc\.json|\.oxlintrc\.json)$/i.test(p));
    const py = (await ctx.read("pyproject.toml")) ?? "";
    if (/\[tool\.(ruff|black|pylint|flake8|isort)/.test(py)) cfg.push("pyproject.toml [tool.*] linter");
    const pkg = await json(ctx, "package.json");
    if (pkg?.eslintConfig || pkg?.prettier || pkg?.xo) cfg.push("package.json lint config");
    const deps = { ...(pkg?.devDependencies ?? {}), ...(pkg?.dependencies ?? {}) };
    const declared = Object.keys(deps).filter((d) => /^(xo|eslint|@biomejs\/biome|prettier|standard|oxlint|ts-standard|dprint)$/.test(d));
    if (declared.length) cfg.push(`package.json devDependencies: ${declared.join(", ")}`);
    if (near(ctx, "go.mod") || near(ctx, "Cargo.toml")) cfg.push("built-in formatter (gofmt / rustfmt)");
    const real = cfg.filter((c) => c !== ".editorconfig");
    if (real.length) return { status: "pass", points: 8, evidence: real.slice(0, 4) };
    if (cfg.length) return { status: "partial", points: 3, evidence: cfg, fix: "Add a linter/formatter (ESLint/Biome, Ruff, …) so agents can check style mechanically." };
    return { status: "fail", points: 0, evidence: [], fix: "Add a linter/formatter config so agents can check their own style mechanically instead of guessing it." };
  },
};

export const typecheck: Check = {
  id: "typecheck",
  title: "Type checking available",
  maxPoints: 7,
  source: METHOD,
  async run(ctx) {
    const typed = TYPED_LANG_MARKERS.map((f) => near(ctx, f)).filter((p): p is string => !!p);
    if (typed.length) return { status: "pass", points: 7, evidence: [`statically typed language (${typed[0]})`] };
    const tsPath = near(ctx, "tsconfig.json");
    const ts = tsPath ? await json(ctx, tsPath) : null;
    if (ts && tsPath) {
      // strict may be inherited through "extends"; follow one level within the repo
      let strict = ts.compilerOptions?.strict;
      if (strict === undefined && typeof ts.extends === "string" && ts.extends.startsWith(".")) {
        const base = await json(ctx, joinPath(tsPath, ts.extends.endsWith(".json") ? ts.extends : `${ts.extends}.json`));
        strict = base?.compilerOptions?.strict;
      }
      if (strict === undefined && typeof ts.extends === "string" && !ts.extends.startsWith("."))
        return { status: "partial", points: 5, evidence: [`${tsPath} extends ${ts.extends} (strictness not verified)`],
          fix: "Set `\"strict\": true` explicitly in tsconfig.json so humans and agents can see it." };
      return strict === true
        ? { status: "pass", points: 7, evidence: [`${tsPath} strict: true`] }
        : { status: "partial", points: 4, evidence: [`${tsPath} without strict`], fix: "Enable `\"strict\": true` so type errors catch agent mistakes early." };
    }
    const py = (await ctx.read("pyproject.toml")) ?? "";
    if (/\[tool\.(mypy|pyright|basedpyright)/.test(py) || top(ctx, "mypy.ini") || top(ctx, "pyrightconfig.json") || top(ctx, ".mypy.ini"))
      return { status: "pass", points: 7, evidence: ["mypy / pyright configured"] };
    if (top(ctx, "package.json") || top(ctx, "pyproject.toml") || top(ctx, "setup.py") || top(ctx, "requirements.txt"))
      return { status: "fail", points: 0, evidence: [], fix: "Add type checking (TypeScript strict, or mypy/pyright for Python): it is the cheapest automatic check an agent can run." };
    return { status: "partial", points: 3, evidence: ["no recognised project manifest"], fix: "Add a project manifest so tooling (and agents) can be detected." };
  },
};

export const lockfile: Check = {
  id: "lockfile",
  title: "Dependencies are locked",
  maxPoints: 7,
  source: METHOD,
  async run(ctx) {
    const found = LOCKFILES.map((f) => near(ctx, f)).filter((p): p is string => !!p);
    if (found.length) return { status: "pass", points: 7, evidence: found };
    const manifests = ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "Gemfile", "composer.json"].filter((f) => top(ctx, f));
    if (!manifests.length) return { status: "pass", points: 7, evidence: ["no dependency manifest (nothing to lock)"] };
    if (manifests.includes("requirements.txt") && /==/.test((await ctx.read("requirements.txt")) ?? ""))
      return { status: "partial", points: 4, evidence: ["requirements.txt with pinned versions"], fix: "Use a real lockfile (uv.lock / poetry.lock) for reproducible installs." };
    return { status: "fail", points: 0, evidence: manifests, fix: "Commit a lockfile so the agent installs exactly what you test with." };
  },
};

export const ci: Check = {
  id: "ci",
  title: "CI runs on every change",
  maxPoints: 8,
  source: METHOD,
  async run(ctx) {
    const found = [...ctx.paths].filter((p) => /^\.github\/workflows\/.+\.ya?ml$|^\.gitlab-ci\.yml$|^\.circleci\/config\.yml$|^azure-pipelines\.yml$|^\.buildkite\/|^Jenkinsfile$|^\.woodpecker/.test(p));
    if (found.length) return { status: "pass", points: 8, evidence: found.slice(0, 3) };
    return { status: "fail", points: 0, evidence: [], fix: "Add CI (e.g. a GitHub Actions workflow running lint + tests) so agent pull requests are verified automatically." };
  },
};

export const largeFiles: Check = {
  id: "large-files",
  title: "No giant hand-written source files",
  maxPoints: 5,
  source: METHOD,
  async run(ctx) {
    const big = ctx.files.filter((f) => SOURCE_EXT.test(f.path) && !NOT_HANDWRITTEN.test(f.path) && !NON_PRODUCT.test(f.path) && f.size > LARGE_BYTES)
      .sort((a, b) => b.size - a.size);
    if (!big.length) return { status: "pass", points: 5, evidence: [`no non-test source file over ${LARGE_BYTES / 1000} KB`] };
    const ev = big.slice(0, 5).map((f) => `${f.path} (${Math.round(f.size / 1000)} KB, ~${Math.round(f.size / 4 / 1000)}k tokens)`);
    return { status: big.length > 3 ? "fail" : "partial", points: big.length > 3 ? 0 : 2, evidence: ev,
      fix: "Split very large source files: an agent must read a whole file to edit it safely, and these eat most of a context window." };
  },
};

export const envSafety: Check = {
  id: "env-safety",
  title: "No committed secrets file; env documented",
  maxPoints: 5,
  source: METHOD,
  async run(ctx) {
    const committed = [...ctx.paths].filter((p) => /(^|\/)\.env(\.(local|production|development|prod|dev))?$/.test(p) && !NON_PRODUCT.test(p));
    if (committed.length) return { status: "fail", points: 0, evidence: committed,
      fix: "Remove committed .env files (rotate any secrets in them) and commit a .env.example with placeholder values instead." };
    const ex = [...ctx.paths].filter((p) => /(^|\/)\.env\.(example|sample|template|dist)$|(^|\/)env\.example$/.test(p));
    return { status: "pass", points: 5, evidence: ex.length ? ex : ["no committed .env"] };
  },
};

export const readmeQuickstart: Check = {
  id: "readme-quickstart",
  title: "README has a runnable quick start",
  maxPoints: 5,
  source: METHOD,
  async run(ctx) {
    const readme = [...ctx.paths].find((p) => /^readme(\.(md|markdown|rst|txt))?$/i.test(p));
    if (!readme) return { status: "fail", points: 0, evidence: [], fix: "Add a README with install and usage commands." };
    const t = (await ctx.read(readme)) ?? "";
    if (/```/.test(t) && COMMAND.test(t)) return { status: "pass", points: 5, evidence: [`${readme} contains command blocks`] };
    return { status: "partial", points: 2, evidence: [readme], fix: "Add a quick-start code block with the exact install and run commands." };
  },
};

export const CHECKS: Check[] = [instructionsFile, instructionsCommands, instructionsSize, testCommand, taskScripts,
  lint, typecheck, lockfile, ci, largeFiles, envSafety, readmeQuickstart];

/** Resolve a relative path against the directory of `from` (POSIX, repo-relative). */
function joinPath(from: string, rel: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const seg of rel.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}
