import { describe, it, expect } from "vitest";
import { act, initialState, supporterView, buildPayload, containsSensitive, showCareCard, ALLOWED_PAYLOAD_KEYS } from "../public/js/model.js";

const run = (actions, s = initialState()) => actions.reduce((st, a) => {
  const r = act(st, a);
  if (r.error) throw new Error(`${a.type}: ${r.error}`);
  return r.state;
}, s);
const tryAct = (s, a) => act(s, a);

const circleReady = () => run([
  { type: "chooseRole", role: "participant" },
  { type: "choosePath", path: "circle" },
  { type: "setIntention", id: "walk" },
  { type: "setDraft", supportType: "company" },
]);
const sent = () => run([{ type: "review" }, { type: "confirmInvite", checked: true }], circleReady());
const accepted = () => { const s = sent(); return run([{ type: "openLink", token: s.circle.token }, { type: "accept" }], s); };

describe("private path", () => {
  it("never creates a circle, link or payload", () => {
    const s = run([{ type: "chooseRole", role: "participant" }, { type: "choosePath", path: "private" }, { type: "setIntention", id: "checkin" }, { type: "checkin", id: "did_it" }]);
    expect(s.circle).toBeNull();
    expect(Object.keys(s.links)).toHaveLength(0);
    expect(tryAct(s, { type: "review" }).error).toMatch(/never shared/);
    expect(supporterView(s, "anything").status).toBe("invalid");
    expect(s.events.map((e) => e.arm)).toEqual(["control", "control"]);
  });
});

describe("invite consent", () => {
  it("cannot confirm before review", () => {
    expect(tryAct(circleReady(), { type: "confirmInvite", checked: true }).error).toMatch(/Review/);
  });
  it("cannot confirm without ticking the box", () => {
    const s = run([{ type: "review" }], circleReady());
    expect(tryAct(s, { type: "confirmInvite", checked: false }).error).toMatch(/Tick/);
  });
  it("changing a field after review requires a new review", () => {
    const s = run([{ type: "review" }, { type: "setDraft", title: "A small thing I'm trying" }], circleReady());
    expect(s.circle.inviteState).toBe("draft");
    expect(tryAct(s, { type: "confirmInvite", checked: true }).error).toBeTruthy();
  });
  it("rejects free-text titles and messages", () => {
    expect(tryAct(circleReady(), { type: "setDraft", title: "My new dose plan" }).error).toBeTruthy();
    expect(tryAct(circleReady(), { type: "setDraft", messageId: "custom" }).error).toBeTruthy();
  });
  it("payload holds only allowed keys and no sensitive terms", () => {
    const s = sent();
    expect(Object.keys(s.circle.payload).sort()).toEqual([...ALLOWED_PAYLOAD_KEYS].sort());
    expect(containsSensitive(s.circle.payload)).toEqual([]);
    expect(supporterView(s, s.circle.token)).toEqual({ status: "invited", payload: buildPayload(s) });
  });
});

describe("supporter", () => {
  it("decline is final for that link and shows a kind state", () => {
    const s = run([{ type: "openLink", token: sent().circle.token }, { type: "decline" }], sent());
    expect(supporterView(s, s.supporterToken).status).toBe("declined");
    expect(tryAct(s, { type: "sendSupport", id: "join_walk" }).error).toBeTruthy();
  });
  it("only preset responses can be sent", () => {
    const s = accepted();
    expect(tryAct(s, { type: "sendSupport", id: "take_more_medicine" }).error).toMatch(/preset/);
    const s2 = run([{ type: "sendSupport", id: "join_walk" }], s);
    expect(s2.responses).toHaveLength(1);
  });
  it("supporter view never includes care interest or check-ins", () => {
    let s = run([{ type: "sendSupport", id: "join_walk" }, { type: "chooseRole", role: "participant" }, { type: "checkin", id: "did_it" }, { type: "care", choice: "explored" }], accepted());
    const v = JSON.stringify(supporterView(s, s.circle.token));
    expect(v).not.toMatch(/care|explored|did_it|Did it/i);
  });
  it("empty state with no link", () => {
    expect(supporterView(initialState(), null).status).toBe("no_link");
  });
});

describe("revoke and leave", () => {
  it("revoke removes data and invalidates the old link", () => {
    let s = run([{ type: "sendSupport", id: "join_walk" }, { type: "chooseRole", role: "participant" }, { type: "revoke" }], accepted());
    const token = Object.keys(s.links)[0];
    expect(supporterView(s, token)).toEqual({ status: "revoked" });
    expect(s.responses).toHaveLength(0);
    expect(s.circle.payload).toBeNull();
    // A new invite gets a new token; the old one stays revoked.
    s = run([{ type: "startNewInvite" }, { type: "review" }, { type: "confirmInvite", checked: true }], s);
    expect(s.circle.token).not.toBe(token);
    expect(supporterView(s, token).status).toBe("revoked");
    expect(supporterView(s, s.circle.token).status).toBe("invited");
  });
  it("leave makes the intention private again", () => {
    const s = run([{ type: "leave" }], accepted());
    expect(s.path).toBe("private");
    expect(supporterView(s, s.circle.token).status).toBe("revoked");
  });
  it("helpful marking is blocked after revoke", () => {
    const s = run([{ type: "sendSupport", id: "join_walk" }], accepted());
    const id = s.responses[0].id;
    const r = run([{ type: "revoke" }], s);
    expect(tryAct(r, { type: "markHelpful", id, helpful: true }).error).toBeTruthy();
  });
});

describe("weeks, care and reset", () => {
  it("one check-in per week across two weeks, no streak penalty", () => {
    let s = run([{ type: "chooseRole", role: "participant" }, { type: "choosePath", path: "private" }, { type: "setIntention", id: "walk" }, { type: "checkin", id: "did_it" }]);
    expect(tryAct(s, { type: "checkin", id: "did_it" }).error).toMatch(/plenty/);
    s = run([{ type: "nextWeek" }, { type: "checkin", id: "paused" }], s);
    expect(s.checkins.map((c) => c.week)).toEqual([1, 2]);
    expect(tryAct(s, { type: "nextWeek" }).error).toBeTruthy();
  });
  it("care card appears after value and skip works", () => {
    let s = run([{ type: "chooseRole", role: "curious" }, { type: "choosePath", path: "private" }, { type: "setIntention", id: "walk" }]);
    expect(showCareCard(s)).toBe(false);
    s = run([{ type: "checkin", id: "did_it" }], s);
    expect(showCareCard(s)).toBe(true);
    const skipped = run([{ type: "care", choice: "skipped" }], s);
    expect(showCareCard(skipped)).toBe(false);
    expect(skipped.events.some((e) => e.event_type === "care_info_opened")).toBe(false);
    const explored = run([{ type: "care", choice: "explored" }], s);
    expect(explored.events.at(-1)).toMatchObject({ event_type: "care_info_opened", role: "curious", source_cohort: "curious_free" });
  });
  it("reminder is a stored preference only", () => {
    const s = run([{ type: "setReminder", value: "weekly" }]);
    expect(s.reminder).toBe("weekly");
    expect(tryAct(s, { type: "setReminder", value: "push" }).error).toBeTruthy();
  });
  it("reset returns to the initial state", () => {
    expect(run([{ type: "reset" }], accepted())).toEqual(initialState());
  });
  it("event ids are unique within a session", () => {
    const s = run([{ type: "sendSupport", id: "join_walk" }, { type: "chooseRole", role: "participant" }, { type: "revoke" }], accepted());
    expect(new Set(s.events.map((e) => e.event_id)).size).toBe(s.events.length);
  });
});
