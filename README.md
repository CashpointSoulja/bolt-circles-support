# Support on Your Terms

**Independent product prototype - synthetic demo.** A consent-first concept for Bolt Circles: ask one trusted person for everyday support without sharing anything about your health, plus an honest analyst view of whether it helped people come back.

This is an independent, unofficial concept. It is not Bolt Pharmacy or AIOS software and is not endorsed by either. The Bolt name and logo belong to their owner and are used unmodified only to place the idea in context. All names, events and results are synthetic. No research has been carried out, and no production impact is claimed.

## What it does

**Phone app (designed at 390 × 844)**
- Start as a participant, a supporter or a curious free user.
- Keep an everyday intention private, or invite one person.
- Choose the intention, the kind of support (encouragement, practical company or listening), a neutral title, an optional preset note and how your name shows.
- Review exactly what the supporter will see, and what is never shared. Nothing is created until you tick the confirmation box. Changing anything after review requires a new review.
- A simulated link card. "Copy demo link" copies obviously fake demo text only.
- As the supporter: accept or decline without guilt, send preset notes only. Free text is not supported, and health questions route to the care team.
- As the participant: mark notes helpful or not, mute, remove access or leave. Removal clears the supporter's view and the old link shows a closed state.
- Two seeded demo weeks with one check-in each, an optional simulated reminder preference (no notification permission), no streaks.
- An optional "Explore clinician-led care" card after value, separate from the circle, information only, invisible to supporters, and skippable.
- Reset clears everything on the device.

**Analyst view (desktop and phone)**
- Two fixtures: a promising one and a misleading aggregate.
- Household-level hashed assignment with an integrity check.
- Week-2 meaningful activity (ITT), week-1 activation, week-4 proxy, the support loop with every denominator, participant and supporter WAU kept apart, and care information interest labelled as interest, not conversion.
- Guardrails, confounding checks (balance, Simpson's reversal, repeat-user concentration, sample size) and a decision of continue limited test, hold for more evidence, or stop/redesign. Never launch.
- Cohort filter, simulated client retries (duplicates excluded once), Markdown decision record and CSV exports generated on the device.

There are no accounts, contacts, real invitations, messages, health data, payments, backend or third-party calls. State is kept in `localStorage`.

## Run locally

Requires Node 22.

```bash
npm ci
npm run serve        # http://localhost:4173
```

Any static file server pointed at `public/` also works.

## Test

```bash
npm test                              # unit tests (model, analysis, fixtures, exports)
npx playwright install chromium
npm run test:e2e                      # browser tests at 390×844 and 1440×900
```

Results are recorded in `TEST_RESULTS.md`.

## Deploy (GitHub Pages)

The site is fully static (`public/`). `.github/workflows/pages.yml` is manual-only:

1. Settings → Pages → Source: **GitHub Actions**.
2. Actions → **Deploy to GitHub Pages** → Run workflow. It runs the unit tests, then publishes `public/`.

## Walkthrough video

`demo/support-on-your-terms-walkthrough.mp4` is a vertical walkthrough recorded from the app running locally. Narration text is in `demo/narration.json` and `DEMO_SCRIPT.md`; `demo/record.mjs` reproduces the recording.

## Repository map

| Path | What |
| --- | --- |
| `public/js/model.js` | Consent state machine, allowed payload, demo event logging |
| `public/js/analysis.js` | Cleaning, assignment, metrics, guardrails, checks, decision, exports |
| `public/js/fixtures.js` | Deterministic synthetic fixtures |
| `public/js/app.js` | Phone and analyst UI |
| `PRD.md`, `ELI5.md` | Product contract |
| `BRAND_GUIDE.md` | Observed brand sources, tokens, font substitution |
| `EVENT_SCHEMA.md`, `EXPERIMENT_PLAN.md`, `RESEARCH_PLAN.md` | Measurement and research plans |
| `TEST_RESULTS.md`, `DEMO_SCRIPT.md` | Evidence and walkthrough script |

## Notes

- Inter Tight is used under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`) in place of Bolt's proprietary fonts.
- This build shows product judgement on one proposed journey. It is not a substitute for consumer product management experience.
- Concept by Ayo Ahmed.
