# Kickoff facilitator guide: October 7, 2026

**Length:** 90 minutes · **Format:** guided walkthrough in the project site (Kickoff walkthrough)

## Meeting outcomes

1. Everyone understands the March 1, 2029 deadline and what it means working backward.
2. Agreement on what we know, what we only think we know, and how we'll check.
3. A scope decision (D01), a position on including GlobalWave (D03), and named owners (D02).
4. Owners and dates for the next 30 days.

## Agenda

| Min | Section | Slide | Goal |
| --- | --- | --- | --- |
| 0 | Open | Welcome | Purpose and outcomes |
| 5 | Why now | The deadline | The 29-month clock and the buffer |
| 12 | Where we are | Our bank | Confirm the profile; the complex 10% / 30% split |
| 18 | Where we are | Systems | COCC, LaserPro, Identifi, Abrigo, GlobalWave |
| 24 | What we know | What we think | Where we stand and how sure we are |
| 30 | What we know | What we need to learn | Open questions and owners |
| 38 | Decide | Scope (D01) | LOS only, LOS + small business, or all three |
| 48 | Decide | GlobalWave (D03) | Is staying a real option? |
| 54 | Plan | Roadmap | Phases, gates, target go-live Aug 2028 |
| 62 | Plan | How we choose | Draft criteria and weights |
| 67 | Decide | Team (D02) | Sponsor, project lead, time commitments |
| 75 | Plan | Risks | Top risks |
| 80 | Close | Next 30 days | Confirm owners and dates |

## Who should attend

Head of Commercial Lending, a lending executive who could sponsor, credit administration, loan operations / doc prep, IT, the part-time loan systems administrator, the data team, risk management, vendor management, and finance. One or two RMs are a plus.

## Before the meeting

- [ ] Open the site on the presenting laptop and click through all 13 slides once.
- [ ] Try to find the GlobalWave contract and check for a non-renewal notice period. If found, add it to `site/data/project.json` → `keyDates` and update risk R01.
- [ ] Share the Overview page link with attendees a day ahead and ask them to skim What we think and What we need to learn.
- [ ] Decide who will type notes in the presenter panel (ideally not the presenter).
- [ ] Clear any test notes: presenter panel → **Clear notes**.

## During the meeting

- Use **Present** (or `F`) on the projector. Keep presenter notes on a second screen, or have the note-taker drive the presenter panel on their laptop.
- On the Scope and GlobalWave slides, click the option the room chooses. Type names into the Team slide.
- Start the meeting clock on the Welcome slide; it turns red when you run past the plan for the current slide.

## After the meeting

1. Presenter panel → **Copy notes as Markdown**. Save as `docs/kickoff/2026-10-07-notes.md` and commit.
2. Update `decisions.json`, `team.json`, `actions.json`, and `risks.json` (or ask an agent to, following `CLAUDE.md`).
3. Send attendees the site link and the list of actions.
