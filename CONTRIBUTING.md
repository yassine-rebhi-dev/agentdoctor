# Contributing

Thanks for helping. agentdoctor is small on purpose: zero runtime dependencies, every check explainable in one paragraph.

## Setup

```sh
npm ci
npm test
npm run typecheck && npm run lint
npm run build && node dist/src/bin.js .
npm run web:dev   # the browser demo at http://localhost:5173
```

## Proposing or changing a check

A check earns its place only if an agent measurably works better when it passes. In the issue or PR, include:

1. **What the agent can't do without it**, with a concrete example (a repo, a failure mode).
2. **How it is detected** from the file tree and file contents only (no cloning, no running code).
3. **False positives you tested.** Run it against at least 5 well-known repos of different shapes (monorepo, Python, Rust, a small library) and paste the results.

Then:
- Add the `Check` to `src/checks.ts` with evidence and a concrete `fix`.
- Rebalance points so the total stays 100 (a test enforces this) and explain the trade in the PR.
- Add a passing and a failing test in `test/checks.test.ts`, and a row in `docs/checks.md`.

## Reporting a wrong score

Open an issue with the repo, the check, and what it should have found. Wrong scores on real repos are the most valuable bug reports we get; each one becomes a regression test (see the "real-world regressions" block in `test/checks.test.ts`).

## Style

`npm run lint` (Biome) and strict TypeScript. Prefer clear names over comments; comment the *why* when a rule exists because of a real repo.
