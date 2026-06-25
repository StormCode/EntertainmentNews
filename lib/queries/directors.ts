import { db } from "@/db";
import { entries, films, entryChips, directors } from "@/db/schema";
import { eq, desc, and, isNotNull, inArray, sql } from "drizzle-orm";
import { directorToSlug } from "@/lib/directors";
import { toExcerpt } from "@/lib/excerpt";
import type { EntryWithFilm } from "./entries";

export type DirectorSummary = {
  name: string;
  slug: string;
  entryCount: number;
  photoUrl: string | null;
  tmdbPersonId: number | null;
};

export async function getDirectors(): Promise<DirectorSummary[]> {
  const rows = await db
    .select({
      director: films.director,
      entryCount: sql<number>`cast(count(${entries.id}) as int)`,
      photoUrl: directors.photo_url,
      tmdbPersonId: directors.tmdb_person_id,
    })
    .from(entries)
    .innerJoin(films, eq(entries.primary_film_id, films.id))
    .leftJoin(directors, eq(directors.name, films.director))
    .where(and(eq(entries.is_published, true), isNotNull(films.director)))
    .groupBy(films.director, directors.photo_url, directors.tmdb_person_id)
    .orderBy(sql`count(${entries.id}) desc`, films.director);

  return rows
    .filter((r) => r.director !== null)
    .map((r) => ({
      name: r.director!,
      slug: directorToSlug(r.director!),
      entryCount: r.entryCount,
      photoUrl: r.photoUrl,
      tmdbPersonId: r.tmdbPersonId,
    }));
}

export async function getEntriesByDirectorName(directorName: string): Promise<EntryWithFilm[]> {
  const rows = await db
    .select({
      id: entries.id,
      slug: entries.slug,
      title: entries.title,
      bodyMd: entries.body_md,
      backdropUrl: entries.backdrop_url,
      manualBackdropUrl: entries.manual_backdrop_url,
      publishedAt: entries.published_at,
      filmTitle: films.title,
      filmTitleZh: films.title_zh,
      filmDirector: films.director,
      filmRuntime: films.runtime_min,
      filmReleaseYear: films.release_year,
      filmPosterUrl: films.poster_url,
    })
    .from(entries)
    .innerJoin(films, eq(entries.primary_film_id, films.id))
    .where(and(eq(entries.is_published, true), eq(films.director, directorName)))
    .orderBy(sql`${films.release_year} DESC NULLS LAST`, desc(entries.published_at));

  if (rows.length === 0) return [];

  const allChips = await db
    .select({ entry_id: entryChips.entry_id, label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
    .from(entryChips)
    .where(inArray(entryChips.entry_id, rows.map((r) => r.id)));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: {
      title: r.filmTitle,
      titleZh: r.filmTitleZh,
      director: r.filmDirector,
      runtimeMin: r.filmRuntime,
      posterUrl: r.filmPosterUrl,
      releaseYear: r.filmReleaseYear,
    },
    chips: allChips
      .filter((c) => c.entry_id === r.id)
      .map((c) => ({ label: c.label, kind: c.kind, isLive: c.is_live })),
  }));
}

export type DirectorTimelineEntry = {
  id: number;
  slug: string;
  title: string;
  film: {
    title: string;
    titleZh: string | null;
    posterUrl: string | null;
    releaseYear: number | null;
    tmdbId: number | null;
  } | null;
};

export async function getDirectorTimeline(directorName: string): Promise<DirectorTimelineEntry[]> {
  const rows = await db
    .select({
      id: entries.id,
      slug: entries.slug,
      title: entries.title,
      filmTitle: films.title,
      filmTitleZh: films.title_zh,
      filmPosterUrl: films.poster_url,
      filmReleaseYear: films.release_year,
      filmTmdbId: films.tmdb_id,
    })
    .from(entries)
    .innerJoin(films, eq(entries.primary_film_id, films.id))
    .where(and(eq(entries.is_published, true), eq(films.director, directorName)))
    .orderBy(sql`${films.release_year} DESC NULLS LAST`, desc(entries.published_at));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    film: {
      title: r.filmTitle,
      titleZh: r.filmTitleZh,
      posterUrl: r.filmPosterUrl,
      releaseYear: r.filmReleaseYear,
      tmdbId: r.filmTmdbId,
    },
  }));
}

export async function getDirectorsPaged(
  limit = 20,
  offset = 0,
): Promise<{ items: DirectorSummary[]; hasNext: boolean }> {
  const rows = await db
    .select({
      director: films.director,
      entryCount: sql<number>`cast(count(${entries.id}) as int)`,
      photoUrl: directors.photo_url,
      tmdbPersonId: directors.tmdb_person_id,
    })
    .from(entries)
    .innerJoin(films, eq(entries.primary_film_id, films.id))
    .leftJoin(directors, eq(directors.name, films.director))
    .where(and(eq(entries.is_published, true), isNotNull(films.director)))
    .groupBy(films.director, directors.photo_url, directors.tmdb_person_id)
    .orderBy(sql`count(${entries.id}) desc`, films.director)
    .limit(limit + 1)
    .offset(offset);

  const hasNext = rows.length > limit;
  const sliced = hasNext ? rows.slice(0, limit) : rows;

  return {
    items: sliced
      .filter((r) => r.director !== null)
      .map((r) => ({
        name: r.director!,
        slug: directorToSlug(r.director!),
        entryCount: r.entryCount,
        photoUrl: r.photoUrl,
        tmdbPersonId: r.tmdbPersonId,
      })),
    hasNext,
  };
}

export async function getDirectorSummaryBySlug(slug: string): Promise<DirectorSummary | null> {
  const all = await getDirectors();
  return all.find((d) => d.slug === slug) ?? null;
}

export async function resolveDirectorSlug(slug: string): Promise<string | null> {
  const found = await getDirectorSummaryBySlug(slug);
  return found?.name ?? null;
}
