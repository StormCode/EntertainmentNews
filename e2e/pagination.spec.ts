import { expect, test, type Page } from "@playwright/test";

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
   * 2026-09-15 的兩輪修正：
   *
   *  v1  key 在 <Suspense> 上 → 翻頁硬切成骨架再硬切成新內容，使用者回報「跳太快」
   *  v2  改用 view transition  → 第 1 頁 8 篇、第 2 頁 2 篇的高度差讓探索類型
   *                             先被頂上去再被壓下來，加上整頁 root crossfade
   *                             的殘影，變成來回搖
   *  v3  回到重構前的作法：舊內容原地淡化等新資料，就位才換。版面只在最後
   *      那一瞬變動一次。
   */

  test("每次翻頁新內容都會淡入，不依賴載入速度", async ({ page }) => {
    // useLinkStatus 只在導覽被阻塞時回報 pending，本機 RSC 回應約 20ms，
    // 幾乎不會 commit。所以淡入必須是純 CSS 動畫，跟速度無關才一定會播。
    //
    // 用 animationstart 事件計數而不是 getAnimations()：後者只回傳還在跑的
    // 動畫，240ms 的淡入在斷言執行前早就結束了。
    await page.addInitScript(() => {
      const w = window as unknown as { __pagingIn: number };
      w.__pagingIn = 0;
      document.addEventListener(
        "animationstart",
        (e) => {
          if ((e as AnimationEvent).animationName === "paging-in") {
            w.__pagingIn += 1;
          }
        },
        true,
      );
    });

    const count = () =>
      page.evaluate(() => (window as unknown as { __pagingIn: number }).__pagingIn);

    await page.goto("/");
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();
    await expect.poll(count, { timeout: 5000 }).toBe(1);

    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();

    // grid 的 key={page} 讓它重新掛載，動畫才會重播。
    // 少了 key 的話 React 沿用同一個節點，計數會停在 1。
    await expect
      .poll(count, { timeout: 5000, message: "翻頁後淡入應該重播" })
      .toBe(2);
  });

  test("翻頁載入中，舊內容原地淡化且不可點擊", async ({ page }) => {
    await page.goto("/");
    const grid = page.locator("[data-paging-dim]").first();
    await expect(grid).toBeVisible();

    // 直接驅動屬性而不是賽跑等 useLinkStatus —— 本機導覽可能只有幾毫秒，
    // 等它會 flaky。這裡要釘住的是「屬性 → CSS」這條線有接好。
    await expect(grid).toHaveCSS("opacity", "1");

    await page.evaluate(() => {
      document.documentElement.dataset.paginating = "true";
    });
    await expect(grid).toHaveCSS("opacity", "0.45");
    await expect(grid).toHaveCSS("pointer-events", "none");

    await page.evaluate(() => {
      delete document.documentElement.dataset.paginating;
    });
    await expect(grid).toHaveCSS("opacity", "1");
  });

  test("翻頁完成後淡化狀態會解除，不會卡在半透明", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.paginating ?? null),
      )
      .toBe(null);
    await expect(page.locator("[data-paging-dim]").first()).toHaveCSS(
      "opacity",
      "1",
    );
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

test.describe("內容出現順序", () => {
  /**
   * 2026-09-15 使用者回饋：文章內容要優先出來，之後才顯示探索類型。
   *
   * GenreGrid 是同步的 server component（只讀 lib/constants/genres.ts），
   * 不放閘門的話它會落在第一次 flush 裡，讀者在文章還是骨架時就先看到它 ——
   * 跟「文章是主角、類型探索是配角」的閱讀順序相反。
   * 修法是讓它等文章的 promise 就緒（components/ui/AfterReady.tsx）。
   */
  test("翻頁時探索類型不會消失再出現", async ({ page }) => {
    await page.goto("/");
    const genres = page.locator('[aria-label="探索電影類型"]');
    await expect(genres).toBeAttached();

    await page.addInitScript(() => {});
    let detached = false;
    const poll = setInterval(async () => {
      try {
        if ((await genres.count()) === 0) detached = true;
      } catch {
        /* 導覽中的暫時性錯誤忽略 */
      }
    }, 50);

    await page.getByRole("link", { name: "下一頁" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(ENTRY_LINKS).first()).toBeVisible();
    clearInterval(poll);

    expect(detached, "翻頁時探索類型應該留在畫面上，不該閃掉").toBe(false);
    await expect(genres).toBeAttached();
  });
});
