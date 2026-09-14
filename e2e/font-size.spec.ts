import { expect, test, type Page } from "@playwright/test";

/**
 * 字級零閃爍（2026-09-15 工程審查 D6 / CRITICAL GAP #2）。
 *
 * 重構前手機讀者每篇文章都會看到 17px → 18px（存過偏好再跳 16px）的全文重排：
 * CSS 寫死 17px fallback、hook 預設 18px、useEffect 在 hydration 後才修正。
 *
 * 這組測試用四重斷言把「零閃爍」釘死，缺一不可：
 *
 *   1. 伺服器送出的 HTML 帶著預設值（伺服器不可能知道 localStorage）
 *   2. 瀏覽器端的 data-font-size 是讀者存的值（inline script 生效了）
 *   3. 文章內文區的 layout-shift 為 0（修正發生在首次繪製前，不是之後）
 *   4. console 沒有 hydration 警告
 *
 * 第 4 項最容易被忽略但最關鍵：一旦 hydration mismatch，React 會從錯誤邊界
 * 重建 DOM，inline script 寫入的正確字級整個被丟棄。前三項全過但第 4 項紅燈
 * 的話，零閃爍其實已經失效了。
 */

const SEEDED_SIZE = "16";

/** 在頁面任何腳本執行前種下偏好，並掛上只監看文章內文的 layout-shift 觀察器。 */
async function seedPreferenceAndObserver(page: Page, size: string) {
  await page.addInitScript((stored) => {
    try {
      localStorage.setItem("article-font-size", stored);
    } catch {
      /* 種不進去就讓斷言去失敗，不要在這裡吞掉 */
    }

    // 只累計「來源節點落在文章內文裡」的位移，避免字型載入、圖片等
    // 與字級無關的位移造成 flaky
    (window as unknown as { __articleShift: number }).__articleShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{ node?: Node | null }>;
        };
        if (shift.hadRecentInput) continue;
        const touchesArticle = (shift.sources ?? []).some((s) => {
          const node = s.node as Element | null;
          return !!node?.closest?.("#article-body");
        });
        if (touchesArticle) {
          (window as unknown as { __articleShift: number }).__articleShift +=
            shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  }, size);
}

async function firstArticleUrl(page: Page): Promise<string> {
  await page.goto("/");
  const href = await page
    .locator('#main-content a[href^="/entries/"]')
    .first()
    .getAttribute("href");
  expect(href, "首頁 grid 應該至少有一篇文章").toBeTruthy();
  return href!;
}

test("直接開文章連結時字級零閃爍（hard load，分享連結的主要入口）", async ({
  page,
}) => {
  const articleUrl = await firstArticleUrl(page);

  const hydrationWarnings: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (/hydrat|did not match|Text content does not match/i.test(text)) {
      hydrationWarnings.push(text);
    }
  });

  await seedPreferenceAndObserver(page, SEEDED_SIZE);

  // 斷言 1：伺服器送出的 HTML 帶預設值
  const response = await page.goto(articleUrl, { waitUntil: "commit" });
  const html = await response!.text();
  expect(html).toContain('data-font-size="18"');

  // 斷言 2：瀏覽器端已是讀者存的值
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.fontSize),
    )
    .toBe(SEEDED_SIZE);

  await page.waitForLoadState("load");
  await expect(page.locator("#article-body")).toBeVisible();

  // 實際套用的字級確實是 16（桌機）或 15（行動版縮 1px）
  const applied = await page.evaluate(() =>
    getComputedStyle(document.querySelector("#article-body")!).fontSize,
  );
  expect(["16px", "15px"]).toContain(applied);

  // 斷言 3：文章內文區沒有任何版面位移
  const shift = await page.evaluate(
    () => (window as unknown as { __articleShift: number }).__articleShift,
  );
  expect(shift, "文章內文區不應有任何 layout shift").toBe(0);

  // 斷言 4：沒有 hydration 警告 —— 有的話前三項都白搭
  expect(hydrationWarnings).toEqual([]);
});

test("沒存過偏好的讀者用預設字級，一樣零閃爍", async ({ page }) => {
  const articleUrl = await firstArticleUrl(page);

  await page.addInitScript(() => {
    (window as unknown as { __articleShift: number }).__articleShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{ node?: Node | null }>;
        };
        if (shift.hadRecentInput) continue;
        if (
          (shift.sources ?? []).some((s) =>
            (s.node as Element | null)?.closest?.("#article-body"),
          )
        ) {
          (window as unknown as { __articleShift: number }).__articleShift +=
            shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(articleUrl);
  await expect(page.locator("#article-body")).toBeVisible();

  const applied = await page.evaluate(() =>
    getComputedStyle(document.querySelector("#article-body")!).fontSize,
  );
  // 桌機 18px / 行動版 17px —— 這正是重構前會互相打架的兩個值
  expect(["18px", "17px"]).toContain(applied);

  expect(
    await page.evaluate(
      () => (window as unknown as { __articleShift: number }).__articleShift,
    ),
  ).toBe(0);
});

test("調整字級會立即生效並在重新整理後保持", async ({ page }) => {
  const articleUrl = await firstArticleUrl(page);
  await page.goto(articleUrl);

  const body = page.locator("#article-body");
  const before = await body.evaluate((el) => getComputedStyle(el).fontSize);

  await page.getByLabel("放大字級").click();
  await expect
    .poll(() => body.evaluate((el) => getComputedStyle(el).fontSize))
    .not.toBe(before);

  const enlarged = await body.evaluate((el) => getComputedStyle(el).fontSize);

  await page.reload();
  await expect
    .poll(() => body.evaluate((el) => getComputedStyle(el).fontSize))
    .toBe(enlarged);
});

test("字級到達上下限時按鈕停用", async ({ page }) => {
  const articleUrl = await firstArticleUrl(page);
  await page.goto(articleUrl);

  const smaller = page.getByLabel("縮小字級");
  const larger = page.getByLabel("放大字級");

  await larger.click();
  await expect(larger).toBeDisabled();

  await smaller.click();
  await smaller.click();
  await expect(smaller).toBeDisabled();
});

test("localStorage 不可用時不崩潰，退回預設字級", async ({ page }) => {
  const articleUrl = await firstArticleUrl(page);

  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage blocked");
      },
    });
  });

  await page.goto(articleUrl);
  await expect(page.locator("#article-body")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.fontSize)).toBe(
    "18",
  );
});
