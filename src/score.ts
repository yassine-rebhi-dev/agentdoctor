import { CHECKS } from "./checks.js";
import type { Check, Context, FileEntry, Report, RepoSource } from "./types.js";

const MANIFEST = /(^|\/)(package\.json|pyproject\.toml|setup\.py|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|Gemfile|composer\.json|Package\.swift|CMakeLists\.txt|Makefile|\w+\.csproj|mix\.exs|deno\.jsonc?)$/;

/**
 * "content" = an awesome-list, skill pack, book or tutorial. Calibrated on real repos: >= 80% docs/images is content
 * even with a docs-site package.json (JavaGuide); >= 60% docs with no root manifest is content (skill packs whose
 * only manifests are deep helper-script requirements.txt files).
 */
export function repoKind(files: FileEntry[]): Report["kind"] {
  const docs = files.filter((f) => /\.(md|mdx|txt|rst|png|jpe?g|gif|svg|webp|pdf)$/i.test(f.path)).length;
  const share = docs / Math.max(1, files.length);
  const rootManifest = files.some((f) => MANIFEST.test(f.path) && !f.path.includes("/"));
  return share >= 0.8 || (share >= 0.6 && !rootManifest) ? "content" : "code";
}

export function grade(score: number): string {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

/** Load the tree once, memoise file reads, run every check. */
export async function score(source: RepoSource, checks: Check[] = CHECKS): Promise<Report> {
  const files = await source.list();
  const cache = new Map<string, Promise<string | null>>();
  const ctx: Context = {
    files,
    paths: new Set(files.map((f) => f.path)),
    read: (p) => {
      if (!cache.has(p)) cache.set(p, source.read(p));
      return cache.get(p)!;
    },
  };
  const results = [];
  for (const c of checks) {
    const r = await c.run(ctx);
    results.push({ id: c.id, title: c.title, maxPoints: c.maxPoints, source: c.source, ...r });
  }
  const total = results.reduce((s, r) => s + r.points, 0);
  return { repo: source.name, kind: repoKind(files), score: total, grade: grade(total), results };
}
