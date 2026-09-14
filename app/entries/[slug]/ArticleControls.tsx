"use client";

import { useArticlePrefs } from "./useArticlePrefs";
import { FONT_SIZES } from "@/lib/font-size";
import styles from "./ArticleControls.module.css";

/**
 * 字級加減按鈕。
 *
 * 重構前這裡有一個 useEffect 直接 `document.getElementById("main-content")
 * .style.setProperty("--article-font-size", ...)`：既是 hydration 後才執行
 * （造成閃爍），又用字串 id 抓一個身兼三職的 DOM 節點。
 * 現在字級由 <html data-font-size> + CSS 屬性選擇器接手，這裡只管 state。
 */
export function ArticleControls() {
  const { fontSize, setFontSize } = useArticlePrefs();
  const idx = FONT_SIZES.indexOf(fontSize);

  return (
    <div className={styles.controls} aria-label="字級控制">
      <button
        className={styles.btn}
        onClick={() => setFontSize(FONT_SIZES[idx - 1])}
        disabled={idx <= 0}
        aria-label="縮小字級"
        title="縮小字級"
      >
        A<sup>−</sup>
      </button>
      <button
        className={styles.btn}
        onClick={() => setFontSize(FONT_SIZES[idx + 1])}
        disabled={idx >= FONT_SIZES.length - 1}
        aria-label="放大字級"
        title="放大字級"
      >
        A<sup>+</sup>
      </button>
    </div>
  );
}
