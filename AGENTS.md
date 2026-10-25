# AGENTS.md

agentdoctor scores how well AI coding agents can work in a repository. TypeScript, Node >= 20, zero runtime dependencies.

## Commands

```sh
npm ci                 # install (lockfile is committed)
npm test               # vitest, all tests must pass
npm run typecheck      # tsc --noEmit, strict mode
npm run lint           # biome check
npm run build          # compiles to dist/
node dist/src/bin.js . # score this repo
```

## Layout

- `src/checks.ts`: every check. One exported `Check` object each; points must sum to 100 (a test enforces it).
- `src/score.ts`: loads the file tree once, memoises reads, runs checks.
- `src/sources/`: `local.ts` (git ls-files), `github.ts` (public API + raw.githubusercontent.com), `memory.ts` (tests).
- `src/report/render.ts`: terminal, Markdown, SVG badge.
- `web/`: static demo that runs the same core in the browser.

## Rules

- No runtime dependencies. Dev dependencies only.
- Every check must return evidence (paths/commands) and a concrete `fix` when it does not pass.
- Every new check needs a passing and a failing test in `test/checks.test.ts`, and a row in `docs/checks.md`.
- Never send a token anywhere except `https://api.github.com`.
