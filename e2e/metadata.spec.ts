import { expect, test, type Page } from "@playwright/test";

/**
 * 頁面標題（2026-09-16）。
 *
 * app/layout.tsx 設了 title.template "%s — 散場之後"，頁面只要給裸標題就好。
 * 五個頁面自己又寫了一次後綴，於是輸出變成「導演 — 散場之後 — 散場之後」，
 * 而且漏到 og:title —— 那是分享到 Threads / Bluesky 時對方看到的標題。
 *
 * 通用斷言用「站名只能出現一次」，不寫死每頁的預期字串：改文案不會誤傷，
 * 但只要有人再把後綴寫進頁面的 title 就會紅燈。
 */

const SITE_NAME = "散場之後";

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function titleOf(page: Page, path: string): Promise<string> {
  await page.goto(path);
  return page.title();
}

async function ogTitleOf(page: Page, path: string): Promise<string | null> {
  await page.goto(path);
  return page
    .locator('meta[property="og:title"]')
    .first()
    .getAttribute("content");
}

/** 從實際頁面撈一個真的 slug，不要寫死 —— 內容會變。 */
async function firstHref(page: Page, path: string, prefix: string) {
  await page.goto(path);
  const href = await page
    .locator(`a[href^="${prefix}"]`)
    .first()
    .getAttribute("href");
  expect(href, `${path} 應該至少有一個 ${prefix} 連結`).toBeTruthy();
  return href!;
}

test.describe("頁面標題", () => {
  test("首頁用 title.default，不加後綴", async ({ page }) => {
    expect(await titleOf(page, "/")).toBe(SITE_NAME);
  });

  test("靜態頁的站名只出現一次", async ({ page }) => {
    for (const path of ["/archive", "/festivals", "/directors", "/search?q=test"]) {
      const title = await titleOf(page, path);
      expect(title, `${path} 的 <title>`).toContain(SITE_NAME);
      expect(
        occurrences(title, SITE_NAME),
        `${path} 的 <title> 是「${title}」—— 站名重複代表頁面自己又寫了一次 template 的後綴`,
      ).toBe(1);
    }
  });

  test("動態頁的站名只出現一次", async ({ page }) => {
    const genreHref = await firstHref(page, "/", "/genres/");
    const directorHref = await firstHref(page, "/directors", "/directors/");
    const entryHref = await firstHref(page, "/", "/entries/");

    for (const path of [genreHref, directorHref, entryHref]) {
      const title = await titleOf(page, path);
      expect(title, `${path} 的 <title>`).toContain(SITE_NAME);
      expect(
        occurrences(title, SITE_NAME),
        `${path} 的 <title> 是「${title}」`,
      ).toBe(1);
    }
  });

  test("og:title 的站名也只出現一次（分享連結會看到）", async ({ page }) => {
    const genreHref = await firstHref(page, "/", "/genres/");
    const entryHref = await firstHref(page, "/", "/entries/");

    for (const path of ["/", "/directors", genreHref, entryHref]) {
      const og = await ogTitleOf(page, path);
      if (!og) continue; // 沒設 og:title 的頁面跳過
      expect(
        occurrences(og, SITE_NAME),
        `${path} 的 og:title 是「${og}」`,
      ).toBeLessThanOrEqual(1);
    }
  });

  // admin 走 proxy.ts 的 HTTP Basic auth，E2E 進不去（回 401、沒有 <title>）。
  // 它有自己的 template（app/admin/layout.tsx:6 "%s — 散場之後管理"）且各頁
  // 都給裸標題，讀程式碼即可確認，不值得為它在測試裡塞憑證。
});
