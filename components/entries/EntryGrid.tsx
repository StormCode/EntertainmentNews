import type { ReactNode } from "react";
import { EntryCard } from "./EntryCard";
import { Pagination } from "@/components/ui/Pagination";
import { ENTRY_PAGE_SIZE, offsetFor } from "@/lib/pagination";
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
 * `fetchPage` 是 server → server 的 props，不跨序列化邊界，所以可以傳函式。
 */
interface Props {
  /** 目前頁碼，已由 parsePageParam() 正規化。 */
  page: number;
  /** 取這一頁的資料。由呼叫端決定資料來源與是否走快取。 */
  fetchPage: (
    limit: number,
    offset: number,
  ) => Promise<{ items: EntryWithFilm[]; hasNext: boolean }>;
  /** grid 容器的 CSS class，由各頁的 module.css 提供。 */
  gridClassName: string;
  /** 分頁連結的基底路徑，例如 "/" 或 "/genres/drama"。 */
  basePath: string;
  /** 真的沒有文章時顯示的內容（不是錯誤狀態，錯誤會拋到 error.tsx）。 */
  empty: ReactNode;
}

export async function EntryGrid({
  page,
  fetchPage,
  gridClassName,
  basePath,
  empty,
}: Props) {
  const { items, hasNext } = await fetchPage(
    ENTRY_PAGE_SIZE,
    offsetFor(page, ENTRY_PAGE_SIZE),
  );

  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <div className={gridClassName}>
        {items.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
      <Pagination currentPage={page} hasNext={hasNext} basePath={basePath} />
    </>
  );
}
