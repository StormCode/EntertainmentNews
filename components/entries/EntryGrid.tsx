import type { ReactNode } from "react";
import { EntryCard } from "./EntryCard";
import { Pagination } from "@/components/ui/Pagination";
import type { EntryWithFilm } from "@/lib/queries/entries";

/**
 * 文章列表 grid —— async server component，資料擷取在元件內部。
 *
 * 資料流（2026-09-15 工程審查 D3）：
 *
 *   使用者點「下一頁」<Link href="?page=2" scroll={false}>
 *           │
 *           └──► App Router 導覽 → page.tsx 在伺服器重跑
 *                   └─► <Suspense key={2} fallback={骨架}>
 *                         └─► <EntryGrid page={2} fetchPage={...} />
 *                               └─► await fetchPage()   ← 唯一一次後端存取
 *                                     └─► 直接渲染，零 client state
 *           │
 *           └──► <ScrollToGrid /> 偵測 page 變了 → 捲到 #grid-top
 *
 * 關鍵：await 必須發生在「這個元件裡」，不能在父層 page.tsx。父層先 await
 * 的話，Suspense 邊界內沒有任何會 suspend 的東西，fallback 永遠不會顯示
 * （這正是重構前 app/page.tsx:80 的死碼狀態）。
 *
 * 資料以 promise 的形式由呼叫端傳入（server → server，不跨序列化邊界）。
 * 呼叫端持有同一個 promise，就能拿它當「文章已就緒」的閘門去排序頁面其他區塊
 * ——首頁的「探索類型」就是靠這個保證排在文章之後出現，而不是碰運氣。
 */
interface Props {
  /** 目前頁碼，已由 parsePageParam() 正規化。 */
  page: number;
  /** 這一頁的資料。呼叫端負責決定資料來源、每頁筆數與是否走快取。 */
  data: Promise<{ items: EntryWithFilm[]; hasNext: boolean }>;
  /** grid 容器的 CSS class，由各頁的 module.css 提供。 */
  gridClassName: string;
  /** 分頁連結的基底路徑，例如 "/" 或 "/genres/drama"。 */
  basePath: string;
  /** 真的沒有文章時顯示的內容（不是錯誤狀態，錯誤會拋到 error.tsx）。 */
  empty: ReactNode;
}

export async function EntryGrid({
  page,
  data,
  gridClassName,
  basePath,
  empty,
}: Props) {
  const { items, hasNext } = await data;

  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      {/* key={page} 讓每次翻頁重新掛載這個 div，CSS 的淡入動畫才會重播。
          不加 key 的話 React 會沿用同一個節點，動畫只在第一次跑。 */}
      <div key={page} className={gridClassName} data-paging-dim>
        {items.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
      <Pagination currentPage={page} hasNext={hasNext} basePath={basePath} />
    </>
  );
}
