/**
 * 跨元件共用的 DOM id。
 *
 * 2026-09-15 工程審查 D8：`#main-content` 原本身兼三職 —— 無障礙 skip link
 * 的目標、閱讀進度條的量測對象、目錄高亮的量測對象。前者要的是「這一頁的
 * 主要內容區」（每頁都有，語意隨頁面不同），後兩者要的是「文章內文那一塊」
 * （只有文章頁有）。今天不出事只因為那兩個元件目前只在文章頁渲染；哪天搬到
 * 搜尋頁，getElementById 會靜靜地量到錯的元素，不報錯也不警告。
 *
 * 集中在這裡是為了讓改名時三個呼叫點一起動，而不是漏掉一個然後靜默失效。
 */

/** 無障礙 skip link 的目標。每一頁的主要內容區都用它。 */
export const MAIN_CONTENT_ID = "main-content";

/** 文章內文本體。只有 /entries/[slug] 有，供閱讀進度條與目錄量測。 */
export const ARTICLE_BODY_ID = "article-body";

/** 列表 grid 的錨點，供 ScrollToGrid 翻頁後捲動。 */
export const GRID_ANCHOR_ID = "grid-top";
