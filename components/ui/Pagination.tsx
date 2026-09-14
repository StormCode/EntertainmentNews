import Link from "next/link";
/**
 * prefetch={false} 是 useLinkStatus 生效的前提 —— Next.js 文件明寫
 * 「If the linked route has been prefetched, the pending state will be skipped」。
 * 預取開著的時候 PaginationPending 永遠不會回報 pending，淡化等於沒做。
 * 分頁是動態路由，預取本來就幫不上多少忙，換成載入回饋比較划算。
 */
import { PaginationPending } from "./PaginationPending";
import styles from "./Pagination.module.css";

interface Props {
  currentPage: number;
  hasNext: boolean;
  basePath: string;
}

export function Pagination({ currentPage, hasNext, basePath }: Props) {
  const hasPrev = currentPage > 1;
  const prevHref = currentPage === 2 ? basePath : `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;

  return (
    <nav className={styles.pagination} aria-label="分頁導航">
      {hasPrev ? (
        <Link
          href={prevHref}
          className={styles.btn}
          aria-label="上一頁"
          scroll={false}
          prefetch={false}
        >
          ←
          <PaginationPending />
        </Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`} aria-disabled="true" aria-label="上一頁">
          ←
        </span>
      )}
      {hasNext ? (
        <Link
          href={nextHref}
          className={styles.btn}
          aria-label="下一頁"
          scroll={false}
          prefetch={false}
        >
          →
          <PaginationPending />
        </Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`} aria-disabled="true" aria-label="下一頁">
          →
        </span>
      )}
    </nav>
  );
}
