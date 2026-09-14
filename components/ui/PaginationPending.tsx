"use client";

import { useEffect } from "react";
import { useLinkStatus } from "next/link";

/**
 * 翻頁載入中的指示器 —— 放在 Pagination 的 <Link> 內部。
 *
 * `useLinkStatus` 只在 <Link> 的子孫元件裡有效，而 grid 不是 Link 的子孫，
 * 所以這裡把狀態寫成 <html data-paginating>，由 globals.css 的屬性選擇器
 * 去淡化 grid。傳遞的是一個布林值，不是資料 —— 伺服器仍然是唯一的資料來源。
 *
 * 2026-09-15：原本用 view transition 做淡出淡入，但第 1 頁 8 篇、第 2 頁 2 篇
 * 的高度差會讓探索類型先被頂上去再被壓下來。改回重構前的作法：舊內容原地
 * 變半透明等新資料，就位才換，版面只在最後那一瞬變動一次。
 */
export function PaginationPending() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    const root = document.documentElement;
    if (pending) {
      root.dataset.paginating = "true";
      return () => {
        delete root.dataset.paginating;
      };
    }
    delete root.dataset.paginating;
  }, [pending]);

  return null;
}
