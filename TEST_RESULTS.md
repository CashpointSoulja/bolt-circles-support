# Test results

Run locally on 2026-10-06 against the static app served from `public/` (`npm run serve`). All data is synthetic. These results check prototype behaviour only; they say nothing about real users or health outcomes.

## Commands

```bash
npm test          # unit tests (model + analysis)
npm run test:e2e  # browser tests at 390 x 844 and 1440 x 900
```

| Check | Result |
| --- | --- |
| Unit tests (`test/model.test.js`, `test/analysis.test.js`) | 36 / 36 passed |
| Browser tests (`e2e/app.spec.js`, two viewports) | 18 / 18 passed |
| Horizontal scroll, every captured phone screen | `scrollWidth` 390 at 390 px wide (13 screens) |
| Browser console errors during screenshot pass | None |

## Browser tests

Each test runs in `phone-390x844` and `desktop-1440x900`.

| Test | Phone | Desktop |
| --- | --- | --- |
| Disclosure is always visible | Pass | Pass |
| Private path never exposes the intention | Pass | Pass |
| Invite needs preview confirmation; supporter sees only reviewed fields; accept, support, helpful, revoke, old link | Pass | Pass |
| Decline without guilt | Pass | Pass |
| Care interest is private and skip works; two weeks; reminder; safety | Pass | Pass |
| Care button opens information only; supporter cannot see it | Pass | Pass |
| Keyboard: Tab reaches controls with a visible focus ring | Pass | Pass |
| Analyst: misleading fixture holds, cohort filter reverses, retries excluded once, exports work | Pass | Pass |
| Every visible button does something (no dead controls on start screens) | Pass | Pass |

## Acceptance tests from PRD.md

| Acceptance test | How it is checked | Result |
| --- | --- | --- |
| Private path never exposes an intent | Unit: supporter view after private path is empty. E2E: supporter screen shows no intention text. | Pass |
| Invite cannot be sent before preview confirmation | Unit: `confirmInvite` rejected without review and without the checkbox; changing a field clears the review. E2E: "Create demo invitation" shows an error until the box is ticked. | Pass |
| Supporter sees only reviewed fields | Unit: payload keys equal the allowlist (`displayName`, `intention`, `supportType`, `title`, `message`). E2E: supporter card text checked against the reviewed preview. | Pass |
| No health data, diagnosis, weight or dose in fixtures/payloads | Unit: every fixture value and payload scanned against the sensitive-term list (the arm label `treatment` is the only exemption). | Pass |
| Decline works | Unit + E2E | Pass |
| Revoke removes data in both views and invalidates the old link | Unit: payload, members and responses cleared; old token renders `revoked`. E2E: "Check the old link" shows the link is "no longer active". | Pass |
| Care interest stays private and skip works | Unit: care choice absent from supporter view and payload. E2E: "Not now" hides the card; supporter screen never mentions care. | Pass |
| Export reproduces denominators and excludes duplicate IDs once | Unit: CSV/Markdown contain numerators and denominators; 6 duplicate IDs excluded exactly once; client retries are idempotent. E2E: Markdown, metrics CSV and event CSV downloads verified. | Pass |
| Misleading fixture fails a guardrail or confounding check; no winner | Unit + E2E: decision is "Hold for more evidence"; assignment, mix-balance, direction and concentration checks fail; every cohort favours control. | Pass |
| 390 x 844 and desktop, visible focus, AA contrast, no clipped buttons or horizontal scroll | E2E viewport checks and focus-ring test; contrast ratios in BRAND_GUIDE.md (lowest pair 4.67:1). | Pass |
| No dead controls, fake integrations, invented outcomes, medical advice or real sends | E2E button sweep; only preset messages; health questions route to the care-team card; links use `demo.invalid`. | Pass |

## Fixture outcomes

| Fixture | Households (C / T) | Week-2 meaningful active | Difference | Decision |
| --- | --- | --- | --- | --- |
| A - promising | 75 / 75 | 22/75 = 29.3% vs 32/75 = 42.7% | +13.3 pp (95% CI about -1.9 to +28.5) | Continue limited test |
| B - misleading | 62 / 62 | 19/62 = 30.6% vs 22/62 = 35.5% | +4.8 pp pooled; -5.0, -8.3, -10.0 pp within cohorts | Hold for more evidence |

Both are synthetic and deliberately built to show how the decision rules behave. Thresholds are illustrative test rules, not medical standards.

## Visual evidence

Screenshots of the running app are in `docs/evidence/` (`app-01-welcome.png` to `app-12-analyst-desktop.png`). Reference screenshots of the public Bolt Pharmacy site used for the brand guide are `boltpharmacy-home-390.png` and `boltpharmacy-home-1440.png`.

## Video

`demo/support-on-your-terms-walkthrough.mp4`: H.264 1080 x 1920, AAC narration, 89.6 seconds, recorded from the locally running app with `demo/record.mjs`. Checked with `ffprobe` (both streams present), `volumedetect` (mean -22.1 dB, peak -3.3 dB) and `silencedetect` (no gap over 2 s). Captions: `demo/support-on-your-terms-walkthrough.srt`. Encoder, software and comment tags are stripped from the video, narration clips and screenshots.

## Caveats

- No screen-reader pass yet; it is part of RESEARCH_PLAN.md.
- Contrast was calculated from tokens, not measured with an external tool on every state.
- Role switching is a demo shortcut, not an authentication design.
