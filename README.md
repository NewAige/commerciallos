# Commercial LOS Replacement

Project workspace for replacing the bank's commercial loan origination system (LOS) before the GlobalWave contract ends on **March 11, 2029**.

The repo has two jobs:

1. **A visible front end** (`site/`) that shows the plan, what we think and still need to learn, open decisions and risks, plus a guided walkthrough for the October 7, 2026 kickoff meeting.
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
| `site/data/claims.json` | **What we think / What we need to learn**: each item has our current view, how sure we are, the open question, how we'll answer it, the owner and sources |
| `site/data/decisions.json` | Decision log |
| `site/data/risks.json` | Risk log |
| `site/data/options.json` | Strategic paths, vendor long list, draft evaluation criteria |
| `site/data/team.json` | Roles, time commitments, meeting cadence |
| `site/data/actions.json` | Next actions with owners and due dates |
| `site/data/kickoff.json` | Kickoff walkthrough: slides, talking points, prompts, capture fields |
| `docs/sources/` | Original source material, kept unchanged |
| `docs/kickoff/` | Facilitator guide and, after the meeting, the meeting notes |
| `site/motion.js` | Animation layer: flow-field background, slide transitions, count-ups, chart and diagram choreography. No external libraries; respects reduced-motion settings |
| `scripts/validate.py` | Checks the data files are valid and cross-references resolve |

## The kickoff walkthrough

Open **Kickoff walkthrough** in the site. It is a 13-slide, 60-minute guided session.

- Open the site in a browser and drag the window to the projector or shared screen, as you would PowerPoint. Click **Present** (or press `F`) for full screen; `Esc` leaves it.
- `→` / `←` or Space move between slides (swipe on phones and tablets).
- Talking points and questions for the room are in the facilitator guide. Notes come from the meeting's notetaker, not the site.

### Taking the slides with you

Both options are on the **Meetings** page and in the bar above the slides.

- **PDF** (or "Print or save as PDF") opens every slide on one page, sized for 16:9 landscape. Click **Print or save as PDF** and pick **Save as PDF** as the printer. If the slides come out white, turn on **Background graphics** in the print dialog. Slides with a lot on them are shrunk to fit one page.
- **Download** (or "Download offline copy") saves a single `.html` file, such as `kickoff-2026-10-07-slides.html`. Double-click it to open it in any browser: it opens on the slides and still has Present, arrow keys and the rest of the workspace, with no server or connection needed. It is a snapshot of the data on the day it was saved (the side panel says when), so download a fresh copy after the data changes. Without a connection it falls back to standard fonts.

See `docs/kickoff/facilitator-guide.md` for prep steps and talking points.

## Sharing the survey questions for review

On the **Survey plan** page, click **Print or save as PDF** (address `#surveys/print`). It shows the survey summary followed by every role's question list, each role starting on a new page, laid out like the site. Click **Print or save as PDF** again and pick **Save as PDF** as the printer; turn on **Background graphics** so the shading prints. It prints on Letter paper in the light theme, and the role names on the summary page link to that role's pages in the PDF. For one role only, use the same button on that role's page (`#survey-<role>/print`).

## A note on the source assessment

`docs/sources/2026-09_gemini-los-assessment_UNVERIFIED.txt` was produced with Gemini. The bank figures in it come from the Head of Commercial Lending and are treated as accurate. Vendor, pricing and regulatory content is unverified. Each point is restated in `claims.json` as what we think, how sure we are, and what we still need to learn (the original wording is kept in each item's `origin`). A first web check on October 2, 2026 found several problems (for example, no product called "Abrigo APX" could be found, and the nCino TCO total omits its own Salesforce line).
