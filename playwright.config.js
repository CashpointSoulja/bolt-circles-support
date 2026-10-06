import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4174" },
  webServer: { command: "PORT=4174 node scripts/serve.mjs", url: "http://localhost:4174", reuseExistingServer: false },
  projects: [
    { name: "phone-390x844", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop-1440x900", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
});
