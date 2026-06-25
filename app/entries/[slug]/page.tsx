import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Masthead } from "@/components/layout/Masthead";
import { Chip } from "@/components/ui/Chip";
import { getEntryBySlug, getRelatedEntries, getAdjacentEntries, getPublishedSlugs } from "@/lib/queries/entries";
import Image from "next/image";
import { renderMarkdown, wordCount } from "@/lib/markdown/render";
import { LazyReveal } from "@/components/ui/LazyReveal";
import { ReadingProgress } from "./ReadingProgress";
import { TableOfContents } from "./TableOfContents";
import { ArticleControls } from "./ArticleControls";
import { BackToTop } from "./BackToTop";
import styles from "./page.module.css";

export const revalidate = 14400;

export async function generateStaticParams() {
  try {
    const slugs = await getPublishedSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const result = await getEntryBySlug(decodedSlug);
  if (!result) return {};

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afterhours.film";
  const filmTitle = result.film?.title_zh ?? result.film?.title ?? result.entry.title;
  const ogImageUrl = `${SITE_URL}/og?slug=${encodeURIComponent(decodedSlug)}`;

  return {
    title: `《${filmTitle}》`,
    description: result.entry.title,
    openGraph: {
      title: `《${filmTitle}》— 散場之後`,
      description: result.entry.title,
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `《${filmTitle}》— 散場之後`,
      description: result.entry.title,
      images: [ogImageUrl],
    },
  };
}

export default async function EntryPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const result = await getEntryBySlug(decodedSlug);

  if (!result) notFound();

  const { entry, film, chips } = result;
  const filmTitle = film?.title_zh ?? film?.title ?? entry.title;
  const backdropUrl = entry.backdrop_url ?? entry.manual_backdrop_url;

  const chipLabels = chips.map((c) => c.label);
  const [relatedEntries, adjacent] = await Promise.all([
    getRelatedEntries(entry.id, chipLabels),
    entry.published_at ? getAdjacentEntries(entry.published_at) : Promise.resolve({ prev: null, next: null }),
  ]);
  const imageCredit = entry.image_credit ?? null;

  const { html: bodyHtml, headings } = await renderMarkdown(entry.body_md);
  const readingMin = wordCount(entry.body_md);

  return (
    <>
      <Masthead />
      <ReadingProgress />

      {/* Full-bleed backdrop header */}
      <header className={styles.articleHeader}>
        {backdropUrl ? (
          <div
            className={styles.backdrop}
            style={{ backgroundImage: `url(${backdropUrl})` }}
            role="img"
            aria-label={`《${filmTitle}》劇照`}
          >
            <div className={styles.heroGradient} />
            {imageCredit && (
              <p className={styles.imageCredit}>圖片來源：{imageCredit}</p>
            )}
          </div>
        ) : (
          <div className={styles.backdropPlaceholder} />
        )}

        {/* Film identity block */}
        <div className={styles.identity}>
          <h1 className={styles.title}>《{filmTitle}》</h1>
          <p className={styles.entryTitle}>{entry.title}</p>
          <p className={`${styles.meta} date`}>
            {film?.director && <span>{film.director}</span>}
            {film?.runtime_min && film.director && <span> · </span>}
            {film?.runtime_min && <span>{film.runtime_min} min</span>}
            {entry.published_at && (
              <>
                <span> · </span>
                <time dateTime={entry.published_at.toISOString()}>
                  {entry.published_at.toLocaleDateString("zh-TW", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "Asia/Taipei",
                  })}
                </time>
              </>
            )}
            <span> · </span>
            <span>約 {readingMin} 分鐘閱讀</span>
          </p>
          {chips.length > 0 && (
            <div className={styles.chips}>
              {chips.map((c) => (
                <Chip key={c.label} label={c.label} live={c.is_live === "true"} />
              ))}
            </div>
          )}
        </div>

        <hr className={styles.rule} />
      </header>

      <div className={styles.contentGrid}>
        <aside className={styles.tocSidebar}>
          <TableOfContents headings={headings} />
        </aside>
        {/* Article body — 800px column; grid handles centering on wide viewports */}
        <article
          id="main-content"
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
          aria-label={`${filmTitle} 文章內文`}
        />
      </div>

      {relatedEntries.length > 0 && (
        <LazyReveal>
          <section className={styles.related} aria-label="相關文章">
            <h2 className={styles.relatedHeading}>相關文章</h2>
            <ul className={styles.relatedList} role="list">
              {relatedEntries.map((e) => {
                const filmTitle = e.film?.titleZh ?? e.film?.title ?? e.title;
                const posterUrl = e.film?.posterUrl ?? null;
                return (
                  <li key={e.id}>
                    <Link href={`/entries/${e.slug}`} className={styles.relatedItem}>
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={filmTitle}
                          width={52}
                          height={78}
                          className={styles.relatedPoster}
                        />
                      ) : (
                        <div className={styles.relatedPosterPlaceholder} />
                      )}
                      <div className={styles.relatedContent}>
                        <span className={styles.relatedFilmTitle}>《{filmTitle}》</span>
                        <span className={styles.relatedEntryTitle}>{e.title}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </LazyReveal>
      )}

      {(adjacent.prev || adjacent.next) && (
        <nav className={styles.adjacentNav} aria-label="上下篇導覽">
          <div className={styles.adjacentInner}>
            {adjacent.prev ? (
              <Link href={`/entries/${adjacent.prev.slug}`} className={`${styles.adjacentLink} ${styles.adjacentPrev}`}>
                <span className={styles.adjacentDirection}>← 上一篇</span>
                <span className={styles.adjacentFilm}>《{adjacent.prev.filmTitle}》</span>
                <span className={styles.adjacentEntry}>{adjacent.prev.entryTitle}</span>
              </Link>
            ) : <div />}
            {adjacent.next ? (
              <Link href={`/entries/${adjacent.next.slug}`} className={`${styles.adjacentLink} ${styles.adjacentNext}`}>
                <span className={styles.adjacentDirection}>下一篇 →</span>
                <span className={styles.adjacentFilm}>《{adjacent.next.filmTitle}》</span>
                <span className={styles.adjacentEntry}>{adjacent.next.entryTitle}</span>
              </Link>
            ) : <div />}
          </div>
        </nav>
      )}

      <ArticleControls />
      <BackToTop />
    </>
  );
}
