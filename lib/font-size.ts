/**
 * 文章字級偏好 —— inline script 與 React 的單一真相來源。
 *
 * 為什麼要用 pre-paint inline script（2026-09-15 工程審查 D6）：
 *
 *   瀏覽器收到 HTML          React 下載完      hydration      首次繪製之後
 *        │                       │                │                │
 *        ├── inline script ──────┼────────────────┼────────────────┤  ✅ 本作法
 *        │   （這裡就定下字級）   │                │                │
 *        │                       │                │                │
 *        └───────────────────────┴────────────────┴──► useEffect   ❌ 重構前
 *                                                       （這裡才改，畫面已經畫過了）
 *
 * 重構前手機讀者每篇文章都看得到 17px → 18px（存過偏好的話再跳到 16px）
 * 的全文重排。
 *
 * 🔴 這個模組是 CRITICAL GAP #2 的守門員：inline script 與 lazy useState
 * 初始值必須算出完全相同的結果。不一致會造成 hydration mismatch，React 會從
 * 錯誤邊界重建 DOM，**inline script 寫入的正確字級整個被丟棄**，而且不會有
 * 任何錯誤訊息。所以兩邊都必須從下面同一組常數推導，不可以各寫一份。
 */

export const FONT_SIZES = [16, 18, 21] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const DEFAULT_FONT_SIZE: FontSize = 18;
export const FONT_SIZE_STORAGE_KEY = "article-font-size";

/** localStorage 的原始字串 → 合法字級。任何無法解析或不在白名單的值都落回預設。 */
export function parseStoredSize(raw: string | null | undefined): FontSize {
  const parsed = Number.parseInt(raw ?? "", 10);
  return (FONT_SIZES as readonly number[]).includes(parsed)
    ? (parsed as FontSize)
    : DEFAULT_FONT_SIZE;
}

/**
 * 在 <head> 同步執行的 inline script，於首次繪製前把 data-font-size 寫上 <html>。
 *
 * 字串是從上面同一組常數產生的，不是手寫的副本 —— 這是防止解析邏輯漂移的機制。
 * try/catch 處理 localStorage 不可用的情況（無痕模式、企業政策封鎖）。
 */
export const FONT_SIZE_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var a=${JSON.stringify(
  FONT_SIZES,
)},n=parseInt(localStorage.getItem(${JSON.stringify(
  FONT_SIZE_STORAGE_KEY,
)})||"",10);d.dataset.fontSize=a.indexOf(n)>-1?n:${DEFAULT_FONT_SIZE}}catch(e){d.dataset.fontSize=${DEFAULT_FONT_SIZE}}})()`;
