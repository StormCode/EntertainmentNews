/**
 * 分頁的單一真相來源。
 *
 * 在 2026-09-15 的工程審查之前，PAGE_SIZE 散落在 8 個檔案、值不一致（8 / 20），
 * 而 `?page=` 的解析邏輯在 4 個 page.tsx 裡各複製一份。兩者都會安靜地出錯：
 * 分頁大小不同步會漏文章，解析邏輯漂移會讓某些頁面接受負數頁碼。
 *
 * 解析邏輯抽成純函式的第二個理由是可測試性 —— 內聯在 async page 元件裡的
 * `Math.max(1, parseInt(...))` 沒辦法單元測試。
 */

/** 文章類列表（首頁、類型、影展）每頁筆數。 */
export const ENTRY_PAGE_SIZE = 8;

/** 導演列表每頁筆數。導演卡片較小，一頁放得下更多。 */
export const DIRECTOR_PAGE_SIZE = 20;

/**
 * 把 `?page=` 的原始字串轉成合法頁碼。任何無法解析或小於 1 的值都落回第 1 頁。
 *
 *   undefined → 1      "3"    → 3      "abc" → 1
 *   ""        → 1      "-5"   → 1      "0"   → 1
 *   "2.7"     → 2      " 4 "  → 4
 */
export function parsePageParam(raw?: string): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
}

/** 頁碼轉 SQL offset。 */
export function offsetFor(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
