import { describe, it, expect } from "vitest";
import { analyze, clean, eventsCsv, metricsCsv, decisionMarkdown, hashArm, EVENT_COLUMNS } from "../public/js/analysis.js";
import { buildFixture } from "../public/js/fixtures.js";
import { containsSensitive } from "../public/js/model.js";

const A = buildFixture("promising");
const B = buildFixture("misleading");
const run = (fx, opts = {}) => analyze(fx.rows, { dataCut: fx.dataCut, ...opts });

describe("fixtures", () => {
  it("contain only schema fields and no clinical data", () => {
    for (const fx of [A, B]) {
      for (const r of fx.rows) expect(Object.keys(r).sort()).toEqual([...EVENT_COLUMNS].sort());
      expect(containsSensitive(fx.rows, ["treatment"])).toEqual([]);
      const nonArm = fx.rows.map(({ arm, ...rest }) => rest);
      expect(containsSensitive(nonArm)).toEqual([]);
    }
  });
  it("are deterministic", () => {
    expect(buildFixture("promising").rows).toEqual(A.rows);
  });
});

describe("cleaning", () => {
  it("excludes each duplicate exactly once and lists invalid rows", () => {
    const { excluded } = clean(A.rows);
    const dups = excluded.filter((e) => e.reason === "duplicate event_id");
    expect(dups).toHaveLength(6);
    expect(new Set(dups.map((d) => d.event_id)).size).toBe(6);
    expect(excluded.map((e) => e.reason)).toEqual(expect.arrayContaining(["unknown event_type", "household never assigned", "before assignment", "missing person_id"]));
  });
  it("re-delivered rows change exclusions but not metrics", () => {
    const base = run(A);
    const extra = A.rows.filter((r) => r.event_type === "support_marked_helpful").slice(0, 5).map((r) => ({ ...r }));
    const again = analyze([...A.rows, ...extra], { dataCut: A.dataCut });
    expect(again.excluded.length).toBe(base.excluded.length + 5);
    expect(again.metrics).toEqual(base.metrics);
    expect(again.decision).toEqual(base.decision);
  });
});

describe("assignment", () => {
  it("is a stable household hash", () => {
    expect(hashArm("H-A0001")).toBe(hashArm("H-A0001"));
    const { kept } = clean(A.rows);
    for (const r of kept.filter((x) => x.event_type === "household_assigned")) expect(r.arm).toBe(hashArm(r.household_id));
  });
  it("supporters share their household arm", () => {
    const arms = new Map();
    for (const r of clean(A.rows).kept) {
      if (r.role === "curious") continue;
      if (!arms.has(r.household_id)) arms.set(r.household_id, new Set());
      arms.get(r.household_id).add(r.arm);
    }
    for (const s of arms.values()) expect(s.size).toBe(1);
  });
});

describe("metrics", () => {
  it("primary metric is ITT over all assigned participants", () => {
    const a = run(A);
    expect(a.metrics.week2.arms.control).toMatchObject({ k: 22, n: 75 });
    expect(a.metrics.week2.arms.treatment).toMatchObject({ k: 32, n: 75 });
  });
  it("app opens do not count as meaningful", () => {
    const opens = A.rows.filter((r) => r.event_type === "household_assigned").slice(0, 20).map((r, i) => ({ ...r, event_id: `OPEN-${i}`, event_type: "app_opened", occurred_at: new Date(Date.parse(r.occurred_at) + 9 * 864e5).toISOString() }));
    expect(analyze([...A.rows, ...opens], { dataCut: A.dataCut }).metrics.week2).toEqual(run(A).metrics.week2);
  });
  it("support loop denominators chain", () => {
    const l = run(A).loop;
    for (let i = 2; i < l.length; i++) expect(l[i].n).toBe(l[i - 1].k);
  });
  it("participant and supporter WAU are separate", () => {
    const w = run(A).wau[0];
    expect(w).toHaveProperty("participant");
    expect(w).toHaveProperty("supporter");
    expect(w.participant).toBeLessThanOrEqual(150);
  });
  it("cohort filter changes denominators", () => {
    expect(run(A, { cohort: "supporter_referred" }).metrics.week2.arms.control.n).toBe(15);
  });
});

describe("decisions", () => {
  it("promising fixture: continue limited test, never launch", () => {
    const a = run(A);
    expect(a.decision.verdict).toBe("continue limited test");
    expect(a.guardrails.every((g) => g.pass)).toBe(true);
  });
  it("misleading fixture: pooled looks positive but checks fail, so hold", () => {
    const a = run(B);
    expect(a.pooled.diff).toBeGreaterThan(0);
    expect(a.perCohort.every((c) => c.diff < 0)).toBe(true);
    const failed = a.checks.filter((c) => !c.pass).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["balance", "reversal", "concentration"]));
    expect(a.decision.verdict).toBe("hold for more evidence");
    expect(a.decision.verdict).not.toMatch(/launch|winner/i);
  });
  it("cohort filter reverses the apparent benefit", () => {
    expect(run(B).metrics.week2.ci.diff).toBeGreaterThan(0);
    for (const c of ["existing_customer", "free_signup", "supporter_referred"]) expect(run(B, { cohort: c }).metrics.week2.ci.diff).toBeLessThan(0);
  });
  it("a failed guardrail forces stop/redesign", () => {
    const t = clean(A.rows).kept.filter((r) => r.event_type === "household_assigned" && r.arm === "treatment").slice(0, 10);
    const reports = t.map((r, i) => ({ ...r, event_id: `U-${i}`, event_type: "unwanted_share_reported", occurred_at: new Date(Date.parse(r.occurred_at) + 864e5).toISOString() }));
    expect(analyze([...A.rows, ...reports], { dataCut: A.dataCut }).decision.verdict).toBe("stop/redesign");
  });
});

describe("exports", () => {
  it("events CSV keeps every raw row with status", () => {
    const csv = eventsCsv(A.rows).trim().split("\n");
    expect(csv).toHaveLength(A.rows.length + 1);
    expect(csv[0]).toBe([...EVENT_COLUMNS, "status", "exclusion_reason"].join(","));
    expect(csv.filter((l) => l.includes(",excluded,duplicate event_id"))).toHaveLength(6);
  });
  it("metrics CSV reproduces denominators", () => {
    const a = run(A);
    const csv = metricsCsv(a);
    expect(csv).toContain(`,all,control,22,75,`);
    expect(csv).toContain(`excluded_events,all,,${a.excluded.length},${a.raw},`);
  });
  it("decision markdown has every required section", () => {
    const md = decisionMarkdown(run(B), "B");
    for (const s of ["## Hypothesis", "Cohort filter", "Assignment:", "## Metrics", "Raw events", "excluded", "## Guardrails", "## Uncertainty caveat", "## Next research question", "hold for more evidence", "not paid conversion"]) expect(md).toContain(s);
    expect(containsSensitive(md, ["treatment"])).toEqual([]);
  });
});
