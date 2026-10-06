// Consent-first circle model. Pure functions over a plain state object so the
// same code runs in the browser and in tests. Everything here is synthetic.

export const DEMO_START = "2026-03-02"; // synthetic study day 0
export const PARTICIPANT = { personId: "P-DEMO", householdId: "H-DEMO" };
export const SUPPORTER = { personId: "S-DEMO", name: "Alex" };
export const DISPLAY_NAMES = ["Sam", "S.", "Sam K."];

export const INTENTIONS = [
  { id: "walk", label: "Take a short walk" },
  { id: "checkin", label: "Make time for a check-in" },
  { id: "small_win", label: "Celebrate a small win" },
];

export const SUPPORT_TYPES = [
  { id: "encouragement", label: "Encouragement", hint: "A kind word now and then." },
  { id: "company", label: "Practical company", hint: "Someone to do the thing with." },
  { id: "listening", label: "Listening", hint: "Someone to talk to, no fixing." },
];

export const INVITE_TITLES = [
  "Would you cheer me on?",
  "A small thing I'm trying",
  "Fancy keeping me company?",
];

export const INVITE_MESSAGES = [
  { id: "none", text: "" },
  { id: "no_pressure", text: "No pressure at all. Say no if it's not a good time." },
  { id: "thumbs_up", text: "A thumbs-up now and then would mean a lot." },
];

export const SUPPORT_RESPONSES = {
  encouragement: [
    { id: "proud", text: "Proud of you for asking. I'm in." },
    { id: "rooting", text: "Rooting for you this week." },
  ],
  company: [
    { id: "join_walk", text: "Happy to come along. Thursday after work?" },
    { id: "same_time", text: "I'll do it at the same time and text you." },
  ],
  listening: [
    { id: "here", text: "Here whenever you want to talk." },
    { id: "call", text: "Fancy a call this weekend? No agenda." },
  ],
};

export const CHECKIN_OPTIONS = [
  { id: "did_it", text: "Did it" },
  { id: "tried", text: "Tried, not today" },
  { id: "paused", text: "Taking a pause this week" },
];

// The only keys that may ever leave the participant's device in an invitation.
export const ALLOWED_PAYLOAD_KEYS = ["displayName", "intention", "supportType", "title", "message"];
// Words that must never appear in any payload or fixture value.
export const SENSITIVE_TERMS = [
  "medication", "medicine", "mounjaro", "wegovy", "glp", "semaglutide", "tirzepatide",
  "dose", "diagnosis", "weight", "bmi", "kg", "prescription", "treatment", "order", "injection",
];

const SCREENS_NEEDING_PARTICIPANT = new Set(["path", "intention", "support", "review", "sent", "home", "checkin", "care", "safety"]);

export function initialState() {
  return {
    v: 3,
    role: null, // participant | supporter | curious
    screen: "welcome",
    path: null, // private | circle
    displayName: DISPLAY_NAMES[0],
    intention: null, // { id, label }
    draft: { supportType: null, title: INVITE_TITLES[0], messageId: "none" },
    circle: null,
    links: {}, // token -> circleId (old tokens kept to show revoked state)
    responses: [],
    checkins: [],
    week: 1,
    reminder: "off",
    muted: false,
    care: { choice: null },
    notice: null,
    supporterToken: null,
    supporterUnsupported: false,
    seq: 0,
    events: [],
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));

function isoFor(day, seq) {
  const d = new Date(`${DEMO_START}T09:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  d.setUTCMinutes(seq % 60);
  return d.toISOString().replace(".000Z", "Z");
}

export function log(state, eventType, extra = {}) {
  state.seq += 1;
  const role = extra.role || (state.role === "curious" ? "curious" : "participant");
  const person = role === "supporter" ? SUPPORTER.personId : PARTICIPANT.personId;
  state.events.push({
    event_id: `demo-${String(state.seq).padStart(4, "0")}`,
    person_id: person,
    household_id: PARTICIPANT.householdId,
    role,
    arm: state.path === "circle" ? "treatment" : state.path === "private" ? "control" : "unassigned",
    occurred_at: isoFor(state.week === 1 ? 1 + (state.seq % 6) : 8 + (state.seq % 6), state.seq),
    event_type: eventType,
    invite_id: extra.invite_id ?? (state.circle ? state.circle.id : null),
    helpful: extra.helpful ?? null,
    source_cohort: state.role === "curious" ? "curious_free" : "demo_session",
  });
}

export function buildPayload(state) {
  const st = SUPPORT_TYPES.find((t) => t.id === state.draft.supportType);
  const msg = INVITE_MESSAGES.find((m) => m.id === state.draft.messageId);
  const payload = {
    displayName: state.displayName,
    intention: state.intention ? state.intention.label : null,
    supportType: st ? st.label : null,
    title: state.draft.title,
    message: msg ? msg.text : "",
  };
  for (const k of Object.keys(payload)) if (!ALLOWED_PAYLOAD_KEYS.includes(k)) delete payload[k];
  return payload;
}

export const payloadKey = (p) => JSON.stringify(ALLOWED_PAYLOAD_KEYS.map((k) => p[k] ?? null));

// `exempt` lets analysis text use "treatment" as the experiment-arm name.
export function containsSensitive(value, exempt = []) {
  const text = JSON.stringify(value).toLowerCase();
  return SENSITIVE_TERMS.filter((t) => !exempt.includes(t) && new RegExp(`\\b${t}`, "i").test(text));
}

function tokenFor(seq) {
  // Deterministic, obviously fake token. Carries no personal information.
  const n = (seq * 2654435761) >>> 0;
  return `demo-${n.toString(36).slice(0, 6)}`;
}

function fail(state, message) {
  return { state, error: message };
}

// Every user action goes through here. Returns { state, error? }.
export function act(prev, action) {
  const s = clone(prev);
  s.notice = null;
  const c = s.circle;
  switch (action.type) {
    case "reset":
      return { state: initialState() };
    case "chooseRole": {
      if (!["participant", "supporter", "curious"].includes(action.role)) return fail(prev, "Unknown role");
      s.role = action.role;
      s.screen = action.role === "supporter" ? "supporter" : s.intention ? "home" : "path";
      return { state: s };
    }
    case "goto": {
      if (SCREENS_NEEDING_PARTICIPANT.has(action.screen) && !s.role) s.role = "participant";
      if (action.screen === "review" && !(s.intention && s.draft.supportType)) return fail(prev, "Choose an intention and a kind of support first.");
      s.screen = action.screen;
      return { state: s };
    }
    case "choosePath": {
      if (!["private", "circle"].includes(action.path)) return fail(prev, "Unknown path");
      s.path = action.path;
      s.screen = "intention";
      return { state: s };
    }
    case "setIntention": {
      const it = INTENTIONS.find((i) => i.id === action.id);
      if (!it) return fail(prev, "Choose one of the listed intentions.");
      const changed = !s.intention || s.intention.id !== it.id;
      s.intention = { ...it };
      if (changed) log(s, "intent_created", { invite_id: null });
      invalidateReview(s);
      s.screen = s.path === "circle" ? "support" : "home";
      return { state: s };
    }
    case "setDraft": {
      const d = { ...s.draft };
      if (action.supportType !== undefined) {
        if (!SUPPORT_TYPES.some((t) => t.id === action.supportType)) return fail(prev, "Unknown support type");
        d.supportType = action.supportType;
      }
      if (action.title !== undefined) {
        if (!INVITE_TITLES.includes(action.title)) return fail(prev, "Choose one of the listed titles.");
        d.title = action.title;
      }
      if (action.messageId !== undefined) {
        if (!INVITE_MESSAGES.some((m) => m.id === action.messageId)) return fail(prev, "Choose one of the listed messages.");
        d.messageId = action.messageId;
      }
      if (action.displayName !== undefined) {
        if (!DISPLAY_NAMES.includes(action.displayName)) return fail(prev, "Choose one of the listed names.");
        s.displayName = action.displayName;
      }
      s.draft = d;
      invalidateReview(s);
      return { state: s };
    }
    case "review": {
      if (s.path !== "circle") return fail(prev, "Reviews are only for circles. Private intentions are never shared.");
      if (!(s.intention && s.draft.supportType)) return fail(prev, "Choose an intention and a kind of support first.");
      const payload = buildPayload(s);
      if (!s.circle || s.circle.inviteState === "revoked" || s.circle.inviteState === "declined") {
        s.circle = {
          id: `C-${String(s.seq + 1).padStart(4, "0")}`,
          participantId: PARTICIPANT.personId,
          allowedFields: [...ALLOWED_PAYLOAD_KEYS],
          inviteState: "draft",
          memberIds: [],
          reviewedKey: null,
          payload: null,
          token: null,
          prevStates: [],
        };
      }
      s.circle.inviteState = "reviewed";
      s.circle.reviewedKey = payloadKey(payload);
      s.circle.payload = payload;
      s.circle.supportTypeId = s.draft.supportType;
      log(s, "share_previewed");
      s.screen = "review";
      return { state: s };
    }
    case "confirmInvite": {
      if (!c || c.inviteState !== "reviewed") return fail(prev, "Review what will be shared before creating a demo link.");
      if (!action.checked) return fail(prev, "Tick the box to confirm you've checked the preview.");
      if (payloadKey(buildPayload(s)) !== c.reviewedKey) return fail(prev, "Something changed since your review. Please review again.");
      c.inviteState = "sent_demo";
      c.token = tokenFor(s.seq + 7);
      s.links[c.token] = c.id;
      log(s, "demo_invite_confirmed");
      s.screen = "sent";
      return { state: s };
    }
    case "openLink": {
      s.role = "supporter";
      s.supporterToken = (action.token || "").trim();
      s.supporterUnsupported = false;
      s.screen = "supporter";
      return { state: s };
    }
    case "accept":
    case "decline": {
      const v = supporterView(s, s.supporterToken);
      if (v.status !== "invited") return fail(prev, "This invitation can't be answered.");
      if (action.type === "accept") {
        c.inviteState = "accepted";
        c.memberIds = [SUPPORTER.personId];
        log(s, "invite_accepted", { role: "supporter" });
      } else {
        c.inviteState = "declined";
        c.memberIds = [];
        log(s, "invite_declined", { role: "supporter" });
      }
      return { state: s };
    }
    case "sendSupport": {
      const v = supporterView(s, s.supporterToken);
      if (v.status !== "member") return fail(prev, "Only an accepted supporter can send support.");
      const opts = SUPPORT_RESPONSES[c.supportTypeId] || [];
      const r = opts.find((o) => o.id === action.id);
      if (!r) return fail(prev, "Only the preset responses can be sent in this prototype.");
      s.responses.push({ id: `R-${s.seq + 1}`, text: r.text, week: s.week, helpful: null, circleId: c.id });
      log(s, "support_sent", { role: "supporter" });
      s.notice = "Sent. Sam will see it next time they open the app.";
      return { state: s };
    }
    case "tryFreeText": {
      s.supporterUnsupported = true;
      return { state: s };
    }
    case "markHelpful": {
      const r = s.responses.find((x) => x.id === action.id);
      if (!r || !c || r.circleId !== c.id || c.inviteState === "revoked") return fail(prev, "That response is no longer available.");
      if (r.helpful === action.helpful) return { state: s };
      r.helpful = !!action.helpful;
      log(s, "support_marked_helpful", { helpful: r.helpful });
      return { state: s };
    }
    case "mute": {
      if (!c || c.inviteState !== "accepted") return fail(prev, "There's no active circle to mute.");
      s.muted = !s.muted;
      log(s, s.muted ? "circle_muted" : "circle_unmuted");
      return { state: s };
    }
    case "revoke":
    case "leave": {
      if (!c || !["reviewed", "sent_demo", "accepted", "declined"].includes(c.inviteState)) return fail(prev, "There's nothing shared to stop.");
      c.inviteState = "revoked";
      c.memberIds = [];
      c.payload = null;
      c.reviewedKey = null;
      s.responses = s.responses.filter((r) => r.circleId !== c.id);
      s.muted = false;
      log(s, action.type === "revoke" ? "circle_revoked" : "circle_left");
      if (action.type === "leave") {
        s.path = "private";
        s.notice = "You've left Circles. Your intention is private again and nothing is shared.";
      } else {
        s.notice = "Access removed. Alex can no longer see your intention or past messages.";
      }
      s.screen = "home";
      return { state: s };
    }
    case "startNewInvite": {
      s.path = "circle";
      s.screen = "support";
      return { state: s };
    }
    case "checkin": {
      const o = CHECKIN_OPTIONS.find((x) => x.id === action.id);
      if (!o || !s.intention) return fail(prev, "Choose an intention first.");
      if (s.checkins.some((k) => k.week === s.week)) return fail(prev, "You've already checked in this week. That's plenty.");
      s.checkins.push({ week: s.week, id: o.id, text: o.text });
      log(s, "meaningful_checkin");
      s.screen = "home";
      s.notice = "Checked in. Noticing how it went is the point, whatever the answer.";
      return { state: s };
    }
    case "nextWeek": {
      if (s.week !== 1) return fail(prev, "This demo covers two weeks.");
      s.week = 2;
      s.notice = "It's now week 2 of the demo. Nothing was lost while you were away.";
      return { state: s };
    }
    case "setReminder": {
      if (!["off", "weekly"].includes(action.value)) return fail(prev, "Unknown reminder option");
      s.reminder = action.value;
      return { state: s };
    }
    case "care": {
      if (!["explored", "skipped"].includes(action.choice)) return fail(prev, "Unknown choice");
      s.care.choice = action.choice;
      if (action.choice === "explored") {
        log(s, "care_info_opened", { invite_id: null });
        s.screen = "care";
      }
      return { state: s };
    }
    case "reportUnwanted": {
      log(s, "unwanted_share_reported");
      s.notice = "Thanks for telling us. In a real product this would reach a person on the privacy team.";
      return { state: s };
    }
    default:
      return fail(prev, `Unknown action ${action.type}`);
  }
}

function invalidateReview(s) {
  if (s.circle && s.circle.inviteState === "reviewed" && payloadKey(buildPayload(s)) !== s.circle.reviewedKey) {
    s.circle.inviteState = "draft";
    s.circle.reviewedKey = null;
    s.circle.payload = null;
  }
}

// What a supporter holding `token` can see. Only reviewed payload fields, never more.
export function supporterView(state, token) {
  if (!token) return { status: "no_link" };
  const circleId = state.links[token];
  if (!circleId) return { status: "invalid" };
  const c = state.circle;
  if (!c || c.id !== circleId || c.inviteState === "revoked") return { status: "revoked" };
  if (c.inviteState === "declined") return { status: "declined" };
  if (c.inviteState === "sent_demo") return { status: "invited", payload: { ...c.payload } };
  if (c.inviteState === "accepted") {
    return {
      status: "member",
      payload: { ...c.payload },
      sent: state.responses.filter((r) => r.circleId === c.id).map((r) => ({ text: r.text, week: r.week })),
    };
  }
  return { status: "invalid" };
}

export function showCareCard(state) {
  if (state.care.choice) return false;
  return state.checkins.length > 0 || state.responses.some((r) => r.helpful === true);
}
