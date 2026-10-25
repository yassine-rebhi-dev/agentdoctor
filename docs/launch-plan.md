# Launch plan

Everything here is organic and manual: no bought stars, no star-swaps, no automated posting, no sock puppets.
Evidence references point to `reports/patterns.md` in the research repo.

## Target
- **Launch day: 400+ stars** (TypeScript daily page). Evidence #1: P(seen on Trending) is ~14% at 400-799 stars in
  a day and ~53% at 800+, and < 2% below 200.
- **72 hours: ~1,000 stars.** Evidence #9: winners decay to ~55% of their peak by day 3, so the peak day carries
  the launch.
- **Decision rule:** if launch day ends below 100 stars, don't relaunch the same post. Fix the top feedback,
  publish the leaderboard update a month later as a new data post, and treat that as launch #2.

## Name: options and pick
Data: shorter names were weakly associated with winning (median 9 vs 10 characters; this survived the
trending-label model but not the stricter velocity model). Digits and the `awesome-` prefix showed no effect.
Availability checked 2026-10-25 (npm registry + GitHub search for same-name repos).

| Name | npm | Same-name GitHub repos | Note |
|---|---|---|---|
| **agentdoctor** | free | tiny (10, 8 stars) | **Chosen.** Follows the `brew doctor` / `flutter doctor` convention: a command that diagnoses your setup and prescribes fixes, which is exactly what it does. 11 characters; the clearer meaning outweighs the weak length effect. |
| readyrepo | free | 0 stars | First pick; clear but bland, and says "repo" more than "agent" |
| repodoctor | free | 5 stars | Same metaphor without the agent signal |
| repograde | free | 1 star | Says "score" but sounds like school |
| agentscan / agentok / readyset | free | 123 / 423 / 5,295 stars | Real collisions |

Taken on npm: preflight, agentlint, agentfit, agentgrade, runway, onramp, handoff, primer, checkup.
Caveat: `github.com/agentdoctor` is someone else's account. The project lives at
`yassine-rebhi-dev/agentdoctor`; never link to the bare account.

## Tagline: 5 options, one pick
Data: a concrete claim in the tagline (a number, "zero", "no X", "first", "faster") was +17 pts more common among
cold-start winners [8, 26]. A number alone was not significant. "Alternative to X" framing showed no effect.

1. **"Checks whether AI coding agents can work in your repo, 0-100, with the exact fixes."** **Chosen**:
   concrete scale, says what you get, names the user's goal.
2. "28% of the top AI repos give coding agents no instructions. Check yours in 5 seconds." Strongest hook; use
   it as the **HN title / X opener**, not the repo tagline (it ages as the data changes).
3. "Lighthouse for AI coding agents." Short and memorable, but borrows another product's name.
4. "Is your repo ready for Claude Code, Codex and Cursor?" A question, no claim.
5. "12 checks between your repo and a useful coding agent." Concrete, but less clear about the output.

## Before launch (days 1-12)
- [ ] Create `github.com/yassine-rebhi-dev/agentdoctor`, push, enable Pages (Settings, Pages, Source: GitHub Actions).
- [ ] `npm publish` (name is free as of 2026-10-25; re-check the day you publish).
- [ ] Record the terminal GIF: `npm run demo:gif` (needs VHS), add it under the screenshot in the README.
- [ ] **Private beta:** send the live demo to 5-10 maintainers from `docs/leaderboard.md` with an honest note
      ("your repo scored X; is anything here wrong?"). Every wrong score becomes a regression test before launch.
- [ ] Re-run `npm run leaderboard` the day before launch so numbers are fresh.
- [ ] Topics on the GitHub repo: `ai`, `agents`, `claude-code`, `codex`, `cursor`, `agents-md`, `developer-tools`, `cli`.

## Launch day: when and in what order
Our data found **no day-of-week effect** (launch day χ² p = 0.18) and hour couldn't be measured. Pick the slot for
your own availability to answer comments for 6-8 hours: **Tuesday or Wednesday, 14:00-15:00 UTC** (morning US East,
afternoon Europe). This slot is a judgment call, not a finding.

Order, all within ~2 hours, because Evidence #7 says the HN post has to land on or before the peak day:
1. **Show HN** (14:00 UTC). Stay in the thread all day; answer every "the score is wrong" with a fix or an issue link.
2. **X / Bluesky thread** (14:15), with the leaderboard chart and 3 surprising rows.
3. **Reddit** (15:00): r/ClaudeAI and r/ChatGPTCoding; read each sub's self-promotion rules first and post only where
   allowed. One post per sub, written for that sub.
4. **LinkedIn** (16:00), shorter, aimed at engineering leads.
5. **dev.to / Hashnode article** (day 2): "What 93 trending AI repos tell coding agents (and what they don't)".

## Drafts

### Show HN
**Title:** Show HN: Agentdoctor – check whether AI coding agents can work in your repo

**Text:**
> I kept watching Claude Code and Codex burn turns guessing how to run a project's tests, so I built a checker.
> agentdoctor reads a repo's file tree (no cloning, no running code) and scores 12 things agents rely on: an
> AGENTS.md/CLAUDE.md, whether it lists real commands, one test command, types, lint, lockfile, CI, file sizes,
> committed .env files. Each failed check comes with the files it found and the fix.
>
> I ran it on the 93 most-starred AI code repos that hit GitHub Trending this quarter: 28% have no instructions file
> at the root, 43% never tell the agent which commands to run, 31% have no single test command. Table:
> https://github.com/yassine-rebhi-dev/agentdoctor/blob/main/docs/leaderboard.md
>
> Try it in the browser (runs client-side): https://yassine-rebhi-dev.github.io/agentdoctor/ or `npx agentdoctor`.
> The weights are a judgment call and documented; I'd like to hear where the score is wrong for your repo.

### X / Bluesky thread
1. 28% of the most-starred AI repos on GitHub give coding agents no instructions file. 43% never say how to run
   anything. I scored 93 of them. [chart]
2. The checks: AGENTS.md/CLAUDE.md, real commands in it, one test command, types, lint, lockfile, CI, giant files,
   committed .env. Each fail shows the file and the fix.
3. Highest: gemini-cli, OpenHands, opencode (95-97). Full table + method in the repo.
4. Paste your repo, nothing uploaded: <demo link>. Or `npx agentdoctor --min-score 70` in CI.

### Reddit (r/ClaudeAI)
**Title:** I built a free checker that tells you why Claude Code keeps guessing in your repo
> It scores 12 things (CLAUDE.md, commands in it, test command, types, lint, CI…) and shows the exact fix.
> Runs in the browser or `npx agentdoctor`. Scored 93 trending AI repos too; median 81/100.
> Feedback on wrong scores very welcome. <links>

### LinkedIn
> Coding agents are only as good as the repo they land in. I scored 93 popular AI repos on agent-readiness: 28%
> have no instructions file, 31% no single test command. agentdoctor checks yours in seconds and lists the fixes
> (open source, MIT). <links>

## Week one
| Day | Do |
|---|---|
| Launch day | Posts as above; reply to every comment; fix any false positive same day and say so in the thread. |
| Day 2 | Publish the dev.to article; ship a 0.1.x with the fixes from day 1; thank contributors by name. |
| Day 3 | Open "good first issue"s for new language support (Java/Kotlin, Ruby, PHP, .NET) proposed in comments. |
| Day 4 | Add the GitHub Action example people asked for (or a reusable action) if requested more than twice. |
| Day 5 | Post a short follow-up only if there is real news (e.g. a maintainer added AGENTS.md after scoring). |
| Day 6-7 | Write down what worked (stars per hour, referrers in GitHub Insights → Traffic) for launch #2. |

Never: ask for stars in exchange for anything, join star-for-star groups, post from multiple accounts, or
auto-post. Evidence #10: those patterns are what we excluded from the "organic" set, and they are against GitHub's
and each platform's rules.
