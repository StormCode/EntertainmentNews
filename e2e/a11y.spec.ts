import { expect, test, type Page } from "@playwright/test";

/**
 * 無障礙（2026-09-15 工程審查 D8 + T3 的 reduced-motion）。
 */

test.describe("skip link", () => {
  for (const [name, path] of [
    ["首頁", "/"],
    ["導演頁", "/directors"],
    ["搜尋頁", "/search?q=a"],
  ] as const) {
    test(`${name}的「跳到主要內容」指向存在的 main landmark`, async ({ page }) => {
      await page.goto(path);
      const href = await page
        .getByRole("link", { name: "跳到主要內容" })
        .getAttribute("href");
      expect(href).toBe("#main-content");
      await expect(page.locator("#main-content")).toHaveCount(1);
    });
  }

  test("文章頁的 main 與 article 是不同元素，各司其職", async ({ page }) => {
    await page.goto("/");
    const href = await page
      .locator('#main-content a[href^="/entries/"]')
      .first()
      .getAttribute("href");
    await page.goto(href!);

    // skip link 的目標
    await expect(page.locator("main#main-content")).toHaveCount(1);
    // 閱讀進度條與目錄的量測對象
    await expect(page.locator("article#article-body")).toHaveCount(1);
    // 內文在 main 裡面，但兩者不是同一個節點
    await expect(page.locator("main#main-content article#article-body")).toHaveCount(1);
  });
});

test.describe("reduced motion", () => {
  /**
   * 攔截 scrollIntoView 記下每次呼叫用的 behavior。
   *
   * ⚠️ 每條測試都必須先斷言「有被呼叫過」再斷言 behavior。
   * 少了前半段的話，捲動根本沒發生時 not.toContain("smooth") 會空陣列通過 ——
   * 一條看起來是綠的、實際上什麼都沒驗證的測試。
   * （2026-09-15：ScrollToGrid 找不到錨點而靜默跳過的 bug 就是這樣差點被漏掉。）
   */
  async function recordScrollBehaviors(page: Page) {
    await page.addInitScript(() => {
      const original = Element.prototype.scrollIntoView;
      const w = window as unknown as { __behaviors: string[] };
      w.__behaviors = [];
      Element.prototype.scrollIntoView = function (arg?: unknown) {
        w.__behaviors.push(
          typeof arg === "object" && arg !== null
            ? ((arg as ScrollIntoViewOptions).behavior ?? "auto")
            : "auto",
        );
        return original.call(this, arg as ScrollIntoViewOptions);
      };
    });
  }

  async function paginateAndCollect(page: Page): Promise<string[]> {
    await page.goto("/");
    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);

    // 先確定捲動真的發生過，再看它用什麼 behavior
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __behaviors: string[] }).__behaviors,
          ),
        { timeout: 5000, message: "ScrollToGrid 應該呼叫 scrollIntoView" },
      )
      .not.toEqual([]);

    return page.evaluate(
      () => (window as unknown as { __behaviors: string[] }).__behaviors,
    );
  }

  test("開啟減少動態後翻頁用 auto，不用平滑捲動", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recordScrollBehaviors(page);

    const behaviors = await paginateAndCollect(page);
    expect(behaviors).not.toContain("smooth");
    expect(behaviors).toContain("auto");
  });

  test("未開啟減少動態時使用平滑捲動", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await recordScrollBehaviors(page);

    const behaviors = await paginateAndCollect(page);
    expect(behaviors).toContain("smooth");
  });
});
