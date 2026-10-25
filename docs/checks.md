# How the score works

agentdoctor reads the file tree and a handful of files. It never clones, installs or runs anything, so a scan takes
seconds and is safe on any public repo. Twelve checks add up to 100 points. Each result shows the evidence it
found and, when it doesn't pass, the exact fix.

The weights reflect what an agent needs first: to know how to work in the repo (instructions, 35), then to be
able to verify its own changes (tests, types, lint, CI, 38), then to get a reproducible, safe environment (27).
They are a judgment call. If you think one is wrong, open an issue with a counter-example.

| Check | Points | Pass when | Why it matters to an agent |
|---|---|---|---|
| Agent instructions file | 20 | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/*`, `.cursorrules`, `.windsurfrules` or `.clinerules` at the root. Only sub-folder files: 10. | It is the one file every coding agent loads before doing anything ([agents.md](https://agents.md), [Claude Code memory](https://docs.anthropic.com/en/docs/claude-code/memory)). |
| Instructions include runnable commands | 10 | The instructions file contains an install/build/test/lint command. | Without the exact commands, agents guess (`npm test`? `pnpm test`? `make check`?) and burn turns on failures. |
| Instructions are focused | 5 | Instructions total under 20 KB (partial to 40 KB) and are not empty. | Standing instructions are loaded into every session; every KB is context the agent can't use for your code. |
| One discoverable test command | 15 | A real `test` script, a `test` make/just target, pytest config with tests, Rust tests, or Go `_test.go` files. Test files without a single command: 6. | Agents verify their own work by running tests. This is the strongest feedback loop they have. |
| Build / dev commands are scripted | 5 | `package.json` scripts, Makefile, justfile, Taskfile, nox/tox, pyproject tasks, or cargo/go. | Scripted tasks are discoverable; tribal knowledge in a wiki is not. |
| Linter / formatter configured | 8 | ESLint, Biome, Prettier, xo, Ruff, golangci-lint, rustfmt, RuboCop, SwiftLint, … (config file or declared dependency). | Style becomes mechanically checkable instead of a reviewer's opinion. |
| Type checking available | 7 | Statically typed language, `tsconfig.json` with `strict: true` (followed through relative `extends`), or mypy/pyright config. Non-strict TS: 4. | Type errors are the cheapest automatic signal that an edit broke something. |
| Dependencies are locked | 7 | A lockfile (npm, pnpm, yarn, bun, uv, poetry, Pipfile, Cargo, Go, Bundler, Composer, pdm, Nix, Mix). | The agent installs exactly what you test with. |
| CI runs on every change | 8 | GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, Buildkite, Jenkins or Woodpecker config. | Agent pull requests get verified by the same gate as human ones. |
| No giant hand-written source files | 5 | No non-test, non-generated source file over 100 KB. 1-3 such files: 2. | An agent must read a file to edit it safely; a 400 KB file is ~100k tokens. |
| No committed secrets file | 5 | No `.env` / `.env.local` / `.env.production` committed outside examples, tests and fixtures. | Agents read everything they're given; committed secrets end up in transcripts. |
| README has a runnable quick start | 5 | The README contains a code block with commands. | It is the fallback when there is no instructions file, and the first thing a human checks. |

Monorepos: manifests (`Cargo.toml`, `go.mod`, `tsconfig.json`, lockfiles) are found up to two folders deep.
Tests, fixtures, examples and benchmarks are excluded from the size and `.env` checks.

## What agentdoctor does not measure (yet)
- Whether the test suite actually passes or how long it takes (that needs running code).
- The quality of the instructions, beyond containing commands and being a sane size.
- Language-specific conventions beyond the markers above. PRs welcome; see CONTRIBUTING.md.
