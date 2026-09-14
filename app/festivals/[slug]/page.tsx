import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Masthead } from "@/components/layout/Masthead";
import { FESTIVALS, FESTIVAL_SLUG_TO_LABEL } from "@/lib/constants/festivals";
import { getEntriesByChip } from "@/lib/queries/entries";
import { EntryGrid } from "@/components/entries/EntryGrid";
import { ScrollToGrid } from "@/components/ui/ScrollToGrid";
import { GridAnchor } from "@/components/ui/GridAnchor";
import { EntryGridSkeleton } from "@/components/skeleton";
import { LazyReveal } from "@/components/ui/LazyReveal";
import { parsePageParam } from "@/lib/pagination";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

export function generateStaticParams() {
  return FESTIVALS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = FESTIVAL_SLUG_TO_LABEL[slug as keyof typeof FESTIVAL_SLUG_TO_LABEL];
  if (!label) return {};
  return { title: `${label} — 散場之後` };
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function FestivalPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const label = FESTIVAL_SLUG_TO_LABEL[slug as keyof typeof FESTIVAL_SLUG_TO_LABEL];
  if (!label) notFound();

  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

  return (
    <>
      <Masthead />
      <main className={styles.main} id={MAIN_CONTENT_ID}>
        <div className={styles.pageHeader}>
          <Link href="/festivals" className={styles.back} aria-label="返回影展列表">
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
            {/* key 放在 ViewTransition 而不是 Suspense（Next.js view-transitions
              guide 的 Step 4「同路由 crossfade」）：Suspense 不重新掛載，翻頁時
              舊內容會留在畫面上直到新內容備妥，再由 view transition 淡出淡入。
              骨架只在真正的冷載入（沒有舊內容可留）時出現。 */}
            <ViewTransition
              key={currentPage}
              name="list-grid"
              share="auto"
              enter="auto"
              default="none"
            >
              <EntryGrid
                page={currentPage}
                fetchPage={(limit, offset) => getEntriesByChip("festival", label, limit, offset)}
                gridClassName={styles.grid}
                basePath={`/festivals/${slug}`}
                empty={<p className={styles.empty}>此影展尚無文章。</p>}
              />
            </ViewTransition>
          </Suspense>
        </LazyReveal>
      </main>
    </>
  );
}
