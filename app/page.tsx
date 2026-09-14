export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { Masthead } from "@/components/layout/Masthead";
import { GenreGrid } from "@/components/genres/GenreGrid";
import { HeroCarousel } from "@/components/hero/HeroCarousel";
import { HeroSkeleton, EntryCardSkeleton } from "@/components/skeleton";
import { getPublishedEntries, getHeroEntries, type EntryWithFilm } from "@/lib/queries/entries";
import { EntryGrid } from "@/components/entries/EntryGrid";
import { ScrollToGrid } from "@/components/ui/ScrollToGrid";
import { LazyReveal } from "@/components/ui/LazyReveal";
import { ENTRY_PAGE_SIZE, parsePageParam } from "@/lib/pagination";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

// Cache DB reads across requests — data changes only on publish/unpublish.
// revalidateTag('entries') in admin actions clears these immediately on change.
//
// 注意：unstable_cache 會 JSON 序列化回傳值，Date 進去出來會變字串。
// 下面的 toIso / reviveEntry 是為了這件事，不是為了跨 client 邊界
// （EntryGrid 是 server component，props 不經過序列化）。
const getCachedHeroEntries = unstable_cache(
  async () => {
    const items = await getHeroEntries();
    return items.map(toIso);
  },
  ["hero-entries"],
  { revalidate: 14400, tags: ["entries"] },
);

const getCachedPublishedEntries = unstable_cache(
  async (limit: number, offset: number) => {
    const { items, hasNext } = await getPublishedEntries(limit, offset);
    return { items: items.map(toIso), hasNext };
  },
  ["published-entries"],
  { revalidate: 14400, tags: ["entries"] },
);

async function fetchHomeEntries(limit: number, offset: number) {
  const { items, hasNext } = await getCachedPublishedEntries(limit, offset);
  return { items: items.map(reviveEntry), hasNext };
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function Hero() {
  const cached = await getCachedHeroEntries();
  return <HeroCarousel entries={cached.map(reviveEntry)} />;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const currentPage = parsePageParam(pageParam);

  return (
    <>
      <Masthead />

      {/* Hero — full-bleed 21:9 (desktop) / 16:9 (tablet) / 4:3 (mobile) */}
      <section className={styles.heroSection} aria-label="精選文章">
        <Suspense fallback={<HeroSkeleton />}>
          <Hero />
        </Suspense>
      </section>

      {/* Poster wall — full-width, no sidebar */}
      <main id={MAIN_CONTENT_ID} className={styles.main} aria-label="文章牆">
        {/* 必須在 keyed Suspense 外面，否則每次翻頁重新掛載就偵測不到頁碼變化 */}
        <Suspense fallback={null}>
          <ScrollToGrid />
        </Suspense>

        <LazyReveal>
          {/* key={currentPage} 讓每次翻頁重新觸發邊界，骨架才會顯示 */}
          <Suspense
            key={currentPage}
            fallback={
              <div className={styles.entryGrid}>
                {[...Array(ENTRY_PAGE_SIZE)].map((_, i) => (
                  <EntryCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <EntryGrid
              page={currentPage}
              fetchPage={fetchHomeEntries}
              gridClassName={styles.entryGrid}
              basePath="/"
              empty={<p className={styles.emptyState}>暫無文章。</p>}
            />
          </Suspense>
        </LazyReveal>
      </main>

      {/* Genre discovery — bottom of page */}
      <LazyReveal>
        <GenreGrid />
      </LazyReveal>
    </>
  );
}

type SerializedEntry = Omit<EntryWithFilm, "publishedAt"> & { publishedAt: string | null };

function toIso(entry: EntryWithFilm): SerializedEntry {
  return { ...entry, publishedAt: entry.publishedAt?.toISOString() ?? null };
}

function reviveEntry(entry: SerializedEntry): EntryWithFilm {
  return { ...entry, publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null };
}
