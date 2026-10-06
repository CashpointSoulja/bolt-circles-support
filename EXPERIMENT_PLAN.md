# Experiment plan

Independent product prototype - synthetic demo. This is a plan and a worked example on synthetic fixtures. No experiment has been run with real people.

## Hypothesis
One chosen supporter, one shared nonclinical intention and one low-pressure response will increase second-week meaningful activity relative to a private intention alone, without increasing unwanted sharing or distress. Conversion is secondary and never a reason to push medication.

## Design
- **Unit:** participant household (one participant and the supporter they may invite). Supporters are never randomised on their own, so one supporter can't be in both arms.
- **Assignment:** `arm = FNV-1a("circles-w2-v1:" + household_id) mod 2` → 0 control, 1 treatment. Stable, seeded and recomputable. The analysis re-derives the arm and flags any mismatch as an assignment-integrity failure.
- **Control:** private intention + weekly check-in.
- **Treatment:** the same, plus the option to invite one person with a reviewed preview and preset support. Inviting is optional; analysis is intention-to-treat.
- **Eligibility:** participants with a `household_assigned` event. Curious free users are outside the experiment and reported separately.

## Metrics
| Metric | Formula |
| --- | --- |
| **Primary:** week-2 meaningful active | participants with a check-in, or a received response they marked helpful, on days 7–13 after assignment ÷ all eligible assigned participants (ITT) |
| Week-1 activation | `intent_created` + a second meaningful action on a different day (session proxy) in days 0–6 ÷ assigned participants |
| Week-4 retained (proxy) | meaningful-active on days 21–27 ÷ assigned participants whose day 27 is before the data cut. Households not yet observable are reported as missing, not as zeros. |
| Support loop | confirmed ÷ offered → accepted ÷ confirmed → helpful ÷ accepted → week-2 active ÷ helpful (each denominator shown) |
| Participant WAU / supporter WAU | reported side by side, never added together |
| Care information interest | curious free users who opened "Explore clinician-led care" ÷ curious free users. Labelled as interest, not conversion. Real free-to-patient conversion is unavailable here. |

App opens and invite sends never count as meaningful.

## Guardrails (illustrative test rules, not medical standards)
| Guardrail | Limit |
| --- | --- |
| Unwanted-share reports | ≤ 2% of treatment households |
| Revocations | ≤ 20% of households that sent an invite |
| Unhelpful responses | ≤ 30% of rated responses |
| Opt-outs (left Circles) | ≤ 15% of treatment households |

## Confounding and data checks
- Assignment integrity (stored arm matches the hash)
- Acquisition-mix balance (cohort share gap between arms ≤ 15 pp)
- Pooled vs within-cohort direction (Simpson's reversal)
- Repeat-user concentration (top 5% of people ≤ 30% of pooled meaningful events)
- Sample size (≥ 30 households per arm)

## Decision rule
1. Any guardrail over its limit → **stop/redesign**.
2. Any confounding or data check failing → **hold for more evidence**.
3. Positive primary difference in the pool and in every cohort with ≥ 10 per arm → **continue limited test** (never "launch"; if the interval includes zero, say so).
4. Otherwise → **stop/redesign**.

## Worked example on the fixtures
| | Fixture A: promising | Fixture B: misleading aggregate |
| --- | --- | --- |
| Households | 75 / 75 | 62 / 62 |
| Primary (control → treatment) | 22/75 = 29.3% → 32/75 = 42.7%, +13.3 pp (95% CI −1.9 to +28.5) | 19/62 = 30.6% → 22/62 = 35.5%, +4.8 pp pooled |
| Within cohorts | +13.3 pp in each | −5.0, −8.3, −10.0 pp |
| Checks | all pass | integrity, balance (45.2 pp gap), reversal, concentration (50%) fail |
| Decision | continue limited test | hold for more evidence |

Fixture B was built so the pooled view looks like a win: a campaign moved existing app customers (who check in more anyway) into treatment, and four heavy repeat users inflate pooled events per household (0.97 vs 3.19). Filtering to any single cohort reverses the result. These numbers describe the fixtures, not people.

## What would come next
A pre-registered limited test needs privacy, legal and clinical review, informed consent, real authorisation, a retention policy and an incident process first. See `RESEARCH_PLAN.md`.
