# Plan: 拆掉 client 分頁層 + 零閃爍字級偏好

**Feature:** 把翻頁從「RSC + client fetch 雙重擷取」收斂成純伺服器渲染；字級偏好改用 Next.js 官方的 pre-paint inline script 作法，消除 hydration 閃爍。

**Status:** Eng Review complete — ready to implement
**Branch:** main (未開分支)
**Reviewed:** 2026-09-15
**Reviewer:** /plan-eng-review
**Base commit:** 7a7f5b4

---

## Context

這份計畫的起點是一個問題：「是否有需要做全域狀態管理？」

**結論：不需要。** 5,957 行原始碼裡 `createContext` / `useContext` 出現 0 次，20 個 `"use client"` 元件沒有任何一個需要讀取另一個的狀態。專案的狀態已經分給四個正確的擁有者：

```
1. Server / RSC (Drizzle → Neon)   真正的資料
2. URL (?page=)                     導覽狀態，可分享、上一頁可用
3. localStorage / sessionStorage    跨 session 的裝置偏好
4. 元件內 useState                  單一擁有者的 UI 狀態
```

加狀態庫等於在四個已經運作的來源旁邊開第五個 — accidental complexity。

但在確認這件事的過程中，找到了四個真正該修的問題。以下是本次範圍。

---

## 根本問題：client 分頁層是多餘的

```
app/page.tsx:52-62
  const { page: pageParam } = await searchParams;     ← 伺服器已經讀了 ?page=
  initialData = await getCachedPublishedEntries(...); ← 伺服器已經抓了正確那一頁

components/entries/EntryGridClient.tsx:31
  const [data, setData] = useState(initialData);      ← 罪魁禍首
```

`useState(initialData)` 只在首次掛載使用 `initialData`。soft navigation 時 React 重用同一個元件實例，state 不跟新 props 走，畫面卡在第 1 頁。為了繞過這點，補了一層 `useSearchParams` + `fetch('/api/entries')`。

### 現況資料流（每次翻頁打兩次 DB）

```
使用者點「下一頁」<Link href="/?page=2" scroll={false}>
        │
        ├──► App Router 導覽 → HomePage 在伺服器重跑
        │       └─► getCachedPublishedEntries()        ← 第 1 次（unstable_cache，14400s）
        │             └─► 新 initialData 傳進 EntryGridClient
        │                   └─► useState 忽略它 ❌ 畫面沒變
        │
        └──► useEffect 偵測 ?page= 變了
                └─► fetch /api/entries?page=2
                      └─► getPublishedEntries()        ← 第 2 次（裸 DB 查詢，無快取）❌
                            └─► setData() → 畫面終於更新
```

### 目標資料流（一次，走快取）

```
使用者點「下一頁」<Link href="/?page=2" scroll={false}>
        │
        └──► App Router 導覽 → HomePage 在伺服器重跑
                └─► <Suspense key={2} fallback={<EntryCardSkeleton × 8 />}>
                      └─► <EntryGrid page={2} />        ← async server component
                            └─► getCachedPublishedEntries()  ← 唯一一次，走 unstable_cache
                                  └─► 直接渲染，零 client state
        │
        └──► <ScrollToGrid /> 偵測 page 變了 → 捲到 grid 頂（唯一保留的 client 行為）
```

---

## 鎖定的決議（6 項）

| # | 議題 | 決議 | 理由 |
|---|------|------|------|
| D2 | 範圍 | **完整版 S1+S2+S3+S4** | 淨刪除程式碼，不是範圍膨脹 |
| D3 | 載入模式 | **`<Suspense key={page}>` + async server 子元件** | 一次修好三個死掉的 Suspense fallback |
| D4 | 捲動行為 | **保留 15 行純捲動 client 元件** | 功能 100% 等價（使用者的硬條件） |
| D5 | 錯誤處理 | **加 `app/error.tsx`，例外往上拋** | 「網站壞了」不該長得像「網站沒文章」 |
| D6 | 字級閃爍 | **inline script + `<html data-font-size>` + CSS 屬性選擇器** | Next.js 官方 preventing-flash 作法 [Layer 1] |
| D8 | DOM 耦合 | **拆成 `#main-content`（skip link）與 `#article-body`（兩個元件）** | 一個 id 承載兩種語意是根本原因 |
| D7 | PAGE_SIZE | **抽成 `lib/constants/pagination.ts` 兩個具名常數** | ENTRY_PAGE_SIZE=8 / DIRECTOR_PAGE_SIZE=20 |

**未決：D9（測試範圍）** — 見下方「未解決決策」。

---

## What already exists（已存在、可直接複用）

| 既有資產 | 位置 | 本計畫如何使用 |
|---|---|---|
| `EntryCardSkeleton` / `HeroSkeleton` | `components/skeleton/` | **已寫好但從未顯示過**（放在永遠不觸發的 Suspense）。D3 讓它活起來，不需新寫元件 |
| `suppressHydrationWarning` | `app/layout.tsx:59-60` | D6 的 inline script 作法必要的前置條件，**已經在位** |
| `unstable_cache` 快取層 | `app/page.tsx:20-33` | 已設定 `revalidate:14400` + `tags:["entries"]`。D3 讓翻頁真正走到它 |
| `lib/constants/` 模式 | `genres.ts` / `festivals.ts` | D7 沿用同一個約定，不發明新位置 |
| `revalidateTag('entries')` | admin actions | 發佈/取消發佈時清快取，已運作 |
| `Pagination` 元件 | `components/ui/Pagination.tsx` | `<Link scroll={false}>` 已正確，不需修改 |
| 相關文章 + 上下篇 | `app/entries/[slug]/page.tsx:155-206` | **已完成**（`getRelatedEntries` / `getAdjacentEntries`）。舊筆記記為待辦是過期資訊 |
| gstack `/qa` 持久化瀏覽器 | gstack skill | D9 若選 B，視覺類驗證用它，不必另裝 Playwright |

**沒有任何一處是「重造已有輪子」。** 反而是移除自造的快取層，改用框架內建。

---

## NOT in scope（考慮過但明確排除）

| 項目 | 排除理由 |
|---|---|
| 全域狀態管理（Zustand / Redux / Jotai / Context） | 0 個跨元件共享狀態。加了就是第五個競爭的狀態來源 |
| `cacheComponents` + `use cache` + `unstable_instant` 遷移 | Next.js 16 的新快取模型，是獨立的多日遷移，不該混進這個 diff |
| `app/loading.tsx` route-level fallback | masthead 與 hero 都在 page.tsx 裡，route-level fallback 會連報頭一起閃掉（D3 選項 C 已否決） |
| `NewDot` 的同類 hydration 閃爍 | 同一個修法可套用，但不在 S1-S4 範圍。→ TODO-E6 |
| `BackToTop` / `TableOfContents` 的 reduced-motion | 兩處 `behavior:"smooth"` 無視使用者偏好，但不在本次動到的檔案。→ TODO-E7 |
| `wordCount()` CJK 計數 bug | 已有學習紀錄（confidence 7/10），屬 TODO-E5 測試工作的一部分 |
| Playwright / CI E2E | D9 未決。若選 vitest-only 則明確排除 |
| `?page=` 超出範圍的文案 | 現存 bug，不是本次引入。→ TODO-E8（但 D3 的改動會經過這段程式碼，可順手修） |
| `app/page.tsx` 的 `export const dynamic = "force-dynamic"` | 讀 `searchParams` 本來就強制動態，這行是冗餘的。移除的收益極小，不值得進這個 diff |

---

## 測試覆蓋率圖

```
CODE PATHS                                                USER FLOWS
[+] components/entries/EntryGrid.tsx  (新 async server)   [+] 首頁翻頁
  ├── [GAP] items.length === 0 → 空狀態                     ├── [GAP] [→E2E] 點下一頁 → 骨架 → 新內容
  ├── [GAP] items.length > 0  → 渲染卡片                    ├── [GAP] [→E2E] 翻頁後平滑捲到 grid 頂
  ├── [GAP] hasNext true  → 下一頁可點                      └── [GAP] [→E2E] 最後一頁「下一頁」disabled
  ├── [GAP] hasNext false → 下一頁 disabled
  └── [GAP] DB throw → 拋到 error.tsx                     [+] 網址直接進入
                                                           ├── [GAP] /?page=3 直接開，內容正確
[~] searchParams 解析（4 個 page.tsx 共用邏輯）             ├── [GAP] /?page=abc → 落回第 1 頁
  ├── [GAP] page 缺席        → 1                           ├── [GAP] /?page=-5 → 落回第 1 頁
  ├── [GAP] page="3"        → 3                           └── [GAP] ⚠ /?page=999 → 顯示「暫無文章」
  ├── [GAP] page="abc"      → NaN → 1                              （文案錯誤，見失效模式）
  ├── [GAP] page="-5"/"0"   → Math.max → 1
  └── [GAP] page 超出總頁數  → 空結果（文案錯誤 ❌）         [+] 字級偏好
                                                           ├── [GAP] [→E2E] ⚠ CRITICAL 直開文章連結
[+] components/ui/ScrollToGrid.tsx  (新 client)            │         + 存過 16px → 零版面跳動
  ├── [GAP] 首次掛載 → 不捲動                              ├── [GAP] [→E2E] 手機直開 → 不再 17→18 跳
  ├── [GAP] page 改變 → 捲到 grid 頂                       ├── [GAP] 首頁→文章 soft nav → 字級正確
  ├── [GAP] ⚠ reduced-motion → 應改 instant                └── [GAP] 無痕模式開文章 → 不崩潰、用預設值
  └── [GAP] 目標元素不存在 → 靜默 no-op
                                                          [+] 錯誤狀態
[~] app/layout.tsx inline script                           ├── [GAP] [→E2E] DB 掛掉 → 錯誤頁而非空站
  ├── [GAP] 合法值 "16"/"18"/"21" → 寫 data-font-size      └── [GAP] [→E2E] 點 reset() → 重新載入成功
  ├── [GAP] 非法值 "99"/"abc"    → 落回 18
  ├── [GAP] null                → 落回 18                 [+] 無障礙
  └── [GAP] localStorage 拋例外  → try/catch → 18          ├── [GAP] skip link 三頁都跳到 #main-content
                                                           ├── [GAP] reduced-motion 下翻頁不平滑捲動
[~] useArticlePrefs.ts (lazy initializer)                  └── [GAP] 鍵盤 Tab 可操作分頁與字級按鈕
  ├── [GAP] SSR typeof window === undefined → DEFAULT
  ├── [GAP] client 首 render → 須與 inline script 同結果
  └── [GAP] setFontSize 寫入失敗 → try/catch

[~] parseStoredSize()  ← 純函式，最好測
  ├── [GAP] "16"/"18"/"21" → 對應值
  ├── [GAP] "17"/"99"/"abc"/null → 18
  └── [GAP] " 18 " 前後空白 → 18

[~] ArticleControls.tsx
  ├── [GAP] fontSize === 16 → 縮小鍵 disabled
  ├── [GAP] fontSize === 21 → 放大鍵 disabled
  └── [GAP] 16 ↔ 18 ↔ 21 轉換正確

[+] app/error.tsx (新)
  ├── [GAP] 渲染錯誤訊息
  └── [GAP] reset() 重試

[~] ReadingProgress / TableOfContents
  └── [GAP] getElementById("article-body") 找到 / 找不到

COVERAGE: 0/42 paths tested (0%)  |  Code paths: 0/29 (0%)  |  User flows: 0/13 (0%)
QUALITY: ★★★:0  ★★:0  ★:0        |  GAPS: 42 (9 E2E, 0 eval)
```

Legend：★★★ 行為+邊界+錯誤路徑 ｜ ★★ 快樂路徑 ｜ ★ 冒煙測試 ｜ [→E2E] 需整合測試

**測試框架偵測結果：** RUNTIME:node。無 `vitest.config.*` / `jest.config.*` / `playwright.config.*`，無 `test/` `tests/` `__tests__/` `e2e/` 目錄，`package.json` 無 `scripts.test`，CLAUDE.md 無 Testing 段落。**專案目前零測試。**

---

## 失效模式

| 路徑 | 生產故障情境 | 有測試？ | 有錯誤處理？ | 讀者看得到？ |
|---|---|---|---|---|
| `EntryGrid` DB 查詢 | Neon 冷啟動逾時 | ❌ | ✅ error.tsx（D5） | ✅ 可重試錯誤頁 |
| `searchParams` 超出範圍 | 讀者收藏 `/?page=12`，後來文章變少 | ❌ | ❌ | ⚠️ 顯示「暫無文章」，像網站空了 |
| inline script | localStorage 被企業政策封鎖 | ❌ | ✅ try/catch | ✅ 用預設字級 |
| lazy useState vs script 不同步 | 兩邊解析邏輯漂移 → hydration mismatch | ❌ | ❌ | ⚠️ React 從錯誤邊界重建，inline script 修正整個失效 |
| `ScrollToGrid` | 目標元素還沒掛載 | ❌ | ✅ optional chaining | 無感 |
| `#article-body` 改名 | 有人改了 id 忘了同步 | ❌ | ❌ | ⚠️ 進度條永遠 0%，靜默失效 |

### 🔴 CRITICAL GAP ×3（無測試 + 無錯誤處理 + 靜默失效）

1. **`?page=` 超出範圍顯示「暫無文章」** — `app/page.tsx:81`。現存 bug，非本次引入。
2. **lazy useState 與 inline script 解析邏輯漂移** — D6 修法自帶的新風險。Next.js 文件明講：hydration mismatch 未被 suppress 時 React 會從錯誤邊界重建 DOM，**inline script 的修正會整個丟失**。→ 兩邊必須 import 同一個 `parseStoredSize`，這是實作時的硬性要求。
3. **`#article-body` 字串耦合斷裂** — D8 的殘留風險，進度條靜默歸零。

---

## 需要 inline ASCII 圖的位置

實作時在這些檔案的註解裡嵌入資料流圖：

- `components/entries/EntryGrid.tsx` — 上方「目標資料流」那張圖（說明為什麼沒有 client state）
- `app/layout.tsx` inline script 上方 — pre-paint 時序圖（HTML 解析 → script → 首次繪製 → hydration）
- `lib/constants/pagination.ts` — 一行註解說明兩個常數為何不同值即可，不需圖

---

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~20分 / CC: ~3分)** — constants — 抽出 `lib/constants/pagination.ts`
  - Surfaced by: 議題 5 (D7) — PAGE_SIZE 定義 8 處，值不一致（8 / 20）
  - Files: `lib/constants/pagination.ts`（新）、`app/page.tsx:14`、`app/genres/[slug]/page.tsx:11`、`app/festivals/[slug]/page.tsx:11`、`app/directors/page.tsx:12`
  - Verify: `grep -rn "PAGE_SIZE" app/` 只剩 import
  - Note: **先做這個**（Beck: make the change easy, then make the easy change）

- [ ] **T2 (P1, human: ~3h / CC: ~12分)** — pagination — 新增 `EntryGrid` async server component，包進 `<Suspense key={page}>`
  - Surfaced by: 議題 1 (D3) — `app/page.tsx:59-64` 在 JSX 前就 await，:80 的 Suspense fallback 是死碼
  - Files: `components/entries/EntryGrid.tsx`（新）、`components/directors/DirectorGrid.tsx`（新）、`app/page.tsx`、`app/genres/[slug]/page.tsx`、`app/festivals/[slug]/page.tsx`、`app/directors/page.tsx`
  - Verify: 翻頁時 DevTools Network 只看到一次 RSC 請求，無 `/api/` 呼叫

- [ ] **T3 (P1, human: ~30分 / CC: ~5分)** — pagination — 新增 `ScrollToGrid` client 元件保留平滑捲動
  - Surfaced by: 議題 2 (D4) — `EntryGridClient.tsx:50-54` 的 scrollIntoView 是拆層後唯一會消失的行為
  - Files: `components/ui/ScrollToGrid.tsx`（新）、四個 page.tsx
  - Verify: 翻頁後畫面平滑捲到 grid 頂，非跳到報頭
  - Note: 必須檢查 `matchMedia("(prefers-reduced-motion: reduce)")`，避免繼承現有的無障礙缺口

- [ ] **T4 (P1, human: ~1h / CC: ~6分)** — cleanup — 刪除 3 個 GridClient 與 4 條 API route
  - Surfaced by: 議題 1 (D3) — 四條 route 各自只有一個呼叫者，拆層後全是死碼
  - Files: 刪 `components/entries/EntryGridClient.tsx`、`components/genres/GenreGridClient.tsx`、`components/directors/DirectorGridClient.tsx`、`app/api/entries/route.ts`、`app/api/genres/[slug]/route.ts`、`app/api/festivals/[slug]/route.ts`、`app/api/directors/route.ts`
  - Verify: `grep -rn "GridClient\|/api/entries\|/api/genres\|/api/festivals\|/api/directors" app components` 零結果
  - Note: 順手移除 `serializeItems()` 與 `parseEntry()` — 不跨 client 邊界就不需要序列化

- [ ] **T5 (P1, human: ~2h / CC: ~10分)** — error — 新增 `app/error.tsx`，移除吞例外的 try/catch
  - Surfaced by: 議題 3 (D5) — `app/page.tsx:59-64` 等 5 處 `try {} catch {}` 讓 DB 故障顯示「暫無文章」
  - Files: `app/error.tsx`（新）、`app/page.tsx`、`app/directors/page.tsx`、`app/genres/[slug]/page.tsx`、`app/festivals/[slug]/page.tsx`
  - Verify: 斷開 `DATABASE_URL` 後訪問首頁 → 錯誤頁而非「暫無文章」；點 reset() 恢復
  - Note: 錯誤頁需符合「散場之後」視覺語彙，不可用 Next.js 預設白底英文頁

- [ ] **T6 (P1, human: ~3h / CC: ~12分)** — a11y/perf — 字級改用 pre-paint inline script
  - Surfaced by: 議題 4 (D6) — 手機每篇文章 17→18（→16）兩次全文重排
  - Files: `app/layout.tsx`、`app/globals.css`、`app/entries/[slug]/page.module.css:103,367`、`app/entries/[slug]/useArticlePrefs.ts`、`app/entries/[slug]/ArticleControls.tsx`
  - Verify: DevTools 節流到 Slow 3G，存 16px 後直開文章連結 → 零版面跳動
  - Note: 🔴 **inline script 與 lazy `useState` 初始值必須 import 同一個 `parseStoredSize`。** 解析邏輯漂移會導致 React 丟棄 inline script 的修正（見 CRITICAL GAP #2）

- [ ] **T7 (P2, human: ~40分 / CC: ~6分)** — a11y — 拆分 `#main-content` 與 `#article-body`
  - Surfaced by: 議題 6 (D8) — 一個 id 同時服務 skip link 與內文量測，語意衝突
  - Files: `app/entries/[slug]/page.tsx:145`、`app/entries/[slug]/ReadingProgress.tsx:11`、`app/entries/[slug]/TableOfContents.tsx:19`
  - Verify: 三個頁面的 skip link 行為不變；文章頁進度條與目錄高亮正常
  - Note: T6 已移除 `ArticleControls.tsx:14` 的第三個呼叫點

- [ ] **T8 (P3, 待 D9 決定)** — test — 建立測試基礎設施
  - Surfaced by: 第 3 節 — 42 條路徑 0% 覆蓋，3 條 CRITICAL 靜默失效
  - Files: 待定（`vitest.config.ts` + `lib/**/*.test.ts`）
  - Verify: `bun run test` 通過
  - Note: **D9 未決**。建議範圍：`parseStoredSize`、searchParams 解析、分頁邊界、`wordCount()` CJK（TODO-E5）

---

## 平行化策略

| Step | 觸及模組 | 依賴 |
|------|---------|------|
| T1 constants | `lib/constants/` | — |
| T2 EntryGrid | `components/`, `app/*/page.tsx` | T1 |
| T3 ScrollToGrid | `components/ui/`, `app/*/page.tsx` | T2 |
| T4 刪除舊層 | `components/`, `app/api/` | T2, T3 |
| T5 error.tsx | `app/` | T2（同樣改那幾個 page.tsx） |
| T6 字級 | `app/layout.tsx`, `app/entries/[slug]/` | — |
| T7 id 拆分 | `app/entries/[slug]/` | T6 |

**Lane A（分頁線）：** T1 → T2 → T3 → T4 → T5（循序，全部共用 `app/*/page.tsx`）
**Lane B（文章頁線）：** T6 → T7（循序，共用 `app/entries/[slug]/`）

**執行順序：** Lane A 與 Lane B 可平行開在兩個 worktree。兩者唯一的交集是 `app/layout.tsx`（只有 Lane B 動）與 `app/globals.css`（只有 Lane B 動），**無衝突**。合併後再做 T8。

**衝突旗標：** 無。兩條 lane 的檔案集合不相交。

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN (PLAN) | 7 issues, 3 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Note: 2026-06-13 / 06-19 / 06-30 的既有審查紀錄皆超過 7 天，不列入本次儀表板。

**OUTSIDE VOICE:** 未執行。Codex CLI 未安裝（`codex_reviews` 設定為 enabled，但 `command -v codex` 找不到），且使用者於 D10 選擇先存檔 commit，未走 Claude subagent 備援路徑。下次可執行 `npm install -g @openai/codex` 後重跑，或在實作前單獨跑 `/codex consult`。

**VERDICT:** ENG REVIEW 完成，6 項架構決議已鎖定並可實作。狀態為 ISSUES_OPEN 而非 CLEAR，原因是測試範圍（D9）尚未決定且有 3 個 CRITICAL 靜默失效缺口。實作 T1-T7 不受阻擋；T8 待 D9 拍板。

**UNRESOLVED DECISIONS:**
- D9（測試範圍）未決：專案目前 42 條程式路徑 0% 覆蓋。選項為 (A) vitest + Playwright 全覆蓋、(B) 只裝 vitest 做純函式並把 9 條視覺類路徑交給 gstack `/qa`（審查建議）、(C) 只寫進 TODOS.md、(D) 完全跳過。CRITICAL GAP #2（inline script 與 lazy useState 的 `parseStoredSize` 必須共用）只有測試擋得住，建議至少採 (B)。
