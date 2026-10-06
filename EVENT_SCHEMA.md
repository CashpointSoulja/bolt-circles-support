# Event schema

Independent product prototype - synthetic demo. Every row described here is generated on the device from seeded fixtures or from the demo session. There is no server and no real user data.

## Row shape

| Field | Type | Notes |
| --- | --- | --- |
| `event_id` | string | Idempotency key. A repeated `event_id` is a re-delivery and is excluded (once per repeat), never double-counted. |
| `person_id` | string | Synthetic person. `P-` participant, `S-` supporter, `F-` curious free user, `P-DEMO` / `S-DEMO` in the live demo session. |
| `household_id` | string | Unit of assignment and analysis (one participant's circle). Supporters carry their participant's household. |
| `role` | `participant` \| `supporter` \| `curious` | Kept separate in every metric. |
| `arm` | `control` \| `treatment` \| `n/a` | Copied from the household assignment. `n/a` for curious free users, who are not in the experiment. |
| `occurred_at` | ISO 8601 UTC | Synthetic timestamps from 2026-03-02. |
| `event_type` | see below | Unknown types are excluded. |
| `invite_id` | string, optional | Present on sharing and support events. |
| `helpful` | boolean, optional | Only on `support_marked_helpful`. |
| `source_cohort` | string | `existing_customer`, `free_signup`, `supporter_referred`, `curious_free`, `demo_session`. Acquisition source, used for balance checks and the cohort filter. |

There is no free-text field. No field can carry medication, diagnosis, weight, dose, treatment or order information. (`treatment` appears only as the name of an experiment arm.)

## Event types

| Event | Who | Counts as meaningful? |
| --- | --- | --- |
| `household_assigned` | participant | No. Marks the start of the analysis window. |
| `intent_created` | participant / curious | No (it starts activation). |
| `share_previewed` | participant | No. |
| `demo_invite_confirmed` | participant | No. Sending an invite is not engagement. |
| `invite_accepted` / `invite_declined` | supporter | No. |
| `support_sent` | supporter | Counts toward supporter WAU only. |
| `support_marked_helpful` | participant | Yes, only when `helpful = true`. |
| `meaningful_checkin` | participant | Yes. |
| `circle_revoked` / `circle_left` | participant | Guardrail. |
| `circle_muted` / `circle_unmuted` | participant | No. |
| `unwanted_share_reported` | participant | Guardrail. |
| `care_info_opened` | participant / curious | Information interest only. Not conversion, not a health outcome. |
| `app_opened` | participant | Never meaningful. Present in fixtures to prove it isn't counted. |

## Exclusion rules (applied in order, each row gets at most one reason)

1. `missing event_id`
2. `duplicate event_id` (first occurrence kept)
3. `unknown event_type`
4. `missing person_id`
5. `unknown role`
6. `invalid occurred_at`
7. `household never assigned` (participant/supporter rows only)
8. `before assignment`

Each fixture deliberately contains six re-delivered rows and four invalid rows. The analyst view and the events CSV list every exclusion with its reason. The "Simulate 3 client retries" button re-delivers three existing rows to show the exclusion count rising while the metrics stay identical.

## Where it lives in code

- Logging in the demo session: `log()` in `public/js/model.js`
- Cleaning and metrics: `clean()` and `analyze()` in `public/js/analysis.js`
- Fixtures: `public/js/fixtures.js`
