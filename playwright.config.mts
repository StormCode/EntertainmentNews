import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3311);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * E2E 設定（2026-09-15 工程審查 D9）。
 *
 * ⚠️ 一定要測 production build，不能測 dev server。
 * dev 模式的 hydration 時序、React 嚴格模式的雙重渲染、以及未壓縮的 chunk
 * 載入順序都跟 production 不同，零閃爍測試在 dev 下的結果不可信。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      // 用 Chromium 跑 iPhone 的視窗尺寸與 DPR。這裡要驗的是 599px 斷點下的
      // 字級（15/17/20），不是 WebKit 專屬行為，所以 CI 只需下載一個瀏覽器。
      name: "mobile",
      use: { ...devices["iPhone 15"], browserName: "chromium" },
    },
  ],

  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
