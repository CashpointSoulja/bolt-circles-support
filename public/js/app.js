import {
  act, initialState, supporterView, buildPayload, showCareCard,
  INTENTIONS, SUPPORT_TYPES, INVITE_TITLES, INVITE_MESSAGES, SUPPORT_RESPONSES, CHECKIN_OPTIONS, DISPLAY_NAMES, SUPPORTER,
} from "./model.js";
import { analyze, eventsCsv, metricsCsv, decisionMarkdown, THRESHOLDS, EVENT_COLUMNS } from "./analysis.js";
import { buildFixture, COHORT_LABELS } from "./fixtures.js";

const KEY = "sot-demo-v3";
const AKEY = "sot-analyst-v1";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (p) => (p === null || p === undefined ? "n/a" : `${(p * 100).toFixed(1)}%`);
const pp = (d) => (d === null || d === undefined ? "n/a" : `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)} pp`);

let state = load(KEY) || initialState();
let analyst = load(AKEY) || { dataset: "misleading", cohort: "all", retries: 0 };
let error = null;
const fixtures = { promising: buildFixture("promising"), misleading: buildFixture("misleading") };

function load(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(AKEY, JSON.stringify(analyst));
  } catch { /* private mode: state stays in memory */ }
}
function announce(text) { document.getElementById("live").textContent = text; }

function dispatch(action) {
  const prevScreen = state.screen;
  const res = act(state, action);
  error = res.error || null;
  state = res.state;
  save();
  render();
  if (error) announce(error);
  else if (state.notice) announce(state.notice);
  if (state.screen !== prevScreen) {
    const h = document.querySelector("#phone h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }
}

// ---------- Phone screens ----------
const btn = (label, action, cls = "", attrs = "") => `<button type="button" class="btn ${cls}" data-action='${esc(JSON.stringify(action))}' ${attrs}>${esc(label)}</button>`;
const radio = (name, value, label, checked, hint = "") => `<label class="option"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""}><span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ""}</span></label>`;

function roleBar() {
  if (!state.role) return "";
  const who = state.role === "supporter" ? `${SUPPORTER.name} (supporter)` : state.role === "curious" ? `${state.displayName} (curious free user)` : `${state.displayName} (participant)`;
  const swap = state.role === "supporter"
    ? btn("Switch to participant", { type: "chooseRole", role: "participant" }, "quiet small")
    : btn("Switch to supporter", { type: "chooseRole", role: "supporter" }, "quiet small");
  return `<div class="role-bar"><span>Viewing as <span class="who">${esc(who)}</span></span><span class="spacer"></span>${swap}</div>
  <p class="fine" style="margin-top:-.75rem">Role switching is a demo shortcut, not how sign-in would work. Nothing changes permissions.</p>`;
}

const SCREENS = {
  welcome: () => `
    <div class="step">Welcome</div>
    <h1>Support, on your terms</h1>
    <p class="lead">Keep an everyday intention to yourself, or ask one person to cheer you on. You decide what they see, and you can stop at any time.</p>
    <div class="card"><p style="margin:0">This is an independent prototype using synthetic data. There are no accounts, no real invitations and no health information.</p></div>
    <h2>Who are you here as?</h2>
    <div class="stack">
      ${btn("I'm starting something for me", { type: "chooseRole", role: "participant" })}
      ${btn("Someone invited me to support them", { type: "chooseRole", role: "supporter" }, "secondary")}
      ${btn("I'm just curious", { type: "chooseRole", role: "curious" }, "secondary")}
    </div>
    <p class="fine" style="margin-top:1rem">"Just curious" lets you try it without saying anything about your health.</p>`,

  path: () => `
    <div class="step">Step 1 of 4</div>
    <h1>Private, or with someone?</h1>
    <p class="lead">Both are good choices. You can change your mind later.</p>
    <div class="stack">
      <div class="card plain"><h3>Keep it private</h3><p>Set an intention and check in for yourself. Nobody else sees it.</p>${btn("Keep it private", { type: "choosePath", path: "private" })}</div>
      <div class="card plain"><h3>Invite one person</h3><p>Pick what to share, preview exactly what they'll see, then decide.</p>${btn("Invite one person", { type: "choosePath", path: "circle" }, "secondary")}</div>
    </div>`,

  intention: () => `
    <div class="step">Step 2 of 4</div>
    <h1>Pick an everyday intention</h1>
    <p class="lead">Something small for this week. ${state.path === "private" ? "This stays on your device only." : "It stays private until you review and confirm an invitation."}</p>
    <form data-form="intention">
      <fieldset class="choice"><legend>This week I'd like to…</legend>
        ${INTENTIONS.map((i) => radio("intention", i.id, i.label, state.intention?.id === i.id)).join("")}
      </fieldset>
      <button class="btn" type="submit" style="width:100%">Continue</button>
    </form>
    <p class="fine" style="margin-top:1rem">There's deliberately no weight goal, dose or diet plan here.</p>`,

  support: () => {
    const d = state.draft;
    return `
    <div class="step">Step 3 of 4</div>
    <h1>What kind of support?</h1>
    <form data-form="draft">
      <fieldset class="choice"><legend>I'd like…</legend>
        ${SUPPORT_TYPES.map((t) => radio("supportType", t.id, t.label, d.supportType === t.id, t.hint)).join("")}
      </fieldset>
      <fieldset class="choice"><legend>Invitation title</legend>
        ${INVITE_TITLES.map((t) => radio("title", t, t, d.title === t)).join("")}
      </fieldset>
      <fieldset class="choice"><legend>Optional note</legend>
        ${INVITE_MESSAGES.map((m) => radio("messageId", m.id, m.text || "No note", d.messageId === m.id)).join("")}
      </fieldset>
      <fieldset class="choice"><legend>Show my name as</legend>
        ${DISPLAY_NAMES.map((n) => radio("displayName", n, n, state.displayName === n)).join("")}
      </fieldset>
      <button class="btn" type="submit" style="width:100%">Preview what they'll see</button>
    </form>`;
  },

  review: () => {
    const p = state.circle?.payload || buildPayload(state);
    return `
    <div class="step">Step 4 of 4 · Review</div>
    <h1>This is everything they'll see</h1>
    <div class="preview" aria-label="Recipient preview">
      <h3>${esc(p.title)}</h3>
      <dl>
        <dt>From</dt><dd>${esc(p.displayName)}</dd>
        <dt>Intention</dt><dd>${esc(p.intention)}</dd>
        <dt>Support</dt><dd>${esc(p.supportType)}</dd>
        ${p.message ? `<dt>Note</dt><dd>${esc(p.message)}</dd>` : ""}
      </dl>
    </div>
    <div class="card never" style="margin-top:.9rem"><strong>Never shared</strong>
      <ul><li>Anything about medicines, orders or care</li><li>Health details of any kind</li><li>Your check-ins, unless you choose to tell them yourself</li></ul>
    </div>
    <form data-form="confirm">
      <label class="check"><input type="checkbox" name="checked" id="confirm-box"><span>I've checked the preview and I'm happy for this one person to see it.</span></label>
      <div class="stack">
        <button class="btn" type="submit">Create demo invitation</button>
        ${btn("Change something", { type: "goto", screen: "support" }, "secondary")}
        ${btn("Keep it private instead", { type: "choosePath", path: "private" }, "quiet")}
      </div>
    </form>`;
  },

  sent: () => {
    const c = state.circle;
    const v = supporterView(state, c?.token);
    const text = demoLinkText(c?.token);
    const waiting = v.status === "invited";
    return `
    <div class="step">Invitation created</div>
    <h1>${waiting ? "Waiting for Alex" : v.status === "member" ? "Alex said yes" : "Invitation closed"}</h1>
    <p class="lead">${waiting ? "No reply yet, and that's fine. People get busy." : v.status === "member" ? "They can now send you a short preset message." : "This invitation is no longer active."}</p>
    <div class="linkcard" aria-label="Simulated link">${esc(text)}</div>
    <p class="fine">Nothing has been sent anywhere. This demo link only works inside this prototype, on this device.</p>
    <div class="stack">
      ${btn("Copy demo link", { type: "copy" }, "secondary")}
      ${btn("Open as Alex (supporter)", { type: "openLink", token: c?.token })}
      ${btn("Go to my intention", { type: "goto", screen: "home" }, "quiet")}
    </div>`;
  },

  home: () => homeScreen(),
  checkin: () => `
    <div class="step">Week ${state.week} check-in</div>
    <h1>How did it go?</h1>
    <p class="lead">${esc(state.intention?.label)}. Any answer counts. Noticing is the point.</p>
    <div class="stack">${CHECKIN_OPTIONS.map((o) => btn(o.text, { type: "checkin", id: o.id }, "secondary")).join("")}</div>
    <div style="margin-top:1rem">${btn("Back", { type: "goto", screen: "home" }, "quiet")}</div>`,

  care: () => `
    <div class="step">Information only</div>
    <h1>Clinician-led care</h1>
    <p>In a real product this page would explain, in plain words, how care led by clinicians works and how to talk to a care team.</p>
    <div class="card"><p style="margin:0">In this prototype nothing is booked, assessed or bought. There's no eligibility check and no price. Your supporter can't see that you looked.</p></div>
    <div class="stack">${btn("Back to my intention", { type: "goto", screen: "home" })}</div>`,

  safety: () => `
    <div class="step">Health questions</div>
    <h1>Ask your care team</h1>
    <p>Questions about symptoms, medicines or treatment belong with the clinicians who know you. This space doesn't answer them, and supporters aren't asked to.</p>
    <div class="card caution"><h3>If it feels urgent</h3><p style="margin:0">In the UK, call 111 for urgent advice or 999 in an emergency.</p></div>
    <div class="stack">${btn("Back", { type: "goto", screen: state.role === "supporter" ? "supporter" : "home" }, "secondary")}</div>`,

  supporter: () => supporterScreen(),
};

function demoLinkText(token) {
  return `DEMO ONLY - not a real invitation. Synthetic prototype link: https://demo.invalid/circle/${token || "none"}`;
}

function homeScreen() {
  const c = state.circle;
  const active = c && ["sent_demo", "accepted"].includes(c.inviteState);
  const checked = state.checkins.find((k) => k.week === state.week);
  const visible = state.muted ? [] : state.responses.filter((r) => r.circleId === c?.id);
  let circleCard = "";
  if (state.path === "circle" && c) {
    if (c.inviteState === "accepted") {
      circleCard = `<div class="card plain"><h3>Your circle: Alex</h3>
        <p class="muted">Alex sees: ${esc(c.payload.intention)} · ${esc(c.payload.supportType)} · your name as "${esc(c.payload.displayName)}".</p>
        ${state.muted ? `<p><span class="pill">Muted</span> Messages wait quietly. ${state.responses.length} waiting.</p>` : ""}
        ${visible.map((r) => `<div class="msg"><div class="meta">From Alex · week ${r.week}</div><p style="margin:.25rem 0 .5rem">${esc(r.text)}</p>
          <div class="row" role="group" aria-label="Was this helpful?">
            ${btn(r.helpful === true ? "Helpful ✓" : "Helpful", { type: "markHelpful", id: r.id, helpful: true }, "small " + (r.helpful === true ? "" : "secondary"), `aria-pressed="${r.helpful === true}"`)}
            ${btn(r.helpful === false ? "Not for me ✓" : "Not for me", { type: "markHelpful", id: r.id, helpful: false }, "small " + (r.helpful === false ? "" : "secondary"), `aria-pressed="${r.helpful === false}"`)}
          </div></div>`).join("")}
        ${!state.muted && !visible.length ? `<p class="muted">No messages yet.</p>` : ""}
        <div class="row" style="margin-top:.5rem">
          ${btn(state.muted ? "Unmute" : "Mute", { type: "mute" }, "secondary small")}
          ${btn("Remove Alex's access", { type: "revoke" }, "danger small")}
          ${btn("Leave Circles", { type: "leave" }, "quiet small")}
        </div>
        ${btn("Something was shared I didn't want", { type: "reportUnwanted" }, "quiet small")}
      </div>`;
    } else if (c.inviteState === "sent_demo") {
      circleCard = `<div class="card plain"><h3>Waiting for Alex</h3><p class="muted">No reply yet. There's nothing you need to do.</p>
        <div class="row">${btn("See invitation", { type: "goto", screen: "sent" }, "secondary small")}${btn("Cancel invitation", { type: "revoke" }, "danger small")}</div></div>`;
    } else if (c.inviteState === "declined") {
      circleCard = `<div class="card plain"><h3>Alex can't right now</h3><p class="muted">That's completely fine. Your intention is still yours.</p>
        <div class="row">${btn("Invite again", { type: "startNewInvite" }, "secondary small")}${btn("Close this invitation", { type: "revoke" }, "quiet small")}</div></div>`;
    } else if (c.inviteState === "revoked") {
      circleCard = `<div class="card plain"><h3>Nobody can see this</h3><p class="muted">The old link no longer works. Your intention is private.</p>
        <div class="row">${btn("Invite someone new", { type: "startNewInvite" }, "secondary small")}${btn("Check the old link", { type: "openLink", token: c.token }, "quiet small")}</div></div>`;
    } else {
      circleCard = `<div class="card plain"><h3>Not shared yet</h3><p class="muted">Nothing is visible to anyone until you review and confirm.</p>${btn("Continue invitation", { type: "goto", screen: "support" }, "secondary small")}</div>`;
    }
  } else {
    circleCard = `<div class="card plain"><h3>Private</h3><p class="muted">Only you can see this intention.${c && c.inviteState === "revoked" ? " Earlier demo links no longer work." : ""}</p>
      ${btn("Invite one person", { type: "startNewInvite" }, "secondary small")}</div>`;
  }
  const care = showCareCard(state) ? `<div class="card plain" aria-label="Optional care information"><div class="step">Separate from your circle · optional</div>
      <h3>Curious about care led by clinicians?</h3><p class="muted">Only you see this. Information only.</p>
      <div class="row">${btn("Explore clinician-led care", { type: "care", choice: "explored" }, "small")}${btn("Not now", { type: "care", choice: "skipped" }, "quiet small")}</div></div>` : "";
  return `
    <div class="step">Week ${state.week} of 2 (demo)</div>
    <h1>${esc(state.intention?.label || "Your intention")}</h1>
    ${state.notice ? `<div class="notice" role="status">${esc(state.notice)}</div>` : ""}
    <div class="card ${checked ? "green" : ""}">
      ${checked ? `<h3>Checked in: ${esc(checked.text)}</h3><p style="margin:0">That's this week done. ${state.week === 1 ? "Come back next week if you like." : "Thanks for trying this."}</p>`
        : `<h3>This week's check-in</h3><p>One tap, whenever suits you.</p>${btn("Check in", { type: "goto", screen: "checkin" })}`}
    </div>
    ${circleCard}
    ${care}
    <div class="card plain"><h3>Reminder</h3>
      <form data-form="reminder" class="row" aria-label="Reminder preference">
        ${radio("reminder", "off", "No reminder", state.reminder === "off")}
        ${radio("reminder", "weekly", "Weekly nudge (simulated)", state.reminder === "weekly")}
      </form>
      <p class="fine" style="margin:.5rem 0 0">Saved on this device only. No notification permission is requested and nothing is sent.</p>
    </div>
    <div class="row">
      ${state.week === 1 ? btn("Skip ahead to week 2 (demo)", { type: "nextWeek" }, "secondary small") : ""}
      ${btn("I have a health question", { type: "goto", screen: "safety" }, "quiet small")}
    </div>`;
}

function supporterScreen() {
  const v = supporterView(state, state.supporterToken);
  const links = Object.keys(state.links);
  const linkList = links.length ? `<hr class="divider"><h3>Demo links on this device</h3><div class="stack">${links.map((t) => btn(`Open ${t}`, { type: "openLink", token: t }, "secondary small")).join("")}</div>` : "";
  if (v.status === "no_link") {
    return `<div class="step">Supporter</div><h1>No invitations yet</h1>
      <p class="lead">When someone invites you, their invitation shows here. There's nothing to browse and no feed.</p>${linkList}
      <div style="margin-top:1rem">${btn("Back to start", { type: "goto", screen: "welcome" }, "quiet")}</div>`;
  }
  if (v.status === "invalid") return `<div class="step">Supporter</div><h1>This link doesn't work</h1><p class="lead">It may be mistyped.</p>${linkList}`;
  if (v.status === "revoked") {
    return `<div class="step">Supporter</div><h1>This invitation is no longer active</h1>
      <p class="lead">The person who sent it has closed it. There's nothing more to see here, and nothing you need to do.</p>${linkList}`;
  }
  if (v.status === "declined") {
    return `<div class="step">Supporter</div><h1>You said not right now</h1><p class="lead">No problem. They've been told kindly, and nothing else changes.</p>${linkList}`;
  }
  const p = v.payload;
  const details = `<div class="preview"><h3>${esc(p.title)}</h3><dl>
    <dt>From</dt><dd>${esc(p.displayName)}</dd><dt>Intention</dt><dd>${esc(p.intention)}</dd><dt>Support</dt><dd>${esc(p.supportType)}</dd>${p.message ? `<dt>Note</dt><dd>${esc(p.message)}</dd>` : ""}</dl></div>`;
  if (v.status === "invited") {
    return `<div class="step">Supporter · invitation</div><h1>${esc(p.displayName)} invited you</h1>${details}
      <p class="fine" style="margin-top:.75rem">This is everything they chose to share.</p>
      <div class="stack">${btn("Yes, I'm in", { type: "accept" })}${btn("Not right now", { type: "decline" }, "secondary")}</div>
      <p class="fine" style="margin-top:.75rem">Saying no is fine. They'll just see that you can't right now.</p>`;
  }
  const opts = SUPPORT_RESPONSES[state.circle.supportTypeId] || [];
  return `<div class="step">Supporter · in ${esc(p.displayName)}'s circle</div><h1>Send something kind</h1>
    ${state.notice ? `<div class="notice" role="status">${esc(state.notice)}</div>` : ""}
    ${details}
    <h3 style="margin-top:1rem">Pick a message</h3>
    <div class="stack">${opts.map((o) => btn(o.text, { type: "sendSupport", id: o.id }, "secondary")).join("")}</div>
    ${state.supporterUnsupported ? `<div class="card caution" style="margin-top:.9rem" role="status"><h3>Your own words aren't supported here</h3><p style="margin:0">To keep this safe without reading people's messages, the prototype only sends preset notes. Say anything else in your usual way, outside the app. Please don't give health advice.</p></div>`
      : `<div style="margin-top:.6rem">${btn("Write my own message", { type: "tryFreeText" }, "quiet small")}</div>`}
    ${v.sent.length ? `<h3 style="margin-top:1rem">You've sent</h3>${v.sent.map((m) => `<div class="msg"><div class="meta">Week ${m.week}</div>${esc(m.text)}</div>`).join("")}` : ""}
    ${btn("They asked me a health question", { type: "goto", screen: "safety" }, "quiet small")}`;
}

function renderPhone() {
  const el = document.getElementById("phone");
  const screen = SCREENS[state.screen] ? state.screen : "welcome";
  el.innerHTML = `${roleBar()}${error ? `<div class="error" role="alert">${esc(error)}</div>` : ""}${SCREENS[screen]()}
    <hr class="divider"><div class="row">${btn("Reset demo", { type: "reset" }, "quiet small")}<span class="fine">Clears everything on this device.</span></div>`;
}

// ---------- Analyst ----------
function datasetRows() {
  const fx = fixtures[analyst.dataset];
  const rows = [...fx.rows];
  // Simulated client retries: re-deliver already-seen events with the same IDs.
  const pool = rows.filter((r) => r.event_type === "support_marked_helpful");
  for (let i = 0; i < analyst.retries; i++) rows.push({ ...pool[i % pool.length] });
  return { fx, rows };
}

function renderAnalyst() {
  const el = document.getElementById("analyst");
  const { fx, rows } = datasetRows();
  const a = analyze(rows, { cohort: analyst.cohort, dataCut: fx.dataCut });
  const small = a.households.inScope.control < THRESHOLDS.minPerArm || a.households.inScope.treatment < THRESHOLDS.minPerArm;
  const vcls = a.decision.verdict === "continue limited test" ? "green" : a.decision.verdict === "hold for more evidence" ? "hold" : "caution";
  const metricRow = (m) => `<tr><th scope="row">${esc(m.name)}<div class="formula">${esc(m.formula)}</div></th>
    <td class="num" data-label="Control">${m.arms.control.k}/${m.arms.control.n}<br>${pct(m.arms.control.p)}</td>
    <td class="num" data-label="Treatment">${m.arms.treatment.k}/${m.arms.treatment.n}<br>${pct(m.arms.treatment.p)}</td>
    <td class="num" data-label="Difference">${pp(m.ci?.diff)}<br><span class="formula">95% CI ${pp(m.ci?.lo)} to ${pp(m.ci?.hi)}</span></td></tr>`;
  const session = state.events;
  el.innerHTML = `<div class="analyst">
    <div class="step">Analyst view · synthetic fixtures</div>
    <h1>Did a circle help people come back?</h1>
    <p class="lead">Household-randomised test. Control: private intention + check-in. Treatment: optional circle invitation + support. Every number shows its numerator and denominator.</p>
    <div class="controls">
      <label>Dataset <select id="ds">
        <option value="promising" ${analyst.dataset === "promising" ? "selected" : ""}>${esc(fixtures.promising.label)}</option>
        <option value="misleading" ${analyst.dataset === "misleading" ? "selected" : ""}>${esc(fixtures.misleading.label)}</option>
      </select></label>
      <label>Cohort <select id="cohort">
        <option value="all">All cohorts (pooled)</option>
        ${a.cohorts.map((c) => `<option value="${c}" ${analyst.cohort === c ? "selected" : ""}>${esc(COHORT_LABELS[c] || c)}</option>`).join("")}
      </select></label>
      ${btn("Simulate 3 client retries", { type: "retry" }, "secondary small")}
      ${btn("Reset analyst view", { type: "resetAnalyst" }, "quiet small")}
    </div>
    <p class="fine">${esc(fx.note)}</p>
    <div class="card ${vcls}" aria-live="polite">
      <div class="step" style="color:inherit">Decision (pooled assigned set)</div>
      <h2 class="verdict" data-testid="verdict">${esc(a.decision.verdict[0].toUpperCase() + a.decision.verdict.slice(1))}</h2>
      <ul>${a.decision.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <p class="fine" style="color:inherit;margin:0">Never an automatic launch. Thresholds are illustrative test rules, not medical standards. No clinical effectiveness can be inferred.</p>
    </div>
    ${small ? `<div class="card caution" role="status"><h3>Small sample</h3><p style="margin:0">This cohort has ${a.households.inScope.control} control and ${a.households.inScope.treatment} treatment households, under the ${THRESHOLDS.minPerArm}-per-arm rule. Read it as a direction to investigate, not a result.</p></div>` : ""}
    <div class="grid two">
      <div class="card plain"><h3>Assignment</h3>
        <p>Unit: participant household. arm = FNV-1a hash("${esc(a.seed)}:household_id") mod 2. Supporters inherit their household's arm, so they never cross arms.</p>
        <p class="num">${a.households.control} control · ${a.households.treatment} treatment households (this cohort: ${a.households.inScope.control} / ${a.households.inScope.treatment})</p>
        <p class="fine" style="margin:0">Window ${esc(a.window.from?.slice(0, 10))} to ${esc(a.window.to?.slice(0, 10))} · data cut ${esc(a.dataCut.slice(0, 10))}</p></div>
      <div class="card plain"><h3>Events</h3>
        <p class="num">${a.raw} raw · ${a.kept} used · <span data-testid="excluded">${a.excluded.length}</span> excluded</p>
        <ul>${Object.entries(a.exclusionsByReason).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join("")}</ul></div>
    </div>
    <div class="card plain"><h3>Participant metrics (intention-to-treat)</h3><div class="tablewrap"><table class="stacked">
      <thead><tr><th>Metric</th><th>Control</th><th>Treatment</th><th>Difference</th></tr></thead>
      <tbody>${Object.values(a.metrics).map(metricRow).join("")}</tbody></table></div>
      <p class="fine" style="margin:.5rem 0 0">Meaningful = a check-in, or a received response the participant marked helpful. App opens and invite sends don't count. Week 4: ${a.missingW4} households not yet observable at the data cut and left out of that denominator.</p></div>
    <div class="grid two">
      <div class="card plain"><h3>Support loop (treatment)</h3><div class="tablewrap"><table><tbody>
        ${a.loop.map((s) => `<tr><th scope="row">${esc(s.step)}</th><td class="num">${s.k}/${s.n}</td><td class="num">${pct(s.p)}</td></tr>`).join("")}
      </tbody></table></div></div>
      <div class="card plain"><h3>Weekly active, kept apart</h3><div class="tablewrap"><table>
        <thead><tr><th>Week</th><th>Participants</th><th>Supporters</th></tr></thead>
        <tbody>${a.wau.map((w) => `<tr><td>${w.week}</td><td class="num">${w.participant}</td><td class="num">${w.supporter}</td></tr>`).join("")}</tbody></table></div>
        <p class="fine" style="margin:.5rem 0 0">Supporters are never added to participant engagement.</p></div>
    </div>
    <div class="grid two">
      <div class="card plain"><h3>Guardrails (treatment)</h3><div class="tablewrap"><table><tbody>
        ${a.guardrails.map((g) => `<tr><th scope="row">${esc(g.name)}<div class="formula">${esc(g.note)} · max ${(g.max * 100).toFixed(0)}%</div></th><td class="num">${g.k}/${g.n} = ${pct(g.p)}</td><td><span class="pill ${g.pass ? "pass" : "fail"}">${g.pass ? "Within limit" : "Over limit"}</span></td></tr>`).join("")}
      </tbody></table></div></div>
      <div class="card plain"><h3>Confounding and data checks</h3><div class="tablewrap"><table><tbody>
        ${a.checks.map((c) => `<tr><th scope="row">${esc(c.name)}<div class="formula">${esc(c.detail)}</div></th><td><span class="pill ${c.pass ? "pass" : "fail"}">${c.pass ? "Pass" : "Fail"}</span></td></tr>`).join("")}
      </tbody></table></div></div>
    </div>
    <div class="card plain"><h3>Primary metric within each cohort</h3><div class="tablewrap"><table class="stacked">
      <thead><tr><th>Cohort</th><th>Control</th><th>Treatment</th><th>Difference</th><th>Share of control / treatment arm</th></tr></thead>
      <tbody>${a.perCohort.map((x) => { const m = a.mix.find((y) => y.cohort === x.cohort); return `<tr><th scope="row">${esc(COHORT_LABELS[x.cohort] || x.cohort)}</th><td class="num" data-label="Control">${x.control.k}/${x.control.n} = ${pct(x.control.p)}</td><td class="num" data-label="Treatment">${x.treatment.k}/${x.treatment.n} = ${pct(x.treatment.p)}</td><td class="num" data-label="Difference">${pp(x.diff)}</td><td class="num" data-label="Arm share C / T">${pct(m.control)} / ${pct(m.treatment)}</td></tr>`; }).join("")}
      <tr><th scope="row">Pooled</th><td class="num" data-label="Control">${a.pooled.control.k}/${a.pooled.control.n} = ${pct(a.pooled.control.p)}</td><td class="num" data-label="Treatment">${a.pooled.treatment.k}/${a.pooled.treatment.n} = ${pct(a.pooled.treatment.p)}</td><td class="num" data-label="Difference">${pp(a.pooled.diff)}</td><td class="num" data-label="Events / household">Meaningful events per household: ${a.pooledEventsPer.control?.toFixed(2)} / ${a.pooledEventsPer.treatment?.toFixed(2)}</td></tr>
      </tbody></table></div></div>
    <div class="card plain"><h3>Curious free users: care information interest</h3>
      <p class="num">${a.careInterest.k}/${a.careInterest.n} = ${pct(a.careInterest.p)} opened "Explore clinician-led care"</p>
      <p class="fine" style="margin:0">Interest in information, not paid conversion or a health outcome. Real free-to-patient conversion isn't available in this prototype. Supporters never see it.</p></div>
    <div class="card"><h3>Export</h3><p class="fine">Downloads are generated on this device from the rows above. Nothing is uploaded.</p>
      <div class="row">${btn("Decision record (.md)", { type: "export", kind: "md" })}${btn("Events (.csv)", { type: "export", kind: "events" }, "secondary")}${btn("Metrics (.csv)", { type: "export", kind: "metrics" }, "secondary")}</div></div>
    <div class="card plain"><h3>This demo session's events</h3>
      <p class="fine">Logged locally by the phone app with the same schema. Not mixed into the fixtures. ${session.length} events.</p>
      ${session.length ? `<div class="tablewrap"><table><thead><tr>${["event_id", "role", "arm", "event_type", "invite_id", "helpful"].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
        ${session.slice(-12).reverse().map((r) => `<tr>${["event_id", "role", "arm", "event_type", "invite_id", "helpful"].map((c) => `<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <div class="row" style="margin-top:.6rem">${btn("Session events (.csv)", { type: "export", kind: "session" }, "secondary small")}</div>` : `<p class="muted" style="margin:0">Nothing yet. Try the phone app.</p>`}
    </div>
  </div>`;
  el.querySelector("#ds").addEventListener("change", (e) => { analyst.dataset = e.target.value; analyst.cohort = "all"; save(); renderAnalyst(); announce(`Showing ${e.target.selectedOptions[0].text}`); });
  el.querySelector("#cohort").addEventListener("change", (e) => { analyst.cohort = e.target.value; save(); renderAnalyst(); announce(`Cohort: ${e.target.selectedOptions[0].text}`); });
  el._analysis = { a, rows, fx };
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function analystAction(action) {
  if (action.type === "retry") { analyst.retries += 3; save(); renderAnalyst(); announce("Three duplicate deliveries added. Each is excluded once; metrics are unchanged."); return; }
  if (action.type === "resetAnalyst") { analyst = { dataset: "misleading", cohort: "all", retries: 0 }; save(); renderAnalyst(); announce("Analyst view reset."); return; }
  const { a, rows, fx } = document.getElementById("analyst")._analysis;
  const slug = `${fx.name}-${a.cohort}`;
  if (action.kind === "md") download(`decision-${slug}.md`, decisionMarkdown(a, `${fx.label} · cohort ${a.cohort}`), "text/markdown");
  if (action.kind === "events") download(`events-${fx.name}.csv`, eventsCsv(rows), "text/csv");
  if (action.kind === "metrics") download(`metrics-${slug}.csv`, metricsCsv(a), "text/csv");
  if (action.kind === "session") download("events-demo-session.csv", eventsCsv(state.events, { validate: false }), "text/csv");
  announce("Download started.");
}

// ---------- Wiring ----------
function route() {
  const tab = location.hash === "#/analyst" ? "analyst" : "app";
  document.getElementById("view-app").hidden = tab !== "app";
  document.getElementById("view-analyst").hidden = tab !== "analyst";
  document.querySelectorAll("[data-tab]").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  render();
}
function render() {
  if (!document.getElementById("view-app").hidden) renderPhone();
  if (!document.getElementById("view-analyst").hidden) renderAnalyst();
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = JSON.parse(b.dataset.action);
  if (["retry", "resetAnalyst", "export"].includes(action.type)) return analystAction(action);
  if (action.type === "copy") {
    const text = demoLinkText(state.circle?.token);
    try { await navigator.clipboard.writeText(text); state.notice = null; announce("Demo link copied. It only works inside this prototype."); b.textContent = "Copied (demo only)"; }
    catch { announce("Copy isn't available here. The demo link is shown above."); b.textContent = "Copy unavailable: select the text above"; }
    return;
  }
  dispatch(action);
});

document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const data = new FormData(f);
  if (f.dataset.form === "intention") {
    if (!data.get("intention")) { error = "Choose one of the intentions to continue."; renderPhone(); announce(error); return; }
    dispatch({ type: "setIntention", id: data.get("intention") });
  }
  if (f.dataset.form === "draft") {
    if (!data.get("supportType")) { error = "Choose the kind of support you'd like."; renderPhone(); announce(error); return; }
    const r = act(state, { type: "setDraft", supportType: data.get("supportType"), title: data.get("title"), messageId: data.get("messageId"), displayName: data.get("displayName") });
    if (r.error) { error = r.error; renderPhone(); return; }
    state = r.state;
    dispatch({ type: "review" });
  }
  if (f.dataset.form === "confirm") dispatch({ type: "confirmInvite", checked: data.get("checked") === "on" });
});

document.addEventListener("change", (e) => {
  const f = e.target.closest("form[data-form='reminder']");
  if (f) dispatch({ type: "setReminder", value: e.target.value });
});

window.addEventListener("hashchange", route);
window.__demo = { get state() { return state; }, EVENT_COLUMNS };
route();
