// Deterministic synthetic fixtures. Constructed on purpose to illustrate the
// analysis; they are not observations of real people.
import { ASSIGNMENT_SEED, hashArm } from "./analysis.js";

const START = Date.parse("2026-03-02T09:00:00Z");
const DAY = 86400000;
export const COHORT_LABELS = {
  existing_customer: "Existing app customers",
  free_signup: "Free sign-ups",
  supporter_referred: "Invited by a supporter",
  curious_free: "Curious free users",
  demo_session: "This demo session",
};

const iso = (day, minute = 0) => new Date(START + day * DAY + minute * 60000).toISOString().replace(".000Z", "Z");

// k = week-2 meaningful active, act = week-1 activated (k ⊆ act in this construction)
export const SPECS = {
  promising: {
    label: "Fixture A: promising, balanced",
    note: "Balanced acquisition mix, assignment matches the hash, treatment ahead in every cohort, guardrails inside limits.",
    prefix: "A",
    dataCutDay: 40,
    honourHash: true,
    cells: {
      existing_customer: { control: { n: 30, k: 12, act: 18 }, treatment: { n: 30, k: 16, act: 21 } },
      free_signup: { control: { n: 30, k: 6, act: 12 }, treatment: { n: 30, k: 10, act: 16 } },
      supporter_referred: { control: { n: 15, k: 4, act: 7 }, treatment: { n: 15, k: 6, act: 9 } },
    },
    funnel: { confirmed: 0.8, accepted: 0.75, helpful: 0.75 },
    guard: { revoked: 3, unwanted: 1, left: 2, unhelpful: 5 },
    repeatUsers: 0,
    curious: { n: 40, care: 9 },
  },
  misleading: {
    label: "Fixture B: misleading aggregate",
    note: "An acquisition campaign switched existing customers into treatment, and four heavy repeat users dominate pooled activity. Pooled numbers favour treatment; every cohort favours control.",
    prefix: "B",
    dataCutDay: 40,
    honourHash: false,
    cells: {
      existing_customer: { control: { n: 12, k: 6, act: 8 }, treatment: { n: 40, k: 18, act: 26 } },
      free_signup: { control: { n: 40, k: 10, act: 18 }, treatment: { n: 12, k: 2, act: 5 } },
      supporter_referred: { control: { n: 10, k: 3, act: 5 }, treatment: { n: 10, k: 2, act: 4 } },
    },
    funnel: { confirmed: 0.8, accepted: 0.75, helpful: 0.7 },
    guard: { revoked: 4, unwanted: 1, left: 2, unhelpful: 5 },
    repeatUsers: 4,
    curious: { n: 30, care: 11 },
  },
};

function placeHouseholds(spec) {
  const out = [];
  let serial = 0;
  for (const [cohort, arms] of Object.entries(spec.cells)) {
    const need = { control: arms.control.n, treatment: arms.treatment.n };
    const placed = { control: [], treatment: [] };
    const overflow = [];
    let guard = 0;
    while ((placed.control.length < need.control || placed.treatment.length < need.treatment) && guard++ < 5000) {
      serial += 1;
      const id = `H-${spec.prefix}${String(serial).padStart(4, "0")}`;
      const arm = hashArm(id, ASSIGNMENT_SEED);
      if (placed[arm].length < need[arm]) placed[arm].push(id);
      else if (!spec.honourHash) overflow.push(id);
      if (!spec.honourHash) {
        // Campaign override: once hash-matching slots run out, fill the other arm from overflow.
        for (const a of ["control", "treatment"]) {
          const other = a === "control" ? "treatment" : "control";
          while (placed[a].length < need[a] && overflow.length && placed[other].length >= need[other]) placed[a].push(overflow.shift());
        }
      }
    }
    for (const arm of ["control", "treatment"]) placed[arm].forEach((id, i) => out.push({ id, cohort, arm, i, cell: arms[arm] }));
  }
  return out;
}

export function buildFixture(name) {
  const spec = SPECS[name];
  const rows = [];
  let seq = 0;
  const push = (r) => rows.push({ event_id: `${spec.prefix}-${String(++seq).padStart(5, "0")}`, invite_id: null, helpful: null, ...r });
  const hhs = placeHouseholds(spec);
  const tCount = { revoked: 0, unwanted: 0, left: 0, unhelpful: 0 };
  let repeatLeft = spec.repeatUsers;

  hhs.forEach((h, idx) => {
    const day0 = (idx * 7) % 21;
    const P = `P-${h.id.slice(2)}`;
    const S = `S-${h.id.slice(2)}`;
    const base = { household_id: h.id, arm: h.arm, source_cohort: h.cohort };
    const p = (day, type, extra = {}) => push({ ...base, person_id: P, role: "participant", occurred_at: iso(day0 + day, idx % 50), event_type: type, ...extra });
    const s = (day, type, extra = {}) => push({ ...base, person_id: S, role: "supporter", occurred_at: iso(day0 + day, (idx % 50) + 5), event_type: type, ...extra });
    const { k, act } = h.cell;
    const week2 = h.i < k;
    const activated = h.i < act;

    p(0, "household_assigned");
    p(0, "intent_created");
    if (idx % 3 === 0) p(1, "app_opened");
    if (activated) p(2, "meaningful_checkin");

    if (h.arm === "treatment") {
      const n = h.cell.n;
      const confirmed = h.i < Math.round(n * spec.funnel.confirmed);
      const accepted = h.i < Math.round(n * spec.funnel.confirmed * spec.funnel.accepted);
      const helpful = h.i < Math.round(n * spec.funnel.confirmed * spec.funnel.accepted * spec.funnel.helpful);
      const inv = `I-${h.id.slice(2)}`;
      p(0, "share_previewed", { invite_id: inv });
      if (confirmed) p(0, "demo_invite_confirmed", { invite_id: inv });
      if (confirmed && !accepted && h.i % 2 === 0) s(1, "invite_declined", { invite_id: inv });
      if (accepted) {
        s(1, "invite_accepted", { invite_id: inv });
        s(3, "support_sent", { invite_id: inv });
        if (helpful) p(3, "support_marked_helpful", { invite_id: inv, helpful: true });
        else if (tCount.unhelpful < spec.guard.unhelpful) {
          tCount.unhelpful++;
          p(3, "support_marked_helpful", { invite_id: inv, helpful: false });
        }
        if (week2) s(9, "support_sent", { invite_id: inv });
      }
      if (confirmed && !week2 && tCount.revoked < spec.guard.revoked) {
        tCount.revoked++;
        p(5, "circle_revoked", { invite_id: inv });
      } else if (!week2 && tCount.left < spec.guard.left) {
        tCount.left++;
        p(5, "circle_left", { invite_id: inv });
      }
      if (confirmed && !week2 && tCount.unwanted < spec.guard.unwanted && h.cohort === "free_signup") {
        tCount.unwanted++;
        p(4, "unwanted_share_reported", { invite_id: inv });
      }
    }
    if (week2) {
      p(9, "meaningful_checkin");
      if (h.i % 2 === 0 && day0 + 22 <= spec.dataCutDay) p(22, "meaningful_checkin");
    }
    if (h.arm === "treatment" && h.cohort === "existing_customer" && week2 && repeatLeft > 0) {
      repeatLeft--;
      for (let d = 1; d <= 13; d++) {
        p(d, "meaningful_checkin");
        p(d, "meaningful_checkin");
      }
    }
  });

  for (let i = 0; i < spec.curious.n; i++) {
    const id = `Q-${spec.prefix}${String(i + 1).padStart(4, "0")}`;
    const base = { household_id: id, person_id: id.replace("Q-", "F-"), role: "curious", arm: "n/a", source_cohort: "curious_free" };
    push({ ...base, occurred_at: iso(i % 20), event_type: "intent_created" });
    if (i < spec.curious.care) push({ ...base, occurred_at: iso((i % 20) + 2), event_type: "care_info_opened" });
  }

  // Data-quality fixtures: exact retries and invalid rows. Each must be excluded exactly once.
  const dupSource = rows.filter((r) => r.event_type === "meaningful_checkin").slice(0, 6);
  for (const r of dupSource) rows.push({ ...r });
  const first = hhs[0];
  rows.push({ event_id: `${spec.prefix}-X0001`, person_id: `P-${first.id.slice(2)}`, household_id: first.id, role: "participant", arm: first.arm, occurred_at: iso(3), event_type: "streak_bonus", invite_id: null, helpful: null, source_cohort: first.cohort });
  rows.push({ event_id: `${spec.prefix}-X0002`, person_id: "P-UNKNOWN", household_id: "H-UNKNOWN", role: "participant", arm: "treatment", occurred_at: iso(4), event_type: "meaningful_checkin", invite_id: null, helpful: null, source_cohort: "free_signup" });
  rows.push({ event_id: `${spec.prefix}-X0003`, person_id: `P-${first.id.slice(2)}`, household_id: first.id, role: "participant", arm: first.arm, occurred_at: iso(-3), event_type: "meaningful_checkin", invite_id: null, helpful: null, source_cohort: first.cohort });
  rows.push({ event_id: `${spec.prefix}-X0004`, person_id: "", household_id: first.id, role: "participant", arm: first.arm, occurred_at: iso(5), event_type: "meaningful_checkin", invite_id: null, helpful: null, source_cohort: first.cohort });

  return { name, label: spec.label, note: spec.note, rows, dataCut: iso(spec.dataCutDay) };
}
