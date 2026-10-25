import { CHECKS } from "../src/checks.js";
import { REPO_URL } from "../src/meta.js";
import { badgeSvg, CONTENT_NOTE } from "../src/report/render.js";
import { score } from "../src/score.js";
import { GitHubSource, parseGitHubTarget } from "../src/sources/github.js";
import type { CheckResult, Report } from "../src/types.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("form");
const input = $<HTMLInputElement>("target");
const go = $<HTMLButtonElement>("go");
const status = $<HTMLParagraphElement>("status");
const result = $<HTMLElement>("result");
const ring = document.getElementById("ring") as unknown as SVGSVGElement;

const ICON = { pass: "✔", partial: "◐", fail: "✘" } as const;
const LABEL = { pass: "passed", partial: "partly passed", fail: "failed" } as const;
const GRADE_TEXT: Record<string, string> = {
  A: "Grade A: agents have what they need.",
  B: "Grade B: agents will mostly manage.",
  C: "Grade C: agents will guess at some basics.",
  D: "Grade D: agents will struggle here.",
  F: "Grade F: agents are flying blind.",
};

/** One ring segment per check, arc length proportional to the check's points. */
function drawRing(results?: CheckResult[]) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const gap = 2.2;
  let offset = 0;
  const parts = CHECKS.map((c) => {
    const res = results?.find((x) => x.id === c.id);
    const len = (c.maxPoints / 100) * circ;
    const color = !res ? "var(--track)" : `var(--${res.status})`;
    const seg = `<circle class="seg" cx="60" cy="60" r="${r}" stroke="${color}"
      stroke-dasharray="${Math.max(0, len - gap)} ${circ}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${c.title}${res ? `: ${res.points}/${c.maxPoints}` : ""}</title></circle>`;
    offset += len;
    return seg;
  });
  ring.innerHTML = parts.join("");
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

function render(report: Report) {
  $("result-title").textContent = report.repo;
  $("score").textContent = String(report.score);
  $("grade").textContent = GRADE_TEXT[report.grade] ?? `Grade ${report.grade}`;
  $("kind-note").textContent = report.kind === "content" ? CONTENT_NOTE : "";
  $("kind-note").hidden = report.kind !== "content";
  const order = { fail: 0, partial: 1, pass: 2 } as const;
  const rows = [...report.results].sort((a, b) => order[a.status] - order[b.status] || b.maxPoints - a.maxPoints);
  $("checks").innerHTML = rows
    .map(
      (c) => `<li class="${c.status}"><details${c.status !== "pass" ? " open" : ""}>
        <summary><span class="icon" aria-label="${LABEL[c.status]}">${ICON[c.status]}</span><span>${esc(c.title)}</span><span class="pts">${c.points}/${c.maxPoints}</span></summary>
        <div class="detail">
          ${c.fix ? `<p class="fix">${esc(c.fix)}</p>` : ""}
          ${c.evidence.length ? `<p class="evidence">${c.evidence.map(esc).join("<br>")}</p>` : ""}
        </div></details></li>`,
    )
    .join("");
  const svg = badgeSvg(report);
  $<HTMLImageElement>("badge").src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  $<HTMLImageElement>("badge").alt = `agent-ready ${report.score}/100`;
  $("badge-md").textContent =
    `[![agent-ready ${report.score}/100](https://img.shields.io/badge/agent--ready-${report.score}%2F100-${badgeHex(report.score)})](${REPO_URL})`;
  drawRing(report.results);
  result.hidden = false;
}

function badgeHex(s: number) {
  return s >= 85 ? "2ea043" : s >= 70 ? "7cb342" : s >= 55 ? "d4a017" : s >= 40 ? "e8762b" : "d73a49";
}

async function run(raw: string) {
  const target = parseGitHubTarget(raw);
  if (!target) {
    status.className = "status error";
    status.textContent = "Enter a public GitHub repo as owner/repo or paste its URL.";
    return;
  }
  go.disabled = true;
  status.className = "status";
  status.textContent = `Reading ${target.owner}/${target.repo}…`;
  drawRing();
  try {
    const report = await score(new GitHubSource(target));
    status.textContent = "";
    render(report);
    history.replaceState(null, "", `?repo=${report.repo}`);
  } catch (e) {
    status.className = "status error";
    status.textContent = (e as Error).message;
  } finally {
    go.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void run(input.value);
});
for (const b of document.querySelectorAll<HTMLButtonElement>(".example")) {
  b.addEventListener("click", () => {
    input.value = b.dataset.repo ?? "";
    void run(input.value);
  });
}
$("copy-badge").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("badge-md").textContent ?? "");
  $("copy-badge").textContent = "Copied";
});

drawRing();
const fromUrl = new URLSearchParams(location.search).get("repo");
if (fromUrl) {
  input.value = fromUrl;
  void run(fromUrl);
}
