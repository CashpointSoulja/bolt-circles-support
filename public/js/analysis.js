// Experiment analysis over raw event rows. Every number shown in the analyst
// view is computed here from events, with its numerator and denominator.

export const ASSIGNMENT_SEED = "circles-w2-v1";
export const KNOWN_EVENT_TYPES = new Set([
  "household_assigned", "intent_created", "share_previewed", "demo_invite_confirmed", "invite_accepted",
  "invite_declined", "support_sent", "support_marked_helpful", "meaningful_checkin", "circle_revoked",
  "circle_left", "circle_muted", "circle_unmuted", "unwanted_share_reported", "care_info_opened", "app_opened",
]);
export const ROLES = new Set(["participant", "supporter", "curious"]);

export const THRESHOLDS = {
  unwantedShareRate: 0.02, // max unwanted-share reports per treatment household
  revocationRate: 0.2,
  unhelpfulShare: 0.3, // of rated responses
  optOutRate: 0.15,
  minPerArm: 30,
  balanceMaxGapPp: 15, // max cohort-share gap between arms, percentage points
  concentrationMax: 0.3, // max share of pooled meaningful events from the top 5% of participants
};

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const hashArm = (householdId, seed = ASSIGNMENT_SEED) => (fnv1a(`${seed}:${householdId}`) % 2 === 0 ? "control" : "treatment");

const DAY = 86400000;
const dayIndex = (iso, startIso) => Math.floor((Date.parse(iso) - Date.parse(startIso)) / DAY);

// Deduplicate and validate. Returns kept rows plus every exclusion with a reason.
export function clean(rows) {
  const seen = new Set();
  const kept = [];
  const excluded = [];
  const status = [];
  const assignedAt = new Map();
  for (const r of rows) if (r.event_type === "household_assigned" && !assignedAt.has(r.household_id)) assignedAt.set(r.household_id, r.occurred_at);
  for (const r of rows) {
    let reason = null;
    if (!r.event_id) reason = "missing event_id";
    else if (seen.has(r.event_id)) reason = "duplicate event_id";
    else if (!KNOWN_EVENT_TYPES.has(r.event_type)) reason = "unknown event_type";
    else if (!r.person_id) reason = "missing person_id";
    else if (!ROLES.has(r.role)) reason = "unknown role";
    else if (Number.isNaN(Date.parse(r.occurred_at))) reason = "invalid occurred_at";
    else if (r.role !== "curious" && !assignedAt.has(r.household_id)) reason = "household never assigned";
    else if (r.role !== "curious" && Date.parse(r.occurred_at) < Date.parse(assignedAt.get(r.household_id))) reason = "before assignment";
    if (r.event_id) seen.add(r.event_id);
    if (reason) excluded.push({ ...r, reason });
    else kept.push(r);
    status.push(reason);
  }
  return { kept, excluded, assignedAt, status };
}

const pct = (n, d) => (d ? n / d : null);

// 95% Wald interval for a difference in proportions. Crude on small samples; labelled as such.
export function diffCI(k1, n1, k0, n0) {
  if (!n1 || !n0) return { diff: null, lo: null, hi: null };
  const p1 = k1 / n1;
  const p0 = k0 / n0;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p0 * (1 - p0)) / n0);
  const diff = p1 - p0;
  return { diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se };
}

function households(kept, assignedAt) {
  const map = new Map();
  for (const r of kept) {
    if (r.event_type !== "household_assigned") continue;
    map.set(r.household_id, { id: r.household_id, arm: r.arm, cohort: r.source_cohort, assignedAt: r.occurred_at, participant: r.person_id });
  }
  return map;
}

export function analyze(rows, { cohort = "all", dataCut, seed = ASSIGNMENT_SEED } = {}) {
  const { kept, excluded, assignedAt } = clean(rows);
  const hh = households(kept, assignedAt);
  const cut = dataCut || kept.reduce((m, r) => (r.occurred_at > m ? r.occurred_at : m), "0000");
  const cohorts = [...new Set([...hh.values()].map((h) => h.cohort))].sort();

  const integrity = [...hh.values()].filter((h) => hashArm(h.id, seed) !== h.arm);
  const inCohort = (h) => cohort === "all" || h.cohort === cohort;
  const scope = [...hh.values()].filter(inCohort);
  const scopeIds = new Set(scope.map((h) => h.id));
  const ev = kept.filter((r) => scopeIds.has(r.household_id));
  const byHh = new Map();
  for (const r of ev) {
    if (!byHh.has(r.household_id)) byHh.set(r.household_id, []);
    byHh.get(r.household_id).push(r);
  }
  const rel = (h, r) => dayIndex(r.occurred_at, h.assignedAt);
  const isMeaningful = (r) => r.role === "participant" && (r.event_type === "meaningful_checkin" || (r.event_type === "support_marked_helpful" && r.helpful === true));

  const arms = { control: [], treatment: [] };
  for (const h of scope) if (arms[h.arm]) arms[h.arm].push(h);

  const metric = (name, formula, fn, armsToUse = ["control", "treatment"]) => {
    const out = { name, formula, arms: {} };
    for (const a of armsToUse) {
      const { k, n } = fn(arms[a], a);
      out.arms[a] = { k, n, p: pct(k, n) };
    }
    if (out.arms.control && out.arms.treatment) out.ci = diffCI(out.arms.treatment.k, out.arms.treatment.n, out.arms.control.k, out.arms.control.n);
    return out;
  };
  const evs = (h) => byHh.get(h.id) || [];

  const week2 = metric(
    "Week-2 meaningful active participants (primary, ITT)",
    "participants with a check-in or a response they marked helpful on days 7–13 after assignment ÷ all eligible assigned participants",
    (list) => ({ k: list.filter((h) => evs(h).some((r) => isMeaningful(r) && rel(h, r) >= 7 && rel(h, r) <= 13)).length, n: list.length }),
  );
  const activation = metric(
    "Week-1 activation",
    "participants with intent_created and a second meaningful action on a different day (session proxy) in days 0–6 ÷ all assigned participants",
    (list) => ({
      k: list.filter((h) => {
        const e = evs(h).filter((r) => r.role === "participant" && rel(h, r) <= 6);
        const intentDay = e.find((r) => r.event_type === "intent_created");
        return intentDay && e.some((r) => isMeaningful(r) && r.occurred_at.slice(0, 10) !== intentDay.occurred_at.slice(0, 10));
      }).length,
      n: list.length,
    }),
  );
  const w4eligible = (h) => dayIndex(cut, h.assignedAt) >= 27;
  const week4 = metric(
    "Week-4 retained participant (proxy, secondary)",
    "participants meaningful-active on days 21–27 ÷ assigned participants whose day 27 is before the data cut",
    (list) => {
      const elig = list.filter(w4eligible);
      return { k: elig.filter((h) => evs(h).some((r) => isMeaningful(r) && rel(h, r) >= 21 && rel(h, r) <= 27)).length, n: elig.length };
    },
  );
  const missingW4 = scope.filter((h) => !w4eligible(h)).length;

  const t = arms.treatment;
  const has = (h, type, extra = () => true) => evs(h).some((r) => r.event_type === type && extra(r));
  const confirmed = t.filter((h) => has(h, "demo_invite_confirmed"));
  const accepted = confirmed.filter((h) => has(h, "invite_accepted"));
  const helpful = accepted.filter((h) => has(h, "support_marked_helpful", (r) => r.helpful === true));
  const returned = helpful.filter((h) => evs(h).some((r) => isMeaningful(r) && rel(h, r) >= 7 && rel(h, r) <= 13));
  const loop = [
    { step: "Treatment households offered a circle", k: t.length, n: t.length },
    { step: "Confirmed a reviewed demo invite", k: confirmed.length, n: t.length },
    { step: "Supporter accepted", k: accepted.length, n: confirmed.length },
    { step: "Participant marked a response helpful", k: helpful.length, n: accepted.length },
    { step: "Participant meaningful-active in week 2", k: returned.length, n: helpful.length },
  ].map((x) => ({ ...x, p: pct(x.k, x.n) }));

  // Weekly active by role, never pooled.
  const wau = [];
  for (const [label, lo, hi] of [["Week 1", 0, 6], ["Week 2", 7, 13]]) {
    const row = { week: label };
    for (const role of ["participant", "supporter"]) {
      const people = new Set();
      for (const h of scope) for (const r of evs(h)) {
        const d = rel(h, r);
        if (d < lo || d > hi || r.role !== role) continue;
        if (role === "participant" ? isMeaningful(r) : r.event_type === "support_sent") people.add(r.person_id);
      }
      row[role] = people.size;
    }
    wau.push(row);
  }

  // Curious free users: interest in care information. Not a conversion.
  const curious = kept.filter((r) => r.role === "curious");
  const curiousPeople = new Set(curious.map((r) => r.person_id));
  const careOpen = new Set(curious.filter((r) => r.event_type === "care_info_opened").map((r) => r.person_id));
  const careInterest = { k: careOpen.size, n: curiousPeople.size, p: pct(careOpen.size, curiousPeople.size) };

  // Guardrails (treatment arm, where sharing exists).
  const countHh = (type, extra) => t.filter((h) => has(h, type, extra)).length;
  const rated = t.flatMap((h) => evs(h).filter((r) => r.event_type === "support_marked_helpful"));
  const g = (name, k, n, max, note) => ({ name, k, n, p: pct(k, n), max, pass: n === 0 ? true : k / n <= max, note });
  const guardrails = [
    g("Unwanted-share reports", countHh("unwanted_share_reported"), t.length, THRESHOLDS.unwantedShareRate, "households reporting something was shared they didn't want"),
    g("Revocations", countHh("circle_revoked"), confirmed.length, THRESHOLDS.revocationRate, "of households that sent a demo invite"),
    g("Unhelpful responses", rated.filter((r) => r.helpful === false).length, rated.length, THRESHOLDS.unhelpfulShare, "of rated responses"),
    g("Opt-outs (left Circles)", countHh("circle_left"), t.length, THRESHOLDS.optOutRate, "of treatment households"),
  ];

  // Confounding and data-quality checks. Computed on the full (unfiltered) assigned set.
  const all = [...hh.values()];
  const allArms = { control: all.filter((h) => h.arm === "control"), treatment: all.filter((h) => h.arm === "treatment") };
  const mix = cohorts.map((c) => {
    const sc = pct(allArms.control.filter((h) => h.cohort === c).length, allArms.control.length) ?? 0;
    const st = pct(allArms.treatment.filter((h) => h.cohort === c).length, allArms.treatment.length) ?? 0;
    return { cohort: c, control: sc, treatment: st, gapPp: Math.abs(st - sc) * 100 };
  });
  const maxGap = mix.reduce((m, x) => Math.max(m, x.gapPp), 0);

  const perCohort = cohorts.map((c) => {
    const sub = analyzePrimaryFor(all.filter((h) => h.cohort === c), byHhAll(kept), rel, isMeaningful);
    return { cohort: c, ...sub };
  });
  const pooled = analyzePrimaryFor(all, byHhAll(kept), rel, isMeaningful);
  const comparable = perCohort.filter((x) => x.control.n >= 5 && x.treatment.n >= 5);
  const reversal = pooled.diff > 0 && comparable.length > 0 && comparable.every((x) => x.diff <= 0);

  const meaningfulByPerson = new Map();
  for (const r of kept) if (isMeaningful(r)) meaningfulByPerson.set(r.person_id, (meaningfulByPerson.get(r.person_id) || 0) + 1);
  const counts = [...meaningfulByPerson.values()].sort((a, b) => b - a);
  const totalMeaningful = counts.reduce((a, b) => a + b, 0);
  const topN = Math.max(1, Math.ceil(all.length * 0.05));
  const topShare = totalMeaningful ? counts.slice(0, topN).reduce((a, b) => a + b, 0) / totalMeaningful : 0;
  const pooledEventsPer = {
    control: pct(sumMeaningful(kept, allArms.control, isMeaningful), allArms.control.length),
    treatment: pct(sumMeaningful(kept, allArms.treatment, isMeaningful), allArms.treatment.length),
  };

  const checks = [
    { id: "integrity", name: "Assignment integrity", pass: integrity.length === 0, detail: `${integrity.length} of ${all.length} households have a stored arm that doesn't match hash("${seed}:household_id") mod 2.` },
    { id: "balance", name: "Acquisition-mix balance", pass: maxGap <= THRESHOLDS.balanceMaxGapPp, detail: `Largest cohort-share gap between arms: ${maxGap.toFixed(1)} pp (rule: ≤ ${THRESHOLDS.balanceMaxGapPp} pp).` },
    { id: "reversal", name: "Pooled vs within-cohort direction", pass: !reversal, detail: reversal ? "Pooled result favours treatment, but every comparable cohort favours control (Simpson's reversal)." : "Within-cohort effects point the same way as (or don't contradict) the pooled effect." },
    { id: "concentration", name: "Repeat-user concentration", pass: topShare <= THRESHOLDS.concentrationMax, detail: `Top 5% of people (${topN}) produce ${(topShare * 100).toFixed(0)}% of pooled meaningful events (rule: ≤ ${THRESHOLDS.concentrationMax * 100}%). Primary metric counts people, not events.` },
    { id: "sample", name: "Sample size", pass: allArms.control.length >= THRESHOLDS.minPerArm && allArms.treatment.length >= THRESHOLDS.minPerArm, detail: `${allArms.control.length} control / ${allArms.treatment.length} treatment households (rule: ≥ ${THRESHOLDS.minPerArm} per arm to read anything).` },
  ];

  const decision = decide({ guardrails, checks, pooled, perCohort });
  const dates = kept.map((r) => r.occurred_at).sort();

  return {
    cohort, cohorts, seed, dataCut: cut,
    window: { from: dates[0] || null, to: dates[dates.length - 1] || null },
    raw: rows.length, kept: kept.length, excluded,
    exclusionsByReason: tally(excluded.map((e) => e.reason)),
    households: { total: all.length, control: allArms.control.length, treatment: allArms.treatment.length, inScope: { control: arms.control.length, treatment: arms.treatment.length } },
    metrics: { week2, activation, week4 }, missingW4, loop, wau, careInterest, guardrails, checks, mix, perCohort, pooled, pooledEventsPer, topShare, decision,
  };
}

function byHhAll(kept) {
  const m = new Map();
  for (const r of kept) {
    if (!m.has(r.household_id)) m.set(r.household_id, []);
    m.get(r.household_id).push(r);
  }
  return m;
}

function analyzePrimaryFor(list, byHh, rel, isMeaningful) {
  const out = {};
  for (const a of ["control", "treatment"]) {
    const l = list.filter((h) => h.arm === a);
    const k = l.filter((h) => (byHh.get(h.id) || []).some((r) => isMeaningful(r) && rel(h, r) >= 7 && rel(h, r) <= 13)).length;
    out[a] = { k, n: l.length, p: pct(k, l.length) };
  }
  const ci = diffCI(out.treatment.k, out.treatment.n, out.control.k, out.control.n);
  return { ...out, diff: ci.diff, lo: ci.lo, hi: ci.hi };
}

function sumMeaningful(kept, list, isMeaningful) {
  const ids = new Set(list.map((h) => h.id));
  return kept.filter((r) => ids.has(r.household_id) && isMeaningful(r)).length;
}

const tally = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});

export function decide({ guardrails, checks, pooled, perCohort }) {
  const failedG = guardrails.filter((g) => !g.pass);
  const failedC = checks.filter((c) => !c.pass);
  if (failedG.length) return { verdict: "stop/redesign", reasons: failedG.map((g) => `Guardrail failed: ${g.name}.`) };
  if (failedC.length) return { verdict: "hold for more evidence", reasons: failedC.map((c) => `${c.name} check failed. ${c.detail}`) };
  const comparable = perCohort.filter((x) => x.control.n >= 10 && x.treatment.n >= 10);
  if (pooled.diff > 0 && comparable.every((x) => x.diff > 0)) {
    const reasons = [`Primary difference ${(pooled.diff * 100).toFixed(1)} pp, positive in every cohort with ≥ 10 per arm.`, "All guardrails and checks pass."];
    if (pooled.lo <= 0) reasons.push("The 95% interval still includes zero, so this justifies a larger limited test, not a launch.");
    return { verdict: "continue limited test", reasons };
  }
  return { verdict: "stop/redesign", reasons: ["No consistent benefit on the primary metric."] };
}

// ---------- Exports ----------
const fmtP = (p) => (p === null || p === undefined ? "n/a" : `${(p * 100).toFixed(1)}%`);
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const EVENT_COLUMNS = ["event_id", "person_id", "household_id", "role", "arm", "occurred_at", "event_type", "invite_id", "helpful", "source_cohort"];

export function eventsCsv(rows, { validate = true } = {}) {
  const status = validate ? clean(rows).status : rows.map(() => null);
  const lines = [[...EVENT_COLUMNS, "status", "exclusion_reason"].join(",")];
  rows.forEach((r, i) => lines.push([...EVENT_COLUMNS.map((c) => csvCell(r[c])), status[i] ? "excluded" : "included", csvCell(status[i] || "")].join(",")));
  return lines.join("\n") + "\n";
}

export function metricsCsv(a) {
  const lines = ["metric,cohort,arm,numerator,denominator,value"];
  for (const m of Object.values(a.metrics)) for (const [arm, v] of Object.entries(m.arms)) lines.push([csvCell(m.name), a.cohort, arm, v.k, v.n, v.p === null ? "" : v.p.toFixed(4)].join(","));
  for (const s of a.loop) lines.push([csvCell(`Support loop: ${s.step}`), a.cohort, "treatment", s.k, s.n, s.p === null ? "" : s.p.toFixed(4)].join(","));
  for (const g of a.guardrails) lines.push([csvCell(`Guardrail: ${g.name}`), a.cohort, "treatment", g.k, g.n, g.p === null ? "" : g.p.toFixed(4)].join(","));
  lines.push([csvCell("Curious free users who opened care information (interest, not conversion)"), "curious_free", "n/a", a.careInterest.k, a.careInterest.n, a.careInterest.p === null ? "" : a.careInterest.p.toFixed(4)].join(","));
  lines.push(["raw_events", a.cohort, "", a.raw, "", ""].join(","));
  lines.push(["excluded_events", a.cohort, "", a.excluded.length, a.raw, ""].join(","));
  return lines.join("\n") + "\n";
}

export const HYPOTHESIS = "One chosen supporter, one shared nonclinical intention and one low-pressure response will increase second-week meaningful activity relative to a private intention alone, without increasing unwanted sharing or distress.";

export function decisionMarkdown(a, datasetLabel) {
  const w = a.metrics.week2;
  const L = [];
  L.push(`# Decision record: ${datasetLabel}`);
  L.push("");
  L.push("> Independent product prototype - synthetic demo. Not Bolt Pharmacy or AIOS data. No real users.");
  L.push("");
  L.push(`**Decision: ${a.decision.verdict}**`);
  L.push("");
  for (const r of a.decision.reasons) L.push(`- ${r}`);
  L.push("");
  L.push("## Hypothesis");
  L.push(HYPOTHESIS);
  L.push("");
  L.push("## Scope");
  L.push(`- Cohort filter: ${a.cohort}`);
  L.push(`- Event window: ${a.window.from} to ${a.window.to}; data cut ${a.dataCut}`);
  L.push(`- Assignment: household-level, arm = hash("${a.seed}:household_id") mod 2 (FNV-1a), 0 = control (private intention + check-in), 1 = treatment (optional circle invitation + support).`);
  L.push(`- Households: ${a.households.control} control / ${a.households.treatment} treatment (in this cohort: ${a.households.inScope.control} / ${a.households.inScope.treatment}).`);
  L.push(`- Raw events: ${a.raw}; excluded: ${a.excluded.length} (${Object.entries(a.exclusionsByReason).map(([k, v]) => `${k}: ${v}`).join("; ") || "none"}).`);
  L.push("");
  L.push("## Metrics");
  L.push("| Metric | Formula | Control | Treatment | Difference (95% CI) |");
  L.push("| --- | --- | --- | --- | --- |");
  for (const m of Object.values(a.metrics)) {
    const c = m.arms.control, t = m.arms.treatment;
    const ci = m.ci && m.ci.diff !== null ? `${(m.ci.diff * 100).toFixed(1)} pp (${(m.ci.lo * 100).toFixed(1)} to ${(m.ci.hi * 100).toFixed(1)})` : "n/a";
    L.push(`| ${m.name} | ${m.formula} | ${c.k}/${c.n} = ${fmtP(c.p)} | ${t.k}/${t.n} = ${fmtP(t.p)} | ${ci} |`);
  }
  L.push("");
  L.push(`Missing observations: ${a.missingW4} in-scope households were assigned too recently to observe week 4.`);
  L.push("");
  L.push("### Support loop (treatment)");
  for (const s of a.loop) L.push(`- ${s.step}: ${s.k}/${s.n} = ${fmtP(s.p)}`);
  L.push("");
  L.push("### Weekly active, by role (never pooled)");
  for (const r of a.wau) L.push(`- ${r.week}: ${r.participant} participants, ${r.supporter} supporters`);
  L.push("");
  L.push(`### Curious free users: care information interest`);
  L.push(`- ${a.careInterest.k}/${a.careInterest.n} = ${fmtP(a.careInterest.p)} opened "Explore clinician-led care". This is interest in information, not paid conversion or a health outcome. Real freemium-to-patient conversion is unavailable in this prototype.`);
  L.push("");
  L.push("## Guardrails (illustrative test rules, not medical standards)");
  for (const g of a.guardrails) L.push(`- ${g.pass ? "PASS" : "FAIL"} ${g.name}: ${g.k}/${g.n} = ${fmtP(g.p)} (max ${(g.max * 100).toFixed(0)}%), ${g.note}`);
  L.push("");
  L.push("## Confounding and data-quality checks");
  for (const c of a.checks) L.push(`- ${c.pass ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
  L.push("");
  L.push("### Within-cohort primary metric");
  for (const x of a.perCohort) L.push(`- ${x.cohort}: control ${x.control.k}/${x.control.n} = ${fmtP(x.control.p)}, treatment ${x.treatment.k}/${x.treatment.n} = ${fmtP(x.treatment.p)}, difference ${x.diff === null ? "n/a" : `${(x.diff * 100).toFixed(1)} pp`}`);
  L.push(`- Pooled: ${a.pooled.diff === null ? "n/a" : `${(a.pooled.diff * 100).toFixed(1)} pp`}`);
  L.push("");
  L.push("## Uncertainty caveat");
  L.push("Intervals are 95% Wald intervals on a difference in proportions. They are rough at these sample sizes. The data is synthetic and was constructed to illustrate the analysis, so no effect here says anything about real people. No clinical effectiveness can be inferred.");
  L.push("");
  L.push("## Next research question");
  L.push(a.decision.verdict === "continue limited test"
    ? "Does the week-2 difference hold in a larger, pre-registered limited test, and do participants understand exactly what their supporter can see (preview comprehension)?"
    : "Why did the arms differ in who they enrolled, and can a clean re-randomised test show a within-cohort benefit without more unwanted sharing?");
  L.push("");
  return L.join("\n");
}
