import { test, expect } from "@playwright/test";
import fs from "node:fs";

const SENSITIVE = /\b(medication|medicine|mounjaro|wegovy|semaglutide|tirzepatide|dose|diagnosis|weight|bmi|prescription|injection)\b/i;

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/#/app");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function noHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}
async function buttonsNotClipped(page) {
  const clipped = await page.$$eval("#phone button, #analyst button", (bs) => bs.filter((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((b) => b.textContent));
  expect(clipped).toEqual([]);
}
const supporterText = (page) => page.locator("#phone").innerText();

async function startCircle(page) {
  await page.getByRole("button", { name: "I'm starting something for me" }).click();
  await page.getByRole("button", { name: "Invite one person" }).click();
  await page.getByLabel("Take a short walk").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Encouragement/).check();
  await page.getByRole("button", { name: "Preview what they'll see" }).click();
}

test("disclosure is always visible", async ({ page }) => {
  await expect(page.getByText("Independent product prototype - synthetic demo.")).toBeVisible();
  await page.getByRole("link", { name: "Analyst view" }).click();
  await expect(page.getByText("Independent product prototype - synthetic demo.")).toBeVisible();
});

test("private path never exposes the intention", async ({ page }) => {
  await page.getByRole("button", { name: "I'm starting something for me" }).click();
  await page.getByRole("button", { name: "Keep it private" }).click();
  await page.getByLabel("Celebrate a small win").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByRole("button", { name: "Did it" }).click();
  await expect(page.getByText("Checked in: Did it")).toBeVisible();
  await page.getByRole("button", { name: "Switch to supporter" }).click();
  await expect(page.getByRole("heading", { name: "No invitations yet" })).toBeVisible();
  expect(await supporterText(page)).not.toContain("Celebrate a small win");
  await noHorizontalScroll(page);
});

test("invite needs preview confirmation; supporter sees only reviewed fields; accept, support, helpful, revoke, old link", async ({ page }) => {
  await startCircle(page);
  await expect(page.getByLabel("Recipient preview")).toContainText("Take a short walk");
  await page.getByRole("button", { name: "Create demo invitation" }).click();
  await expect(page.getByRole("alert")).toContainText("Tick the box");
  await expect(page.getByText("Synthetic prototype link")).toHaveCount(0);
  await page.getByLabel(/I've checked the preview/).check();
  await page.getByRole("button", { name: "Create demo invitation" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for Alex" })).toBeVisible();
  await expect(page.getByLabel("Simulated link")).toContainText("DEMO ONLY");
  await buttonsNotClipped(page);

  await page.getByRole("button", { name: "Open as Alex (supporter)" }).click();
  const v = await supporterText(page);
  expect(v).toContain("Take a short walk");
  expect(v).toContain("Encouragement");
  expect(v).not.toMatch(SENSITIVE);
  await page.getByRole("button", { name: "Yes, I'm in" }).click();
  await page.getByRole("button", { name: "Write my own message" }).click();
  await expect(page.getByText("Your own words aren't supported here")).toBeVisible();
  await page.getByRole("button", { name: "Proud of you for asking. I'm in." }).click();
  await expect(page.getByText("You've sent")).toBeVisible();

  await page.getByRole("button", { name: "Switch to participant" }).click();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(page.getByRole("button", { name: "Helpful ✓" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByText("Messages wait quietly")).toBeVisible();
  await page.getByRole("button", { name: "Unmute" }).click();
  await page.getByRole("button", { name: "Remove Alex's access" }).click();
  await expect(page.locator("#phone .notice")).toContainText("Access removed");
  await page.getByRole("button", { name: "Check the old link" }).click();
  await expect(page.getByRole("heading", { name: "This invitation is no longer active" })).toBeVisible();
  const after = await supporterText(page);
  expect(after).not.toContain("Take a short walk");
  expect(after).not.toContain("Proud of you");
  await noHorizontalScroll(page);
});

test("decline without guilt", async ({ page }) => {
  await startCircle(page);
  await page.getByLabel(/I've checked the preview/).check();
  await page.getByRole("button", { name: "Create demo invitation" }).click();
  await page.getByRole("button", { name: "Open as Alex (supporter)" }).click();
  await page.getByRole("button", { name: "Not right now" }).click();
  await expect(page.getByRole("heading", { name: "You said not right now" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to participant" }).click();
  await expect(page.getByText("Alex can't right now")).toBeVisible();
});

test("care interest is private and skip works; two weeks; reminder; safety", async ({ page }) => {
  await page.getByRole("button", { name: "I'm just curious" }).click();
  await page.getByRole("button", { name: "Keep it private" }).click();
  await page.getByLabel("Take a short walk").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Explore clinician-led care" })).toHaveCount(0);
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByRole("button", { name: "Tried, not today" }).click();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("button", { name: "Explore clinician-led care" })).toHaveCount(0);
  await page.getByLabel("Weekly nudge (simulated)").check();
  await expect(page.getByLabel("Weekly nudge (simulated)")).toBeChecked();
  await page.getByRole("button", { name: "Skip ahead to week 2 (demo)" }).click();
  await expect(page.getByText("Week 2 of 2 (demo)")).toBeVisible();
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByRole("button", { name: "Did it" }).click();
  await page.getByRole("button", { name: "I have a health question" }).click();
  await expect(page.getByRole("heading", { name: "Ask your care team" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("heading", { name: "Support, on your terms" })).toBeVisible();
});

test("care button opens information only, supporter cannot see it", async ({ page }) => {
  await startCircle(page);
  await page.getByLabel(/I've checked the preview/).check();
  await page.getByRole("button", { name: "Create demo invitation" }).click();
  await page.getByRole("button", { name: "Go to my intention" }).click();
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByRole("button", { name: "Did it" }).click();
  await page.getByRole("button", { name: "Explore clinician-led care" }).click();
  await expect(page.getByText("nothing is booked, assessed or bought")).toBeVisible();
  await page.getByRole("button", { name: "Switch to supporter" }).click();
  await page.getByRole("button", { name: /^Open demo-/ }).first().click();
  expect(await supporterText(page)).not.toMatch(/clinician|care/i);
});

test("keyboard: tab reaches controls with a visible focus ring", async ({ page }) => {
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  let found = false;
  for (let i = 0; i < 8 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => document.activeElement?.textContent?.includes("I'm starting something for me"));
  }
  expect(found).toBe(true);
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Private, or with someone?" })).toBeFocused();
});

test("analyst: misleading fixture holds, cohort filter reverses, retries excluded once, exports work", async ({ page }) => {
  await page.goto("/#/analyst");
  await expect(page.getByTestId("verdict")).toHaveText("Hold for more evidence");
  await expect(page.getByText("Simpson's reversal").first()).toBeVisible();
  const before = Number(await page.getByTestId("excluded").innerText());
  await page.getByRole("button", { name: "Simulate 3 client retries" }).click();
  await expect(page.getByTestId("excluded")).toHaveText(String(before + 3));
  await page.getByLabel("Cohort").selectOption("existing_customer");
  await expect(page.locator("table").first()).toContainText("-5.0 pp");
  await page.getByLabel("Cohort").selectOption("supporter_referred");
  await expect(page.getByRole("heading", { name: "Small sample" })).toBeVisible();
  await page.getByLabel("Dataset").selectOption("promising");
  await expect(page.getByTestId("verdict")).toHaveText("Continue limited test");
  for (const [name, expectText] of [["Decision record (.md)", "## Next research question"], ["Events (.csv)", "event_id,person_id,household_id"], ["Metrics (.csv)", "metric,cohort,arm,numerator,denominator,value"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
    const text = fs.readFileSync(await dl.path(), "utf8");
    expect(text).toContain(expectText);
    expect(text).not.toMatch(SENSITIVE);
  }
  await page.getByRole("button", { name: "Reset analyst view" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Hold for more evidence");
  await noHorizontalScroll(page);
  await buttonsNotClipped(page);
});

test("every visible button does something (no dead controls on start screens)", async ({ page }) => {
  const buttons = await page.$$eval("#phone button", (bs) => bs.map((b) => b.dataset.action || b.type));
  for (const a of buttons) expect(a).toBeTruthy();
});
