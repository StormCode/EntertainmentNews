import { ENTRY_PAGE_SIZE } from "@/lib/pagination";
import { EntryCardSkeleton } from "./EntryCardSkeleton";

/**
 * 文章列表的 Suspense fallback。捲動錨點在 <GridAnchor /> 而非這裡 ——
 * 串流時骨架與內容會同時在 DOM 裡，帶同一個 id 會變成重複 id。
 */
export function EntryGridSkeleton({ className }: { className: string }) {
  return (
    <div className={className} aria-hidden="true">
      {[...Array(ENTRY_PAGE_SIZE)].map((_, i) => (
        <EntryCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** 導演列表的 Suspense fallback。導演卡片沒有骨架版本，只佔位並保留錨點。 */
export function DirectorGridSkeleton({ className }: { className: string }) {
  return <ul className={className} role="list" aria-hidden="true" />;
}
