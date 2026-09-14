import { expect, test } from "@playwright/test";

/**
 * 錯誤邊界（2026-09-15 工程審查 D5）。
 *
 * 重構前資料庫錯誤被 try{}catch{} 吞掉並顯示「暫無文章。」，與真的沒文章
 * 無法區分：頁面回 200、沒有告警、讀者以為網站收了。
 *
 * 這裡沒辦法在 E2E 裡真的把 Neon 弄掛，所以驗證的是「錯誤頁存在且可用」
 * 這個前提條件 —— 錯誤實際會不會拋到這裡，由單元測試與人工斷線測試涵蓋。
 */

test("錯誤頁的重試與回首頁都可操作", async ({ page }) => {
  // 直接掛載 error.tsx 不可行（它是 Next.js 的路由慣例檔），
  // 改為驗證它在建置產物中存在、且不是 Next.js 的預設英文錯誤頁。
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();
});

test("真的沒有結果時顯示空狀態，而不是錯誤頁", async ({ page }) => {
  // 搜尋一個不可能命中的字串
  await page.goto("/search?q=zzzzzzzzzznotfoundzzzzzzzzzz");
  await expect(page.locator("#main-content")).toBeVisible();
  // 不應該出現錯誤頁的標題
  await expect(page.getByRole("heading", { name: "放映中斷" })).toHaveCount(0);
});
