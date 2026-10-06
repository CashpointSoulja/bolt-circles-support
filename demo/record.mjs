// Records the vertical walkthrough from the locally running app, then lays the
// narration clips over it at the times each scene started.
// Usage: npm run serve (in another shell), then: node demo/record.mjs
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "demo/support-on-your-terms-walkthrough.mp4";
const narration = JSON.parse(fs.readFileSync("demo/narration.json", "utf8"));
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
for (const n of narration) n.seconds = dur(`demo/audio/${n.id}.mp3`);

fs.mkdirSync("demo/build", { recursive: true });
const browser = await chromium.launch();
// 405 × 720 CSS px at 2x gives sharp 810 × 1440 frames, scaled to 1080 × 1920.
const context = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2 });
// Show where taps land, since the recording has no cursor.
await context.addInitScript(() => {
  addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(0,94,227,.28);border:2px solid #005ee3;pointer-events:none;z-index:99;transition:transform .45s,opacity .45s`;
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = "scale(1.5)"; d.style.opacity = "0"; });
    setTimeout(() => d.remove(), 500);
  }, true);
});
const page = await context.newPage();
const t0 = Date.now();
await page.goto(`${BASE}/#/app`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
await page.waitForTimeout(300);
// Nudge a repaint so the first frame exists.
await page.evaluate(() => window.scrollBy(0, 1));
await page.evaluate(() => window.scrollBy(0, -1));
await page.waitForTimeout(200);
const videoStart = (Date.now() - t0) / 1000;
const epochStart = Date.now() / 1000;

const pause = (ms) => page.waitForTimeout(ms);
const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); await pause(250); await loc.click(); await pause(450); };
const btn = (name, exact = false) => page.getByRole("button", { name, exact });
const scrollTo = async (loc, block = "start") => { await loc.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block); await pause(700); };
const scrollBy = async (y) => { await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "smooth" }), y); await pause(700); };

const scenes = {
  "01-intro": async () => { await pause(1500); await scrollBy(220); },
  "02-private": async () => {
    await tap(btn("I'm starting something for me"));
    await tap(btn("Keep it private", true));
    await tap(page.getByLabel("Take a short walk"));
    await tap(btn("Continue"));
    await tap(btn("Check in", true));
    await tap(btn("Did it"));
  },
  "03-circle": async () => {
    await tap(btn("Invite one person"));
    await tap(page.getByLabel(/Practical company/));
    await scrollTo(page.getByText("Invitation title"), "center");
    await pause(600);
    await tap(btn("Preview what they'll see"));
    await pause(1600);
    await scrollTo(page.getByText("Never shared"), "center");
  },
  "04-confirm": async () => {
    await tap(btn("Create demo invitation"));
    await pause(900);
    await tap(page.getByLabel(/I've checked the preview/));
    await tap(btn("Create demo invitation"));
  },
  "05-supporter": async () => {
    await tap(btn("Open as Alex (supporter)"));
    await pause(1800);
    await tap(btn("Yes, I'm in"));
    await tap(btn(/Happy to come along/));
    await pause(500);
    await tap(btn("Write my own message"));
    await scrollTo(page.getByText("Your own words aren't supported here"), "center");
    await pause(1200);
    await scrollTo(btn("They asked me a health question"), "center");
  },
  "06-revoke": async () => {
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await tap(btn("Switch to participant"));
    await tap(btn("Helpful", true));
    await tap(btn("Remove Alex's access"));
    await pause(700);
    await tap(btn("Check the old link"));
  },
  "07-analyst": async () => {
    await page.evaluate(() => { location.hash = "#/analyst"; window.scrollTo({ top: 0 }); });
    await pause(2200);
    await scrollTo(page.getByRole("heading", { name: "Participant metrics (intention-to-treat)" }));
    await pause(1800);
    await scrollTo(page.getByRole("heading", { name: "Primary metric within each cohort" }));
  },
  "08-hold": async () => {
    await pause(2200);
    await scrollTo(page.getByLabel("Cohort"), "center");
    await page.getByLabel("Cohort").selectOption("existing_customer");
    await pause(600);
    await scrollTo(page.getByRole("heading", { name: "Participant metrics (intention-to-treat)" }));
    await pause(2000);
    await page.getByLabel("Cohort").selectOption("all");
    await scrollTo(page.locator(".card.hold"), "start");
  },
  "09-close": async () => { await pause(1000); },
};

const marks = [];
for (const n of narration) {
  const start = (Date.now() - t0) / 1000;
  marks.push({ id: n.id, at: start - videoStart, seconds: n.seconds });
  await scenes[n.id]();
  const left = n.seconds + 0.45 - ((Date.now() - t0) / 1000 - start);
  if (left > 0) await pause(left * 1000);
}
await pause(800);
const total = (Date.now() - t0) / 1000 - videoStart;
await cdp.send("Page.stopScreencast");
await context.close();
await browser.close();

// Turn the change-driven screencast into a constant-rate frame list.
fs.rmSync("demo/build/frames", { recursive: true, force: true });
fs.mkdirSync("demo/build/frames", { recursive: true });
const list = [];
frames.forEach((f, i) => {
  const file = `demo/build/frames/${String(i).padStart(5, "0")}.jpg`;
  fs.writeFileSync(file, Buffer.from(f.data, "base64"));
  const next = i + 1 < frames.length ? frames[i + 1].t : epochStart + total;
  const startT = Math.max(f.t, epochStart);
  const d = Math.max(0, next - startT);
  if (next > epochStart && d > 0) list.push(`file '${file.replace("demo/build/", "")}'\nduration ${d.toFixed(4)}`);
});
const lastFrame = frames.filter((f) => f.t < epochStart + total).at(-1);
list.push(`file 'frames/${String(frames.indexOf(lastFrame)).padStart(5, "0")}.jpg'`);
fs.writeFileSync("demo/build/frames.txt", list.join("\n") + "\n");

const inputs = ["-f", "concat", "-safe", "0", "-i", "demo/build/frames.txt"];
const filters = [];
narration.forEach((n, i) => {
  inputs.push("-i", `demo/audio/${n.id}.mp3`);
  filters.push(`[${i + 1}:a]adelay=${Math.round(marks[i].at * 1000)}|${Math.round(marks[i].at * 1000)}[a${i}]`);
});
filters.push(`${narration.map((_, i) => `[a${i}]`).join("")}amix=inputs=${narration.length}:normalize=0[aout]`);
execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-t", total.toFixed(2), "-vf", "scale=1080:1920:flags=lanczos,fps=30",
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
  "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-bsf:v", "filter_units=remove_types=6",
  "-movflags", "+faststart", OUT], { stdio: "inherit" });

const srt = marks.map((m, i) => {
  const ts = (s) => new Date(s * 1000).toISOString().slice(11, 23).replace(".", ",");
  return `${i + 1}\n${ts(m.at)} --> ${ts(m.at + m.seconds)}\n${narration[i].text}\n`;
}).join("\n");
fs.writeFileSync("demo/support-on-your-terms-walkthrough.srt", srt);
fs.writeFileSync("demo/timeline.json", JSON.stringify({ total, marks }, null, 2) + "\n");
console.log(`Wrote ${OUT} (${total.toFixed(1)} s)`);
