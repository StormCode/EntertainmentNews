import Link from "next/link";
import { Suspense } from "react";
import { Masthead } from "@/components/layout/Masthead";
import { DirectorGrid } from "@/components/directors/DirectorGrid";
import { ScrollToGrid } from "@/components/ui/ScrollToGrid";
import { GridAnchor } from "@/components/ui/GridAnchor";
import { DirectorGridSkeleton } from "@/components/skeleton";
import { DIRECTOR_PAGE_SIZE, offsetFor, parsePageParam } from "@/lib/pagination";
import { getDirectorsPaged } from "@/lib/queries/directors";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

// 只給裸標題 —— app/layout.tsx 的 template "%s — 散場之後" 會補後綴。
// 自己再寫一次會變成「導演 — 散場之後 — 散場之後」。
export const metadata = {
  title: "導演",
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function DirectorsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

  const directors = getDirectorsPaged(
    DIRECTOR_PAGE_SIZE,
    offsetFor(currentPage, DIRECTOR_PAGE_SIZE),
  );

  return (
    <>
      <Masthead />
      <main className={styles.main} id={MAIN_CONTENT_ID}>
        <div className={styles.pageHeader}>
          <Link href="/" className={styles.back} aria-label="返回首頁">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <h1 className={styles.heading}>導演</h1>
        </div>

        <Suspense fallback={null}>
          <ScrollToGrid />
        </Suspense>

        <GridAnchor />

        <Suspense fallback={<DirectorGridSkeleton className={styles.grid} />}>
          <DirectorGrid
            page={currentPage}
            data={directors}
            empty={<p className={styles.empty}>尚無導演資料。</p>}
          />
        </Suspense>
      </main>
    </>
  );
}
