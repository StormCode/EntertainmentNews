import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { DIRECTOR_PAGE_SIZE, offsetFor } from "@/lib/pagination";
import { GRID_ANCHOR_ID } from "@/lib/dom-ids";
import { getDirectorsPaged } from "@/lib/queries/directors";
import styles from "@/app/directors/page.module.css";

/**
 * 導演列表 grid —— async server component。
 * 結構與 EntryGrid 相同（見該檔的資料流圖），差別只在渲染的卡片與每頁筆數。
 * 沒有抽成共用泛型元件：兩者的卡片標記完全不同，硬抽只會多一層 render prop。
 */
interface Props {
  page: number;
  empty: ReactNode;
}

export async function DirectorGrid({ page, empty }: Props) {
  const { items, hasNext } = await getDirectorsPaged(
    DIRECTOR_PAGE_SIZE,
    offsetFor(page, DIRECTOR_PAGE_SIZE),
  );

  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <ul id={GRID_ANCHOR_ID} className={styles.grid} role="list">
        {items.map((d) => (
          <li key={d.slug}>
            <Link href={`/directors/${d.slug}`} className={styles.card}>
              <div className={styles.poster}>
                {d.photoUrl ? (
                  <Image
                    src={d.photoUrl}
                    alt={d.name}
                    fill
                    sizes="(max-width: 599px) 40vw, (max-width: 899px) 20vw, 14vw"
                    className={styles.posterImg}
                  />
                ) : (
                  <div className={styles.posterPlaceholder} aria-hidden="true">
                    <User size={32} className={styles.posterIcon} />
                  </div>
                )}
              </div>
              <p className={styles.name}>{d.name}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination currentPage={page} hasNext={hasNext} basePath="/directors" />
    </>
  );
}
