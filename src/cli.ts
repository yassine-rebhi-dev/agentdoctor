import { statSync, writeFileSync } from "node:fs";
import { score } from "./score.js";
import { GitHubSource, parseGitHubTarget } from "./sources/github.js";
import { VERSION } from "./meta.js";
import { LocalSource } from "./sources/local.js";
import { badgeSvg, markdown, terminal } from "./report/render.js";
import type { RepoSource } from "./types.js";

const HELP = `readyrepo: how well can AI coding agents work in this repo?

Usage
  npx readyrepo [path | owner/repo | github-url] [options]

Options
  --json             print the full report as JSON
  --md               print a Markdown table (for PR comments / job summaries)
  --badge <file>     write an SVG badge (e.g. .github/readyrepo.svg)
  --min-score <n>    exit 1 if the score is below n (CI gate)
  -h, --help         show this help
  -v, --version      show version

Remote repos use the public GitHub API (60 requests/hour without a token; set GITHUB_TOKEN to raise it).`;

export interface Args {
  target: string;
  json: boolean;
  md: boolean;
  badge?: string;
  minScore?: number;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { target: ".", json: false, md: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]!;
    if (x === "--json") a.json = true;
    else if (x === "--md") a.md = true;
    else if (x === "--badge") a.badge = argv[++i];
    else if (x === "--min-score") a.minScore = Number(argv[++i]);
    else if (x === "-h" || x === "--help") a.help = true;
    else if (x === "-v" || x === "--version") a.version = true;
    else if (x.startsWith("-")) throw new Error(`Unknown option ${x}. Try --help.`);
    else a.target = x;
  }
  if (a.minScore !== undefined && !(a.minScore >= 0 && a.minScore <= 100)) throw new Error("--min-score must be 0-100");
  return a;
}

export function sourceFor(target: string, env: NodeJS.ProcessEnv = process.env): RepoSource {
  const gh = parseGitHubTarget(target);
  // a local directory literally named owner/repo wins over the GitHub interpretation only if it exists
  if (gh && !existsDir(target)) return new GitHubSource(gh, { token: env.GITHUB_TOKEN });
  return new LocalSource(target);
}

function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.help || args.version) {
    console.log(args.help ? HELP : VERSION);
    return 0;
  }
  const report = await score(sourceFor(args.target));
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (args.md) console.log(markdown(report));
  else console.log(terminal(report));
  if (args.badge) writeFileSync(args.badge, badgeSvg(report));
  if (args.minScore !== undefined && report.score < args.minScore) {
    console.error(`readyrepo: score ${report.score} is below --min-score ${args.minScore}`);
    return 1;
  }
  return 0;
}

