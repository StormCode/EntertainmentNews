"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { GRID_ANCHOR_ID } from "@/lib/dom-ids";

/**
 * 翻頁後把畫面捲到 grid 頂端。
 *
 * 這是 2026-09-15 工程審查拆掉 client 分頁層時，唯一需要保留的行為（D4）。
 * 搭配 Pagination 的 `scroll={false}`：App Router 不跳頁首，由這裡精準捲到
 * 文章牆開頭，讀者不會停在分頁按鈕旁邊不知道發生了什麼。
 *
 * 它只讀 URL 與一個 ref，完全不碰資料 —— 跟被拆掉的那層是兩回事。
 *
 * ⚠️ 必須放在 keyed `<Suspense>` 的**外面**。放進去的話每次翻頁都會重新掛載，
 * `prevPage` 會被初始化成新頁碼，永遠偵測不到變化。
 * 同時因為用了 `useSearchParams`，呼叫端要自行包一層 `<Suspense fallback={null}>`。
 */
export function ScrollToGrid() {
  const searchParams = useSearchParams();
  const page = searchParams.get("page") ?? "1";
  const prevPage = useRef(page);

  useEffect(() => {
    if (page === prevPage.current) return; // 首次掛載或同一頁，不捲動
    prevPage.current = page;

    const target = document.getElementById(GRID_ANCHOR_ID);
    if (!target) return;

    // CSS 的 prefers-reduced-motion 管不到 JS 捲動，得自己判斷
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  }, [page]);

  return null;
}
