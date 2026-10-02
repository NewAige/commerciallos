# Commercial LOS Replacement

Project workspace for replacing the bank's commercial loan origination system (LOS) before the GlobalWave contract ends on **March 1, 2029**.

The repo has two jobs:

1. **A visible front end** (`site/`) that shows the plan, the evidence behind it, open decisions and risks, plus a guided walkthrough for the October 7, 2026 kickoff meeting.
2. **An organized record** (`site/data/*.json`, `docs/`) that people and AI agents keep up to date as the project moves.

## View the site

```sh
./scripts/serve.sh          # then open http://localhost:8000
```

Opening `site/index.html` directly from disk will not work, because browsers block it from reading the data files. The included GitHub Actions workflow publishes `site/` to GitHub Pages on every push to `main` once Pages is enabled for the repo (Settings → Pages → Source: GitHub Actions).

## What's where

| Path | Contents |
| --- | --- |
| `site/data/project.json` | Key dates, bank profile, systems, working assumptions |
| `site/data/timeline.json` | Phases, milestones, buffer, critical-path notes |
| `site/data/claims.json` | **Evidence register**: every claim from the source assessment, its status, findings, sources and owner |
| `site/data/decisions.json` | Decision log |
| `site/data/risks.json` | Risk log |
| `site/data/options.json` | Strategic paths, vendor long list, draft evaluation criteria |
| `site/data/team.json` | Roles, time commitments, meeting cadence |
| `site/data/actions.json` | Next actions with owners and due dates |
| `site/data/kickoff.json` | Kickoff walkthrough: slides, talking points, prompts, capture fields |
| `docs/sources/` | Original source material, kept unchanged |
| `docs/kickoff/` | Facilitator guide and, after the meeting, the meeting notes |
| `scripts/validate.py` | Checks the data files are valid and cross-references resolve |

## The kickoff walkthrough

Open **Kickoff walkthrough** in the site. It is a 13-slide, 90-minute guided session.

- `→` / `←` or Space to move between slides; `F` to present full screen; `N` to toggle presenter notes; `Esc` to leave full screen.
- The presenter panel shows talking points, questions for the room, a meeting clock against the planned agenda, and a notes field for each topic.
- Decision options on the slides can be clicked to record the room's choice, and role names can be typed into the team slide.
- Notes stay in the presenter's browser. Use **Copy notes as Markdown** at the end and save them to `docs/kickoff/2026-10-07-notes.md`, then update `decisions.json`, `team.json` and `actions.json`.

See `docs/kickoff/facilitator-guide.md` for prep steps.

## A note on the source assessment

`docs/sources/2026-09_gemini-los-assessment_UNVERIFIED.txt` was produced with Gemini. The bank figures in it come from the Head of Commercial Lending and are treated as accurate. Vendor, pricing and regulatory content is unverified and is tracked claim by claim in the evidence register. A first web check on October 2, 2026 found several problems (for example, no product called "Abrigo APX" could be found, and the nCino TCO total omits its own Salesforce line).
