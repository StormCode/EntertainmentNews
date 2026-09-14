# TODOS — 散場之後

Deferred from plan reviews. Each item has enough context to be picked up cold.

---

## Engineering Review TODOs (from /plan-eng-review 2026-09-15)

### TODO-E6: NewDot 的 hydration 閃爍（與字級同一類）
**What:** `components/entries/NewDot.tsx:12-27` 在 `useEffect` 裡讀 localStorage/sessionStorage 判斷文章是否為「新」，導致「新」徽章在首次繪製後才彈出。改用與字級相同的 pre-paint inline script 或 lazy `useState` 初始化。
**Why:** 與 T6 修掉的字級閃爍是完全相同的失效模式：伺服器不知道 localStorage，SSR 先畫一次，hydration 後才修正。徽章在文章卡右上角彈出會造成視覺跳動。
**Pros:** 修法已經在 T6 建立好（`InlineScript` 元件 + lazy initializer 模式），套用成本低；讀者不再看到徽章閃現。
**Cons:** 徽章是每張卡片一個，inline script 需處理 N 個元素或改成 `<html>` 層級的資料屬性 + CSS 比較，設計上比單一字級複雜。
**Context:** 目前邏輯：`sessionStorage.prevVisit` 為快取，未命中時讀 `localStorage.lastVisit` 並立刻寫入 `Date.now()`。注意這個「讀完馬上覆寫」的副作用在改成 pre-paint 時要保持語意不變。相關檔案：`components/entries/NewDot.tsx`、`components/entries/EntryCard.module.css`（`.newBadge`）。
**Depends on:** T6（字級 inline script）完成後，模式可直接複用。
**Target:** v0.1

### TODO-E7: 三處 smooth scroll 無視 prefers-reduced-motion
**What:** `app/entries/[slug]/BackToTop.tsx:22` 與 `app/entries/[slug]/TableOfContents.tsx:72` 使用 `behavior: "smooth"` 但沒有檢查使用者的減少動態偏好。改成讀 `window.matchMedia("(prefers-reduced-motion: reduce)")` 後決定 `smooth` 或 `instant`。
**Why:** `app/globals.css:117-119` 的 reduced-motion 區塊只關掉 `.skeleton` 動畫。CSS media query 管不到 JS 的 `scrollIntoView`/`scrollTo`，所以對動態敏感的使用者（前庭功能障礙、偏頭痛）仍會被平滑捲動影響。
**Pros:** 兩個檔案各兩行，成本極低；補上一個真實的無障礙缺口。
**Cons:** 需要在每個呼叫點重複檢查，或抽一個 `lib/scroll.ts` 小工具（後者較 DRY）。
**Context:** 本次工程審查發現共 5 處 `behavior:"smooth"`，其中 3 處（三個 GridClient）已由 T4 刪除，T3 新增的 `ScrollToGrid` 已內建這個檢查。剩下這兩處在本次改動範圍外。建議抽 `lib/scroll.ts` 匯出 `smoothScrollTo()` / `smoothScrollIntoView()`，三個呼叫點共用。
**Depends on:** 無（T3 完成後可參考其實作）。
**Target:** v0.1

### TODO-E8: `?page=` 超出範圍時顯示「暫無文章」（文案錯誤）
**What:** `app/page.tsx:81` 等四個列表頁在 `items.length === 0` 時一律顯示「暫無文章。」。當讀者開啟 `/?page=999`（或收藏的舊分頁連結、文章數變少後）會看到同樣的字，誤以為整個網站空了。應區分「這個分類真的沒文章」與「這一頁超出範圍」，後者顯示「這一頁沒有內容」並附回第 1 頁的連結。
**Why:** 靜默失效：頁面回 200、沒有錯誤、監控抓不到，但讀者看到的是一個看起來壞掉的網站。搜尋引擎也可能索引到空頁面。
**Pros:** 純文案與一個條件判斷，風險接近零；同時可考慮 `currentPage > 1 && items.length === 0` 時回 `notFound()`，讓 SEO 拿到正確的 404。
**Cons:** 要決定是「友善空頁 + 回首頁連結」還是「直接 404」。404 對 SEO 較正確但對誤點的讀者較不友善。
**Context:** 現存 bug，非 2026-09-15 那次重構引入。四個列表頁都有相同邏輯（`app/page.tsx`、`app/genres/[slug]/page.tsx`、`app/festivals/[slug]/page.tsx`、`app/directors/page.tsx`）。T2 的 `EntryGrid` 抽取會經過這段程式碼，屆時可一併處理，屬於低成本順手修。
**Depends on:** 建議在 T2 之後做，因為空狀態邏輯會搬進 `EntryGrid`。
**Target:** v0.1

---

## Engineering Review TODOs (from /plan-eng-review 2026-06-19)

### TODO-E4: H2/H3 hover 複製錨點連結
**What:** 游標懸停於文章 H2/H3 標題時，顯示鎖鏈圖示，點擊將 `#anchor-id` URL 複製到剪貼簿。
**Why:** 方便讀者分享文章特定段落。讀者評論「聊到第三段」時有直接連結可引用。
**Pros:** 使用體驗提升；anchor id 已由 rehype-slug 產生（本次 PR 後）。
**Cons:** 需要 Clipboard API（需 HTTPS，已滿足）；hover UI 設計需要注意不遮蓋標題本身。
**Context:** 本次文章閱讀 UX 增強 PR 完成後即可實作。heading id 由 rehype-slug 產生，格式穩定。CSS `:hover` 顯示 `<Copy icon>` + click handler 即可。
**Depends on:** 文章閱讀 UX 增強 PR 已合入（rehype-slug 就位）。
**Target:** v0.1

### TODO-E5: 測試基礎設施（vitest）
**What:** 引入 vitest，為純函數寫第一批 unit tests。目前範圍：`wordCount()`（lib/markdown/render.ts）+ TMDB poster picker server logic（`fetchTmdbPosters`、`updateFilmPoster`）。
**Why:** wordCount() regex 曾有 bug（CJK 計算錯誤）；fetchTmdbPosters / updateFilmPoster 是純 server function，有明確輸入輸出規格，測試後可防止 cache revalidation 等 regression。
**Pros:** 建立測試文化基礎；兩個起點（wordCount + poster actions）都是零副作用純函數，設定成本最低。
**Cons:** 需設定 vitest config；Next.js app router server component 測試較複雜，此 TODO 只針對純函數與 server actions（mock DB）。
**Context:** 起點一：`lib/markdown/render.ts:wordCount()`；起點二：`lib/tmdb.ts:fetchTmdbPosters()`（mock fetch，測 sort/slice 邏輯）、`app/admin/entries/[slug]/edit/actions.ts:updateFilmPoster()`（mock db + uploadFilmImages，測 fallback 邏輯與 revalidate call）。
**Target:** v0.1

---

## Engineering Review TODOs (from /plan-eng-review 2026-06-13)

### ~~TODO-E1: /admin/health pipeline status page~~ ✓ DONE (2026-06-18)
已交付：`app/admin/health/page.tsx`（force-dynamic、紅/橙/綠 badge、48h/14d 閾值）、`app/api/pipeline-health/route.ts`（Bearer auth UPSERT）、`db/schema/pipeline-health.ts`、migration `0001_funny_shooting_star.sql`、`.env.example` 含 `PIPELINE_HEALTH_SECRET=`。

### ~~TODO-E3: admin hero-featured toggle~~ ✓ DONE (2026-06-18)
已交付：`EditEntryForm.tsx` 加入 Hero 精選 checkbox（`is_hero_featured`）；`updateEntry` action 已支援 `heroFeatured` 參數；CSS `heroToggle` 樣式加入 `edit.module.css`。

### ~~TODO-E2: scripts/verify-restore.sh~~ ✓ DONE (Day 6)
Delivered: `scripts/verify-restore.sh`, `.github/workflows/nightly-backup.yml`,
`.github/workflows/restore-test.yml`. Backup runs nightly at 02:00 TST to R2
(14-day retention). Restore-test runs weekly (Sunday 03:00 TST) with a Postgres
service container. Script supports `--check-only` for CI and full Docker mode for
local testing. Required GHA secrets: `DATABASE_URL_DIRECT`, `R2_ENDPOINT`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

---

## Design Review TODOs (from /plan-design-review 2026-06-13)

### ~~TODO-D3: GenreGrid — 重新啟用類別連結~~ ✓ DONE (已完成)
`GenreGrid.tsx` 已使用 `<Link href={/genres/${slug}}>` 且 `app/genres/[slug]/page.tsx` 已存在。

---

### TODO-D1: "New since last visit" marker on entry cards
**What:** Add a small 「新」badge to entry cards for articles published since the reader's last visit. Use `localStorage` to persist the last visit timestamp.
**Why:** Returning readers scan for new content first. A clear "new" marker removes the need to mentally compare dates.
**Target:** v0.1 (needs meaningful content volume to be useful — minimum ~10 entries).
**Context:** Requires localStorage; no server-side session needed. Badge uses `--gold` color, `6px × 6px` dot style, top-right of poster image.

### ~~TODO-D2: OG card visual spec + implementation~~ ✓ DONE
**What:** Lock OG card layout in DESIGN.md and implement via `next/og`. Layout: full-bleed backdrop image, 《片名》title bottom-left (serif 32px white), director + streaming status below title, 「散場之後」wordmark bottom-right (gold, sans 14px).
**Why:** Shared links on Bluesky/Threads are the primary discovery channel. A generic "link preview" loses the editorial identity; a designed OG card signals the publication register.
**Target:** Day 8 (in v0 success criteria per design review recommendation — revise timeline if needed).
**Depends on:** `next/og` setup, entry `backdrop_url` working via R2 pipeline.

---

## QA Deferred Issues (from /qa 2026-06-18)

### ~~TODO-QA1: LazyReveal viewport check triggers in headless/prerender contexts~~ ✓ DONE (2026-06-18)
**What:** `LazyReveal.tsx` uses `getBoundingClientRect()` in `useEffect` to detect above-fold content. In headless browsers and prerender contexts, element positions may not match expected values, causing `ready` (opacity:0) to apply to visible content. Hero section appears invisible on initial load in headless mode.
**Why:** Not a blocker for real users (IntersectionObserver fires normally after layout). Could affect social preview scrapers or bots that capture initial render.
**Target:** Pre-v0.1 launch — low priority.
**Fix direction:** Add a `requestAnimationFrame` or `setTimeout(0)` delay before the `getBoundingClientRect()` check, or use a CSS-only approach (`@starting-style` / `content-visibility`) for the above-fold fast-path.
**Context:** `components/ui/LazyReveal.tsx:13-20`. Ref: QA report ISSUE-002.

---

## Open Questions (unblocked, but note before launch)

- **Editor byline:** Real name / pseudonym / initials? Settle before launch (attribution accrues).
- **Domain wordmark:** 散場之後 confirmed? Candidates: 夜場, 銀幕後, 片尾字幕之後. Editor's call.
- **v0.1 comment strategy:** Webmentions vs Bluesky thread pull-on-demand. Defer until there is reader demand.
