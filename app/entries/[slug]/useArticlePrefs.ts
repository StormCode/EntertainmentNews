"use client";

import { useState } from "react";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_STORAGE_KEY,
  parseStoredSize,
  type FontSize,
} from "@/lib/font-size";

/**
 * 字級偏好的讀寫。
 *
 * 初始值讀的是 `<html data-font-size>` —— 也就是 pre-paint inline script
 * 剛剛寫上去的值，而不是再讀一次 localStorage。這樣 React 的 state 與 DOM
 * 必然一致，不可能漂移（見 lib/font-size.ts 的 CRITICAL GAP #2 說明）。
 *
 * 寫入時同步更新 DOM 屬性與 localStorage；CSS 屬性選擇器負責套用字級，
 * 這裡不碰任何 element.style。
 */
export function useArticlePrefs() {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof document === "undefined") return DEFAULT_FONT_SIZE;
    return parseStoredSize(document.documentElement.dataset.fontSize);
  });

  function setFontSize(size: FontSize) {
    setFontSizeState(size);
    document.documentElement.dataset.fontSize = String(size);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size));
    } catch {
      // localStorage 不可用（無痕模式、企業政策）——本次工作階段仍然生效
    }
  }

  return { fontSize, setFontSize };
}
