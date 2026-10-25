import { METHOD_URL } from "../meta.js";
import type { CheckResult, Report } from "../types.js";

const ICON = { pass: "✔", partial: "◐", fail: "✘" } as const;
export const CONTENT_NOTE = "This looks like a content repo (mostly Markdown, no build manifest). Test, type and lockfile checks are written for code projects, so read the score with that in mind.";

export function badgeColor(score: number): string {
  return score >= 85 ? "#2ea043" : score >= 70 ? "#7cb342" : score >= 55 ? "#d4a017" : score >= 40 ? "#e8762b" : "#d73a49";
}

/** Shields-style flat badge, self-contained (no external service). */
export function badgeSvg(r: Pick<Report, "score">): string {
  const label = "agent-ready";
  const value = `${r.score}/100`;
  const lw = 6 * label.length + 12;
  const vw = 7 * value.length + 12;
  const w = lw + vw;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}">`,
    `<title>${label}: ${value}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${badgeColor(r.score)}"/><rect width="${w}" height="20" fill="url(#s)"/></g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${value}</text></g></svg>`,
  ].join("");
}

export function markdown(r: Report): string {
  const rows = r.results.map((c) => `| ${ICON[c.status]} | ${c.title} | ${c.points}/${c.maxPoints} | ${c.status === "pass" ? c.evidence[0] ?? "" : c.fix ?? ""} |`);
  return [`## readyrepo: **${r.score}/100** (${r.grade}) for \`${r.repo}\``, "", ...(r.kind === "content" ? [`> ${CONTENT_NOTE}`, ""] : []), "| | Check | Points | Evidence / fix |", "|---|---|---|---|", ...rows].join("\n");
}

const useColor = () => typeof process !== "undefined" && process.stdout?.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : s);
const statusColor = { pass: "32", partial: "33", fail: "31" } as const;

function bar(score: number, width = 30): string {
  const filled = Math.round((score / 100) * width);
  const code = score >= 70 ? "32" : score >= 40 ? "33" : "31";
  return c(code, "█".repeat(filled)) + c("2", "░".repeat(width - filled));
}

export function terminal(r: Report): string {
  const lines = ["", `  ${c("1", "readyrepo")}  ${r.repo}`, "", `  ${bar(r.score)}  ${c("1", `${r.score}/100`)}  grade ${c("1", r.grade)}`, ""];
  if (r.kind === "content") lines.push(`  ${c("2", CONTENT_NOTE)}`, "");
  const order = (x: CheckResult) => ({ fail: 0, partial: 1, pass: 2 })[x.status];
  for (const x of [...r.results].sort((a, b) => order(a) - order(b) || b.maxPoints - a.maxPoints)) {
    const pts = `${x.points}/${x.maxPoints}`.padStart(5);
    lines.push(`  ${c(statusColor[x.status], ICON[x.status])} ${x.title.padEnd(50)} ${c("2", pts)}`);
    if (x.status !== "pass" && x.fix) lines.push(`      ${c("2", "→")} ${x.fix}`);
    else if (x.evidence[0]) lines.push(`      ${c("2", x.evidence[0])}`);
  }
  const lost = r.results.filter((x) => x.status !== "pass").reduce((s, x) => s + x.maxPoints - x.points, 0);
  if (lost) lines.push("", `  ${c("2", `Fix the items above to gain up to ${lost} points. Methodology: ${METHOD_URL}`)}`);
  lines.push("");
  return lines.join("\n");
}
