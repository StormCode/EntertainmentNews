import { GRID_ANCHOR_ID } from "@/lib/dom-ids";

/**
 * 列表 grid 的捲動錨點。零高度，放在 Suspense 邊界之前。
 *
 * 為什麼不把 id 直接放在 grid 上（2026-09-15，e2e 抓到的兩個 bug）：
 *
 *  1. 放在 EntryGrid 的輸出上 → 翻頁瞬間 Suspense 顯示骨架，骨架沒有錨點，
 *     ScrollToGrid 的 getElementById 回 null，捲動被靜默跳過且不會重試。
 *  2. 改成骨架與內容都帶同一個 id → Next.js 串流時兩者會同時存在於 DOM，
 *     變成重複 id，getElementById 可能抓到那個隱藏的舊節點。
 *
 * 錨點必須是一個獨立、穩定、不隨 Suspense 切換的元素。
 * 四個列表頁的 .main 都是純 block 容器，空 div 不產生任何版面影響。
 */
export function GridAnchor() {
  return <div id={GRID_ANCHOR_ID} aria-hidden="true" />;
}
