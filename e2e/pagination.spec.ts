import { expect, test } from "@playwright/test";

/**
 * 翻頁流程（2026-09-15 工程審查 D3 / D4）。
 *
 * 重構前翻頁會打兩次後端：伺服器渲染一次，client 再 fetch 一次 /api/entries。
 * 「零 /api 請求」那條是這件事的回歸守門員 —— 如果哪天有人又加回 client
 * fetch 層，這裡會紅燈。
 */

/** 捲動錨點：零高度元素，只用來驗證捲動目標，不要對它做可見性斷言。 */
const GRID_ANCHOR = "#grid-top";
/** grid 本身沒有 id；用剛拆出來的 main landmark 定位，首頁的 hero 與類型區都在它外面。 */
const ENTRY_LINKS = '#main-content a[href^="/entries/"]';

test.describe("首頁分頁", () => {
  test("點下一頁會換內容，且完全不打 API route", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      const path = new URL(req.url()).pathname;
      if (path.startsWith("/api/")) apiCalls.push(path);
    });

    await page.goto("/");
    const firstPageHrefs = await page
      .locator(ENTRY_LINKS)
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(firstPageHrefs.length).toBeGreaterThan(0);

    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);

    const secondPageHrefs = await page
      .locator(ENTRY_LINKS)
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    // 兩頁內容不得重疊
    const overlap = secondPageHrefs.filter((h) => firstPageHrefs.includes(h));
    expect(overlap).toEqual([]);

    // 回歸守門員：分頁完全由伺服器負責
    expect(apiCalls).toEqual([]);
  });

  test("翻頁後畫面捲到文章牆頂端，不是停在分頁按鈕旁", async ({ page }) => {
    // 只驗證最終位置不夠：內容少的那一頁高度驟縮，瀏覽器夾住捲動位置後
    // grid 本來就可能落在視窗頂附近，測試會僥倖通過。先釘住「捲動確實發生」。
    await page.addInitScript(() => {
      const original = Element.prototype.scrollIntoView;
      const w = window as unknown as { __scrolledTo: string[] };
      w.__scrolledTo = [];
      Element.prototype.scrollIntoView = function (arg?: unknown) {
        w.__scrolledTo.push((this as Element).id || "(no id)");
        return original.call(this, arg as ScrollIntoViewOptions);
      };
    });

    await page.goto("/");
    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);

    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __scrolledTo: string[] }).__scrolledTo,
          ),
        { timeout: 5000 },
      )
      .toContain("grid-top");

    await expect
      .poll(
        async () =>
          page.evaluate((sel) => {
            const grid = document.querySelector(sel);
            if (!grid) return Number.NaN;
            return Math.abs(grid.getBoundingClientRect().top);
          }, GRID_ANCHOR),
        { timeout: 5000 },
      )
      .toBeLessThan(150);
  });

  test("第 1 頁的上一頁停用，最後一頁的下一頁停用", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("上一頁")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // 一路翻到底
    for (let i = 0; i < 20; i++) {
      const next = page.getByRole("link", { name: "下一頁" });
      if ((await next.count()) === 0) break;
      await next.click();
      await page.waitForLoadState("networkidle");
    }
    await expect(page.getByLabel("下一頁")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

test.describe("網址直接進入", () => {
  test("非法 page 參數落回第 1 頁", async ({ page }) => {
    await page.goto("/");
    const expected = await page
      .locator(ENTRY_LINKS)
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    for (const query of ["?page=abc", "?page=-5", "?page=0", "?page="]) {
      await page.goto(`/${query}`);
      const actual = await page
        .locator(ENTRY_LINKS)
        .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      expect(actual, `${query} 應與第 1 頁相同`).toEqual(expected);
    }
  });

  test("直接開 ?page=2 內容正確", async ({ page }) => {
    await page.goto("/?page=2");
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();
  });
});

test.describe("其他列表頁", () => {
  test("導演頁分頁不打 API", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname.startsWith("/api/")) {
        apiCalls.push(req.url());
      }
    });
    await page.goto("/directors");
    await expect(
      page.locator('#main-content a[href^="/directors/"]').first(),
    ).toBeVisible();
    expect(apiCalls).toEqual([]);
  });
});

test.describe("翻頁的視覺轉場", () => {
  /**
   * 2026-09-15：原本 key 放在 <Suspense> 上，翻頁會硬切成骨架再硬切成新內容，
   * 使用者回報「跳太快」。改成 key 放在 <ViewTransition> 上（Next.js
   * view-transitions guide Step 4 的同路由 crossfade），舊內容留到新內容備妥
   * 再淡出淡入，骨架只在冷載入時出現。
   */

  test("翻頁會觸發 view transition 而不是硬切", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __vtCount: number };
      w.__vtCount = 0;
      // lib.dom 已有正式型別，用它而不是 unknown 硬蓋
      const original = document.startViewTransition?.bind(document);
      if (!original) return; // 瀏覽器不支援就跳過，不讓測試假綠
      document.startViewTransition = ((
        callback?: Parameters<typeof original>[0],
      ) => {
        w.__vtCount += 1;
        return original(callback);
      }) as typeof document.startViewTransition;
    });

    await page.goto("/");

    const supported = await page.evaluate(
      () => typeof document.startViewTransition === "function",
    );
    test.skip(!supported, "此瀏覽器不支援 View Transitions API");

    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);

    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { __vtCount: number }).__vtCount),
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
  });

  test("翻頁過程中不再閃過骨架卡", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __sawSkeleton: boolean; __watching: boolean };
      w.__sawSkeleton = false;
      w.__watching = false;
      new MutationObserver(() => {
        if (!w.__watching) return;
        if (document.querySelector(".skeleton")) w.__sawSkeleton = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });

    await page.goto("/");
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();

    // 冷載入的骨架不算，從這裡開始才記錄
    await page.evaluate(() => {
      const w = window as unknown as { __sawSkeleton: boolean; __watching: boolean };
      w.__sawSkeleton = false;
      w.__watching = true;
    });

    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();

    expect(
      await page.evaluate(
        () => (window as unknown as { __sawSkeleton: boolean }).__sawSkeleton,
      ),
      "翻頁時舊內容應該留在畫面上，不該退回骨架",
    ).toBe(false);
  });
});
