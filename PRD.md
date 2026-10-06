# Bolt Circles: Support on Your Terms
Product hypothesis and executable prototype for AIOS Product Manager - Engagement.

## Grounding
The official role names Circles, a private friend/family support group, and freemium ownership. It asks for retention, weekly active users, conversion and research under clinical constraints. The public Bolt app listing already offers order tracking, re-ordering, weight/dose logs and reminders. This is not a medication tracker rebuild or a claim that Circles is missing from the live product. It is one proposed consent-first activation journey and a testable measurement plan.

## Problem and hypothesis
People may want support without announcing medication, weight or a diagnosis. Supporters need something useful to do, not access to private health records. A small invitation with explicit boundaries might create meaningful repeat support without pressure or oversharing.
Hypothesis: one chosen supporter, one shared nonclinical intention and one low-pressure response will increase second-week meaningful activity relative to a private intention alone, without increasing unwanted sharing or distress. Conversion is secondary and never a reason to push medication.

## Personas and jobs
- Participant: choose whether to involve someone, what to share and when to stop. A private-only path is equally valid.
- Supporter: send encouragement around a chosen everyday intention without giving clinical advice.
- Curious free user: try the support experience without claiming to be a patient or sharing sensitive information.
- Product owner: assess outcomes with honest cohort denominators and privacy/safety guardrails.

## Scope: executable seeded demo
Mobile-first participant flow with a separate analyst view. All names/events synthetic. No accounts, real invitations, messages, health data, prescribing, payments or backend integrations. Simulated invite tokens and demo reset. Default intent examples: take a short walk, make time for a check-in, celebrate a small win. No weight-loss target, dose schedule or diet prescription.
1. Start as participant, supporter or curious free user. Persistent "Independent product prototype - synthetic demo" label. Choose private-only or circle.
2. Set an intention. Choose allowed support: encouragement, practical company, or listening. User selects a neutral invitation title and optional message. Default shares only chosen intention, display name and support preference. Medication, diagnosis, weight, treatment and order information never exist in invitation payload.
3. Review recipient preview before simulated invite. Explain exactly what will be visible. Explicit confirmation, then a simulated link card. No email/SMS/contact import. Copy action carries only fake demo state and a demo warning, not owner information.
4. Switch to supporter: show only allowed fields. Accept or decline without guilt. Send a preset supportive response, not arbitrary medical advice. No general social feed, follower counts or leaderboard.
5. Participant sees response and can mark helpful/not helpful, mute, revoke or leave. Revocation immediately removes intention/support history in supporter view. Old simulated link shows revoked state. Private-only path has its own check-in.
6. Repeat check-in across two seeded weeks, with optional reminder preference simulated only. No streak loss, guilt copy or notification permission request. Celebrate asking for support, not weight change.
7. Optional free-to-care entry card after value, clearly separate from circle. CTA is "Explore clinician-led care", a simulated informational choice only, not an eligibility claim, consultation or purchase. Supporter never sees participant care interest. User may skip freely. No medication ads, price claims or promises.
8. Analyst: cohort filter, experiment assignment, metrics, guardrail status and transparent decision export.

## Consent state model
Circle {id,participantId,allowedFields,inviteState:draft|reviewed|sent_demo|accepted|declined|revoked,memberIds}.
An intent is private by default. Sharing requires reviewed payload + confirmation. A new supporter or changed fields requires a new review. Revocation overrides cached state. No hidden permission changes when role switching. Role switch is a demo feature, not an authentication design.
Demonstrate revoked, declined, empty, waiting, unsupported-message and small-sample states. A safety card directs clinical questions to the real care team; no generated medical answers. Use preset messages only to avoid building a fake moderation or diagnostic model.

## Events and measurement
Schema: event_id, person_id, household_id, role, arm, occurred_at, event_type, invite_id?, helpful?, source_cohort. Events include intent_created, share_previewed, demo_invite_confirmed, invite_accepted, support_sent, support_marked_helpful, meaningful_checkin, circle_revoked, unwanted_share_reported, care_info_opened. Idempotent event ids, duplicate fixture, explicit excluded invalid events.
Unit: participant household/circle, not individual supporters. Assign stable seeded hash at household level to avoid contamination. Control: private intention + check-in. Treatment: optional circle invitation + support. Show assignment method and exclusion count.
Primary: week-2 meaningful active participants / all eligible assigned participants (intention-to-treat). Meaningful active = check-in or received support marked helpful, not mere app open or invite send. Week-1 activation: intention created + second meaningful action in a distinct session. Support loop: invites confirmed -> accepted -> helpful response -> participant return, each denominator visible.
Secondary: week-4 retained participant proxy from fixtures; free-user care information interest, not paid conversion or health outcome. Label real freemium-to-patient conversion unavailable in prototype. Separate participant vs supporter WAU; never inflate participant engagement by counting supporters.
Guardrails: unwanted-share reports, revocations, unhelpful responses, opt-outs. No clinical effectiveness inference. Thresholds are illustrative test rules, not medical standards.
Provide two fixtures: promising result and misleading aggregate. Misleading aggregate has acquisition-mix imbalance and repeat users dominating pooled activity; cohort filter reverses apparent benefit. Evidence view lists every relevant denominator, date window and missing observation. Decision is "continue limited test", "hold for more evidence" or "stop/redesign", never automatic launch based on tiny synthetic samples.
Decision export includes hypothesis, cohort, assignment, metric formulas, sample sizes, effect difference, uncertainty caveat, guardrails, raw event count/exclusions, next research question. Download local Markdown/CSV. No real user data upload.

## Research plan, not completed research
Five participant interviews and five supporter interviews, voluntary, compensated outside prototype only if separately approved. Questions about sharing comfort, helpful support and reasons to stop, without requesting medication/diagnosis details. Test recipient preview comprehension and revocation trust. Accessibility test with keyboard and screen reader. A clinician/privacy specialist reviews boundary copy before any real pilot. Real rollout requires privacy/legal/clinical review, informed consent, secure authorization, retention policy and an incident process. No fabricated interview quotes.

## Acceptance tests
- Private path never exposes an intent; simulated invite cannot be sent before preview confirmation.
- Supporter sees only reviewed fields; no health data, diagnosis, weight or dose anywhere in fixtures/payloads.
- Decline works; revoke removes data in both views and invalidates old demo link.
- Care interest stays private and skip works.
- Export reproduces denominators and excludes duplicate IDs once.
- Misleading fixture fails guardrail or confounding check; do not declare a winner.
- All actions work at 390x844 and desktop, keyboard focus visible, contrast AA target; no clipped buttons or horizontally scrolling phone views.
- No dead controls, fake working integrations, invented live outcomes, medical advice or real invite sends.

## Boundaries
Independent, unofficial prototype, not Bolt or AIOS's production product. Brand assets credited to their owner; no implication of endorsement. Data synthetic. Clinical decisions remain with clinicians. No claim of solving clinical loneliness or improving health outcomes. Ayo's build demonstrates product judgment, not five years of consumer PM experience.
