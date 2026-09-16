import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PenLine, User, Film } from "lucide-react";
import { Masthead } from "@/components/layout/Masthead";
import {
  getDirectors,
  getDirectorSummaryBySlug,
  getDirectorTimeline,
  resolveDirectorSlug,
} from "@/lib/queries/directors";
import type { DirectorTimelineEntry } from "@/lib/queries/directors";
import { fetchDirectorFilmography, tmdbPosterUrl } from "@/lib/tmdb";
import { StickyNav } from "./StickyNav";
import styles from "./page.module.css";

export const revalidate = 14400;


export async function generateStaticParams() {
  try {
    const directors = await getDirectors();
    return directors.map((d) => ({ slug: d.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = await resolveDirectorSlug(slug).catch(() => null);
  if (!name) return {};
  // 裸標題即可，後綴由 app/layout.tsx 的 title.template 補上
  return { title: name };
}

type FilmItem = {
  tmdbId: number | null;
  displayTitle: string;
  posterUrl: string | null;
  releaseYear: number | null;
  review: { slug: string; title: string } | null;
};

export default async function DirectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let director: Awaited<ReturnType<typeof getDirectorSummaryBySlug>> = null;
  let localEntries: DirectorTimelineEntry[] = [];

  try {
    director = await getDirectorSummaryBySlug(slug);
    if (!director) notFound();
    localEntries = await getDirectorTimeline(director.name);
  } catch {
    if (!director) notFound();
  }

  // Index local entries by tmdbId for fast lookup
  type LocalData = {
    slug: string;
    reviewTitle: string;
    displayTitle: string;
    posterUrl: string | null;
    releaseYear: number | null;
  };
  const entryByTmdbId = new Map<number, LocalData>();
  const localEntriesNoTmdb: LocalData[] = [];

  for (const entry of localEntries) {
    const data: LocalData = {
      slug: entry.slug,
      reviewTitle: entry.title,
      displayTitle: entry.film?.titleZh ?? entry.film?.title ?? entry.title,
      posterUrl: entry.film?.posterUrl ?? null,
      releaseYear: entry.film?.releaseYear ?? null,
    };
    if (entry.film?.tmdbId) {
      entryByTmdbId.set(entry.film.tmdbId, data);
    } else {
      localEntriesNoTmdb.push(data);
    }
  }

  // Fetch full filmography from TMDB if we have a person ID
  const tmdbFilms = director!.tmdbPersonId
    ? await fetchDirectorFilmography(director!.tmdbPersonId)
    : [];

  // Build combined film items
  let filmItems: FilmItem[];

  if (tmdbFilms.length > 0) {
    filmItems = tmdbFilms.map((film) => {
      const local = entryByTmdbId.get(film.id);
      const year = film.release_date ? parseInt(film.release_date.slice(0, 4)) : null;
      return {
        tmdbId: film.id,
        displayTitle: local?.displayTitle ?? film.title,
        posterUrl: local?.posterUrl ?? (film.poster_path ? tmdbPosterUrl(film.poster_path) : null),
        releaseYear: local?.releaseYear ?? year,
        review: local ? { slug: local.slug, title: local.reviewTitle } : null,
      };
    });
    // Append local entries that didn't match any TMDB film
    for (const entry of localEntriesNoTmdb) {
      filmItems.push({
        tmdbId: null,
        displayTitle: entry.displayTitle,
        posterUrl: entry.posterUrl,
        releaseYear: entry.releaseYear,
        review: { slug: entry.slug, title: entry.reviewTitle },
      });
    }
  } else {
    // Fallback: only show local entries
    filmItems = [
      ...[...entryByTmdbId.entries()].map(([tmdbId, entry]) => ({
        tmdbId,
        displayTitle: entry.displayTitle,
        posterUrl: entry.posterUrl,
        releaseYear: entry.releaseYear,
        review: { slug: entry.slug, title: entry.reviewTitle },
      })),
      ...localEntriesNoTmdb.map((entry) => ({
        tmdbId: null,
        displayTitle: entry.displayTitle,
        posterUrl: entry.posterUrl,
        releaseYear: entry.releaseYear,
        review: { slug: entry.slug, title: entry.reviewTitle },
      })),
    ];
  }

  // Group by release year, descending
  const yearMap = new Map<number, FilmItem[]>();
  const unknownYearItems: FilmItem[] = [];

  for (const item of filmItems) {
    if (item.releaseYear) {
      const arr = yearMap.get(item.releaseYear) ?? [];
      arr.push(item);
      yearMap.set(item.releaseYear, arr);
    } else {
      unknownYearItems.push(item);
    }
  }

  const sortedYears = [...yearMap.keys()].sort((a, b) => b - a);
  const allYears = [...yearMap.keys()];
  const minYear = allYears.length ? Math.min(...allYears) : null;
  const maxYear = allYears.length ? Math.max(...allYears) : null;

  // Sidebar: only films with reviews (local entries)
  const reviewedFilms = filmItems
    .filter((f) => f.review !== null)
    .sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));

  return (
    <>
      <Masthead />
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <Link href="/directors" className={styles.back} aria-label="返回導演列表">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link href="/directors" className={styles.backLabel}>所有導演</Link>
        </div>
        <StickyNav directorName={director!.name} />

        <div className={styles.layout}>
          {/* Left: sticky director info */}
          <aside className={styles.sidebar}>
            <div className={styles.photoWrap}>
              {director!.photoUrl ? (
                <Image
                  src={director!.photoUrl}
                  alt={director!.name}
                  fill
                  sizes="240px"
                  className={styles.photoImg}
                />
              ) : (
                <div className={styles.photoPlaceholder} aria-hidden="true">
                  <User size={52} className={styles.photoIcon} />
                </div>
              )}
            </div>

            <h1 className={styles.directorName}>{director!.name}</h1>

            {(minYear || maxYear) && (
              <p className={styles.yearRange}>
                {minYear === maxYear ? `${minYear}` : `${minYear} — ${maxYear}`}
              </p>
            )}

            <p className={styles.entryCount}>
              {filmItems.length} 部作品
              <span className={styles.entryCountDot}>·</span>
              {director!.entryCount} 篇影評
            </p>

            {reviewedFilms.length > 0 && (
              <div className={styles.filmList}>
                <p className={styles.filmListLabel}>本站收錄</p>
                <ul className={styles.filmListItems} role="list">
                  {reviewedFilms.map(({ releaseYear, displayTitle, review }) => (
                    <li key={`${releaseYear}-${displayTitle}`} className={styles.filmListItem}>
                      {releaseYear && <span className={styles.filmListYear}>{releaseYear}</span>}
                      <Link href={`/entries/${review!.slug}`} className={styles.filmListLink}>
                        《{displayTitle}》
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Right: year timeline */}
          {filmItems.length === 0 ? (
            <p className={styles.empty}>此導演尚無資料。</p>
          ) : (
            <div className={styles.timeline}>
              {sortedYears.map((year) => (
                <div key={year} className={styles.yearGroup}>
                  <div className={styles.yearMarker}>
                    <span className={styles.yearDot} aria-hidden="true" />
                    <span className={styles.yearLabel}>{year}</span>
                  </div>
                  <div className={styles.yearEntries}>
                    {yearMap.get(year)!.map((item) => (
                      <FilmEntry key={`${item.tmdbId ?? item.displayTitle}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}

              {unknownYearItems.length > 0 && (
                <div className={styles.yearGroup}>
                  <div className={styles.yearMarker}>
                    <span className={styles.yearDot} aria-hidden="true" />
                    <span className={styles.yearLabel}>年份不詳</span>
                  </div>
                  <div className={styles.yearEntries}>
                    {unknownYearItems.map((item) => (
                      <FilmEntry key={`${item.tmdbId ?? item.displayTitle}`} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function FilmEntry({ item }: { item: FilmItem }) {
  const tmdbUrl = item.tmdbId ? `https://www.themoviedb.org/movie/${item.tmdbId}` : null;

  return (
    <div className={styles.filmEntry}>
      {/* Poster → TMDB */}
      {tmdbUrl ? (
        <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
           className={styles.entryPosterLink} tabIndex={-1} aria-hidden="true">
          <PosterThumb posterUrl={item.posterUrl} title={item.displayTitle} />
        </a>
      ) : item.review ? (
        <Link href={`/entries/${item.review.slug}`}
              className={styles.entryPosterLink} tabIndex={-1} aria-hidden="true">
          <PosterThumb posterUrl={item.posterUrl} title={item.displayTitle} />
        </Link>
      ) : (
        <PosterThumb posterUrl={item.posterUrl} title={item.displayTitle} />
      )}

      <div className={styles.entryInfo}>
        {/* Film name → TMDB (big title) */}
        {tmdbUrl ? (
          <a href={tmdbUrl} target="_blank" rel="noopener noreferrer" className={styles.entryFilmLink}>
            <h2 className={styles.entryFilmName}>《{item.displayTitle}》</h2>
          </a>
        ) : (
          <h2 className={styles.entryFilmName}>《{item.displayTitle}》</h2>
        )}

        {/* Review title — only shown if review exists */}
        {item.review && (
          <Link href={`/entries/${item.review.slug}`} className={styles.entryReviewLink}>
            <span className={styles.entryReviewRow}>
              <PenLine size={12} className={styles.entryReviewIcon} aria-hidden="true" />
              <span className={styles.entryReviewTitle}>{item.review.title}</span>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function PosterThumb({ posterUrl, title }: { posterUrl: string | null; title: string }) {
  return (
    <div className={styles.entryPoster}>
      {posterUrl ? (
        <Image src={posterUrl} alt={`《${title}》海報`} fill sizes="72px"
               className={styles.entryPosterImg} />
      ) : (
        <div className={styles.entryPosterPlaceholder} aria-hidden="true">
          <Film size={24} className={styles.entryPosterIcon} />
        </div>
      )}
    </div>
  );
}
