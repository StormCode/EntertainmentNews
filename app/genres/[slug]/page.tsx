import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Masthead } from "@/components/layout/Masthead";
import { GENRES, GENRE_SLUG_TO_LABEL } from "@/lib/constants/genres";
import { getEntriesByGenre } from "@/lib/queries/entries";
import { EntryGrid } from "@/components/entries/EntryGrid";
import { ScrollToGrid } from "@/components/ui/ScrollToGrid";
import { GridAnchor } from "@/components/ui/GridAnchor";
import { EntryGridSkeleton } from "@/components/skeleton";
import { LazyReveal } from "@/components/ui/LazyReveal";
import { ENTRY_PAGE_SIZE, offsetFor, parsePageParam } from "@/lib/pagination";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

export function generateStaticParams() {
  return GENRES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = GENRE_SLUG_TO_LABEL[slug as keyof typeof GENRE_SLUG_TO_LABEL];
  if (!label) return {};
  return { title: `${label} — 散場之後` };
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function GenrePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const label = GENRE_SLUG_TO_LABEL[slug as keyof typeof GENRE_SLUG_TO_LABEL];
  if (!label) notFound();

  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

  // 不 await —— 交給 Suspense 邊界內的 EntryGrid 去解，頁面才不會被阻塞
  const entries = getEntriesByGenre(label, ENTRY_PAGE_SIZE, offsetFor(currentPage, ENTRY_PAGE_SIZE));

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
          <h1 className={styles.heading}>{label}</h1>
        </div>

        <Suspense fallback={null}>
          <ScrollToGrid />
        </Suspense>

        <GridAnchor />

        <LazyReveal>
          <Suspense fallback={<EntryGridSkeleton className={styles.grid} />}>
            <EntryGrid
              page={currentPage}
              data={entries}
              gridClassName={styles.grid}
              basePath={`/genres/${slug}`}
              empty={<p className={styles.empty}>此類型尚無文章。</p>}
            />
          </Suspense>
        </LazyReveal>
      </main>
    </>
  );
}
