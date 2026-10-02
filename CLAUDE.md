# Agent guide for this repo

This repo is the working record for a commercial loan origination system (LOS) replacement at a ~$3B community bank. The hard deadline is **2029-03-01**, when the GlobalWave contract ends. The front end in `site/` reads everything from `site/data/*.json`.

## Rules for updating information

- **Separate what is known from what is claimed.** Anything about vendors, pricing, product capabilities, or regulation goes in `site/data/claims.json` with a status until it is verified. Never move a claim to `confirmed` without a source (URL, vendor document, contract, or a named person at the bank) recorded in `sources` and a `checked` date.
- **Bank facts** (assets, portfolio, systems, staffing) come from bank staff. Record who said it.
- **Do not invent** vendor names, prices, timelines, contacts, or regulatory dates. If something is unknown, say so and add an action to find out.
- **Decisions** are recorded in `decisions.json` only when a person or group made them: fill `outcome`, `decidedBy`, `decidedOn`, and set `status: "decided"`.
- Keep `project.json` → `updated` set to the date of the latest meaningful data change.
- Write plainly. The site is read by bankers, not engineers.

## Data conventions

- Dates are ISO `YYYY-MM-DD`.
- IDs are stable and never reused: claims `C##`, decisions `D##`, risks `R##`, actions `A##`.
- Claim status is one of: `confirmed`, `unverified`, `partly`, `issue`, `false`.
- Decision status: `open`, `proposed`, `decided`, `deferred`. Action status: `open`, `in-progress`, `done`. Risk likelihood and impact: `low`, `medium`, `high`.
- Kickoff slide blocks reference other data by ID (`findings.ids`, `decision.id`); `scripts/validate.py` checks these.

## Before committing

```sh
python3 scripts/validate.py
node --check site/app.js
node --check site/motion.js
```

## Processing meeting notes

When notes from a meeting land in `docs/` (for example `docs/kickoff/2026-10-07-notes.md`), update the data files to match: decisions made, names assigned in `team.json`, new or changed actions and risks, and any claims someone verified. Summarize what changed in the commit message.

## Front end

`site/app.js` renders views from the data; `site/motion.js` animates whatever `app.js` renders and must never be required for content to be readable. New number values in the UI can count up by wrapping them with the `cnt()` helper in `app.js`.
