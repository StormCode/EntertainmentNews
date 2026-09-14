import Link from "next/link";
import { Suspense } from "react";
import { Masthead } from "@/components/layout/Masthead";
import { DirectorGrid } from "@/components/directors/DirectorGrid";
import { ScrollToGrid } from "@/components/ui/ScrollToGrid";
import { parsePageParam } from "@/lib/pagination";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

export const metadata = {
  title: "導演 — 散場之後",
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function DirectorsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

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

        <Suspense
          key={currentPage}
          fallback={<ul className={styles.grid} role="list" aria-hidden="true" />}
        >
          <DirectorGrid
            page={currentPage}
            empty={<p className={styles.empty}>尚無導演資料。</p>}
          />
        </Suspense>
      </main>
    </>
  );
}
