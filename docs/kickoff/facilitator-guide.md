# Kickoff facilitator guide: October 7, 2026

**Length:** 60 minutes · **Format:** guided walkthrough in the project site (Kickoff walkthrough)

## Meeting outcomes

1. Everyone understands the March 1, 2029 deadline and what it means working backward.
2. Agreement on what we know, what we only think we know, and how we'll check.
3. A scope decision (D01), a position on including GlobalWave (D03), and named owners (D02).
4. Owners and dates for the next 30 days.

## Agenda

| Min | Section | Slide | Goal |
| --- | --- | --- | --- |
| 0 | Open | Welcome | Purpose and outcomes |
| 3 | Why now | The deadline | The 29-month clock and the buffer |
| 8 | Where we are | Our bank | Confirm the profile; the complex 10% / 30% split |
| 12 | Where we are | Systems | COCC, LaserPro, Identifi, Abrigo, GlobalWave |
| 16 | What we know | What we think | Where we stand and how sure we are |
| 20 | What we know | What we need to learn | Open questions and owners |
| 25 | Decide | Scope (D01) | LOS only, or LOS + small business (Numerated today) |
| 33 | Decide | GlobalWave (D03) | Is staying a real option? |
| 38 | Plan | Roadmap | Phases, gates, target go-live Aug 2028 |
| 43 | Plan | How we choose | Draft criteria and weights |
| 46 | Decide | Team (D02) | Sponsor, project lead, time commitments |
| 52 | Plan | Risks | Top risks |
| 55 | Close | Next 30 days | Confirm owners and dates |

## Who should attend

Head of Commercial Lending, a lending executive who could sponsor, credit administration, loan operations / doc prep, IT, the part-time loan systems administrator, the data team, risk management, vendor management, and finance. One or two CLOs are a plus.

## Before the meeting

- [ ] Open the site on the presenting laptop and click through all 13 slides once.
- [ ] Try to find the GlobalWave contract and check for a non-renewal notice period. If found, add it to `site/data/project.json` → `keyDates` and update risk R01.
- [ ] Share the Overview page link with attendees a day ahead and ask them to skim What we think and What we need to learn.
- [ ] Set up the AI notetaker for the meeting.

## During the meeting

- Open the site in a browser on the presenting laptop and drag the window to the projector or shared screen, as you would PowerPoint. Click **Present** (or press `F`) for full screen; arrow keys or Space move between slides; `Esc` leaves full screen.
- Keep this guide open on the laptop or printed for talking points.
- On the Scope, GlobalWave and Team slides, say the decision and names out loud so the notetaker captures them.

## After the meeting

1. Save the notetaker's summary as `docs/kickoff/2026-10-07-notes.md` and commit.
2. Update `decisions.json`, `team.json`, `actions.json`, and `risks.json` (or ask an agent to, following `CLAUDE.md`).
3. Send attendees the site link and the list of actions.

## Talking points by slide

### 1. Replacing our commercial loan origination system (~3 min)

Welcome everyone. Explain that this meeting is a working session, not a vendor decision. We will walk through the deadline, what we know about the bank, what we think so far and what we still need to learn, then make a few early decisions. Everything we decide today gets recorded in this workspace.

### 2. We have about 29 months. Most of it is already spoken for. (~5 min)

Make the point that 29 months sounds like a lot but selection alone typically takes 9-11 months, and implementation, testing and training another 11. The buffer is our insurance and we should protect it. Ask whether anyone knows of a non-renewal notice requirement in the GlobalWave contract; it may force a decision earlier than we expect.

Ask the room:

- Does anyone know the notice terms in the GlobalWave contract?
- Are there blackout periods (exams, year-end, conversions) we must avoid in 2027-2028?

### 3. A $3B bank planning for $5B, with a complex top end (~4 min)

These figures come from the Head of Commercial Lending and are treated as accurate. Highlight the two facts that shape the decision most: the complex 10% / 30% split, and the part-time administrator model. Any system that needs a full-time Salesforce admin or developer is a staffing decision as much as a software decision.

Ask the room:

- What does the complex 10% actually include? Participations, syndications, multi-tranche?
- Is the part-time admin model staying, or could it change as we grow?

### 4. The new LOS sits in the middle of four systems we keep (~4 min)

Every one of these integrations has to work on day one. The biggest open item is LaserPro: Finastra sold its US mid-market banking unit in June 2026 and may be sold entirely, so we need to confirm LaserPro's ownership and roadmap. Abrigo risk rating was recently onboarded, which is one reason Abrigo's own LOS is on the list.

Ask the room:

- Which of these integrations causes the most pain today?
- Who owns the relationship with each vendor?

### 5. Where we stand, and how sure we are (~4 min)

We started from a draft assessment from September (prepared with an AI tool, Gemini) that compared Abrigo, GlobalWave and nCino. It raised the right topics: integration, admin burden, adoption and cost. But it picked a vendor before we had requirements, demos or references, so we are not walking through it line by line. Instead we turned it into what we think and how sure we are. A first check against public sources was done on October 2. Nothing about cost is known: every price we have is a placeholder until vendors quote in the RFP. One thing about us was settled: Section 1071 does not apply to the bank. No product called 'Abrigo APX' turned up.

### 6. Questions we have to answer before we choose (~5 min)

Walk through each card briefly and confirm who owns it. These are the questions that most affect the choice. The full list, with how we'll answer each one, is on the What we need to learn page.

Ask the room:

- Is anything we think wrong, or missing?
- Who should own each open question?

### 7. What is in scope? (~8 min)

The question is whether small business lending ($250K-$500K) joins the commercial LOS project. The bank uses Numerated for it today, and whether Numerated stays is still open. Only the LOS is tied to the March 2029 deadline. The recommendation is option B: evaluate small business lending in the same RFP because it shares borrowers, credit policy and possibly the vendor, depending on Numerated's contract terms. Get a decision or a clear owner and date for one.

Ask the room:

- Is Numerated working well enough to keep?
- Should we ask Abrigo for one platform covering both?
- Would small business automation change how we staff credit?

### 8. Is staying with GlobalWave on the table? (~5 min)

Even if we expect to leave, including the incumbent in the RFP gives us a cost baseline, negotiating leverage, and a fallback if a new implementation slips. It also means we should ask our own users what they think of Credit Track today rather than relying on the assessment's opinion.

Ask the room:

- Has leadership already decided to leave GlobalWave?
- What would GlobalWave need to change for us to stay?

### 9. Seven phases, three gates, one hard date (~5 min)

Walk left to right. Phases overlap on purpose. The gates that matter most: requirements signed off by March 31, 2027; contract signed by August 31, 2027; go/no-go in mid-July 2028. Ask the group to react to the target go-live of August 1, 2028 (Decision D04, to confirm by December).

Ask the room:

- Is an August 2028 go-live realistic for lending and loan ops?
- What would make us miss the August 2027 contract gate?

### 10. Agree on what matters before we see any demos (~3 min)

These weights are a starting suggestion. We will finalize them by the end of March 2027, before any vendor demo, so a polished demo does not reset our priorities. Integrations and admin burden are weighted heavily because of the part-time admin model. The CLO and PM panel scores usability directly.

Ask the room:

- What is missing from this list?
- Who should sit on the CLO and PM user panel?

### 11. Who owns this? (~6 min)

This is the most important decision today. Projects like this fail most often from unnamed owners and borrowed time. Get an executive sponsor and a project lead named, and agree on time commitments. Fill in names live if you can; anything unfilled becomes an action item.

Ask the room:

- Who is the executive sponsor?
- Who is the project lead, and what comes off their plate?
- Do we need temporary help for the part-time admin during implementation?

### 12. Top risks we will manage from day one (~3 min)

Pick two or three to discuss. The GlobalWave notice terms and admin capacity are the ones most likely to surprise us.

Ask the room:

- Which risk worries you most?
- What risk is missing?

### 13. What happens after today (~5 min)

Read through each action and confirm an owner and date. Agree on the next meeting. Remind everyone that this workspace is the single place for decisions, what we think, open questions, risks and the plan, and that it will be kept current.

Ask the room:

- Are the owners and dates right?
- When is the first core team meeting?
