import { db } from "@/db";
import { entries, films, entryChips } from "@/db/schema";
import { eq, desc, asc, and, inArray, ne, or, ilike, lt, gt } from "drizzle-orm";
import { toExcerpt } from "@/lib/excerpt";

export type EntryWithFilm = {
  id: number;
  slug: string;
  title: string;
  backdropUrl: string | null;
  publishedAt: Date | null;
  snippet: string | null;
  film: {
    title: string;
    titleZh: string | null;
    director: string | null;
    runtimeMin: number | null;
    posterUrl: string | null;
    releaseYear: number | null;
  } | null;
  chips: Array<{ label: string; kind: string; isLive: string | null }>;
};

export async function getPublishedEntries(
  limit = 20,
  offset = 0,
): Promise<{ items: EntryWithFilm[]; hasNext: boolean }> {
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
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(eq(entries.is_published, true))
    .orderBy(desc(entries.published_at))
    .limit(limit + 1)
    .offset(offset);

  const hasNext = rows.length > limit;
  const sliced = hasNext ? rows.slice(0, limit) : rows;

  const entryIds = sliced.map((r) => r.id);
  const allChips =
    entryIds.length > 0
      ? await db
          .select({ entry_id: entryChips.entry_id, label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
          .from(entryChips)
          .where(inArray(entryChips.entry_id, entryIds))
      : [];

  return {
    items: sliced.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      backdropUrl: r.backdropUrl ?? r.manualBackdropUrl,
      publishedAt: r.publishedAt,
      snippet: toExcerpt(r.bodyMd ?? ""),
      film: r.filmTitle
        ? {
            title: r.filmTitle,
            titleZh: r.filmTitleZh,
            director: r.filmDirector,
            runtimeMin: r.filmRuntime,
            posterUrl: r.filmPosterUrl,
            releaseYear: r.filmReleaseYear,
          }
        : null,
      chips: allChips
        .filter((c) => c.entry_id === r.id)
        .map((c) => ({ label: c.label, kind: c.kind, isLive: c.is_live })),
    })),
    hasNext,
  };
}

export async function getHeroEntry(): Promise<EntryWithFilm | null> {
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
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(eq(entries.is_published, true))
    .orderBy(desc(entries.is_hero_featured), desc(entries.published_at))
    .limit(1);

  if (!rows[0]) return null;

  const genreChips = await db
    .select({ label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
    .from(entryChips)
    .where(and(eq(entryChips.entry_id, rows[0].id), eq(entryChips.kind, "genre")));

  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: r.filmTitle
      ? {
          title: r.filmTitle,
          titleZh: r.filmTitleZh,
          director: r.filmDirector,
          runtimeMin: r.filmRuntime,
          posterUrl: r.filmPosterUrl,
          releaseYear: r.filmReleaseYear,
        }
      : null,
    chips: genreChips.map((c) => ({ label: c.label, kind: c.kind, isLive: c.is_live })),
  };
}

export async function getHeroEntries(): Promise<EntryWithFilm[]> {
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
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(eq(entries.is_published, true))
    .orderBy(desc(entries.is_hero_featured), desc(entries.published_at))
    .limit(5);

  const entryIds = rows.map((r) => r.id);
  const allChips =
    entryIds.length > 0
      ? await db
          .select({ entry_id: entryChips.entry_id, label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
          .from(entryChips)
          .where(inArray(entryChips.entry_id, entryIds))
      : [];

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: r.filmTitle
      ? {
          title: r.filmTitle,
          titleZh: r.filmTitleZh,
          director: r.filmDirector,
          runtimeMin: r.filmRuntime,
          posterUrl: r.filmPosterUrl,
          releaseYear: r.filmReleaseYear,
        }
      : null,
    chips: allChips
      .filter((c) => c.entry_id === r.id)
      .map((c) => ({ label: c.label, kind: c.kind, isLive: c.is_live })),
  }));
}

type ChipKind = "streaming" | "festival" | "collaborator" | "genre";

export async function getEntriesByChip(
  kind: ChipKind,
  label: string,
  limit = 8,
  offset = 0,
): Promise<{ items: EntryWithFilm[]; hasNext: boolean }> {
  const matching = await db
    .select({ entry_id: entryChips.entry_id })
    .from(entryChips)
    .where(and(eq(entryChips.kind, kind), eq(entryChips.label, label)));

  if (matching.length === 0) return { items: [], hasNext: false };

  const ids = matching.map((r) => r.entry_id);

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
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(and(eq(entries.is_published, true), inArray(entries.id, ids)))
    .orderBy(desc(entries.published_at))
    .limit(limit + 1)
    .offset(offset);

  if (rows.length === 0) return { items: [], hasNext: false };

  const hasNext = rows.length > limit;
  const sliced = hasNext ? rows.slice(0, limit) : rows;

  const allChips = await db
    .select({ entry_id: entryChips.entry_id, label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
    .from(entryChips)
    .where(inArray(entryChips.entry_id, sliced.map((r) => r.id)));

  return {
    items: sliced.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
      publishedAt: r.publishedAt,
      snippet: toExcerpt(r.bodyMd ?? ""),
      film: r.filmTitle
        ? {
            title: r.filmTitle,
            titleZh: r.filmTitleZh,
            director: r.filmDirector,
            runtimeMin: r.filmRuntime,
            posterUrl: r.filmPosterUrl,
            releaseYear: r.filmReleaseYear,
          }
        : null,
      chips: allChips
        .filter((c) => c.entry_id === r.id)
        .map((c) => ({ label: c.label, kind: c.kind, isLive: c.is_live })),
    })),
    hasNext,
  };
}

export function getEntriesByGenre(
  genreLabel: string,
  limit = 8,
  offset = 0,
): Promise<{ items: EntryWithFilm[]; hasNext: boolean }> {
  return getEntriesByChip("genre", genreLabel, limit, offset);
}

export async function getEntriesByDirector(director: string, excludeEntryId: number): Promise<EntryWithFilm[]> {
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
      filmRuntimeMin: films.runtime_min,
      filmReleaseYear: films.release_year,
      filmPosterUrl: films.poster_url,
    })
    .from(entries)
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(
      and(
        eq(entries.is_published, true),
        eq(films.director, director),
        ne(entries.id, excludeEntryId)
      )
    )
    .orderBy(desc(entries.published_at))
    .limit(4);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: r.filmTitle
      ? {
          title: r.filmTitle,
          titleZh: r.filmTitleZh,
          director: r.filmDirector,
          runtimeMin: r.filmRuntimeMin,
          posterUrl: r.filmPosterUrl,
          releaseYear: r.filmReleaseYear,
        }
      : null,
    chips: [],
  }));
}

export async function getRelatedEntries(
  entryId: number,
  chipLabels: string[],
  limit = 4,
): Promise<EntryWithFilm[]> {
  const mapRow = (r: {
    id: number; slug: string; title: string; bodyMd: string;
    backdropUrl: string | null; manualBackdropUrl: string | null;
    publishedAt: Date | null; filmTitle: string | null; filmTitleZh: string | null;
    filmDirector: string | null; filmRuntimeMin: number | null;
    filmReleaseYear: number | null; filmPosterUrl: string | null;
  }): EntryWithFilm => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: r.filmTitle
      ? { title: r.filmTitle, titleZh: r.filmTitleZh, director: r.filmDirector,
          runtimeMin: r.filmRuntimeMin, posterUrl: r.filmPosterUrl, releaseYear: r.filmReleaseYear }
      : null,
    chips: [],
  });

  if (chipLabels.length > 0) {
    const matched = await db
      .selectDistinct({ entry_id: entryChips.entry_id })
      .from(entryChips)
      .where(and(inArray(entryChips.label, chipLabels), ne(entryChips.entry_id, entryId)));

    const ids = matched.map((r) => r.entry_id);
    if (ids.length > 0) {
      const rows = await db.select({
        id: entries.id, slug: entries.slug, title: entries.title, bodyMd: entries.body_md,
        backdropUrl: entries.backdrop_url, manualBackdropUrl: entries.manual_backdrop_url,
        publishedAt: entries.published_at, filmTitle: films.title, filmTitleZh: films.title_zh,
        filmDirector: films.director, filmRuntimeMin: films.runtime_min,
        filmReleaseYear: films.release_year, filmPosterUrl: films.poster_url,
      })
      .from(entries)
      .leftJoin(films, eq(entries.primary_film_id, films.id))
      .where(and(eq(entries.is_published, true), inArray(entries.id, ids)))
      .orderBy(desc(entries.published_at))
      .limit(limit);
      if (rows.length >= limit) return rows.map(mapRow);
    }
  }

  // fallback: most recent published entries
  const rows = await db.select({
    id: entries.id, slug: entries.slug, title: entries.title, bodyMd: entries.body_md,
    backdropUrl: entries.backdrop_url, manualBackdropUrl: entries.manual_backdrop_url,
    publishedAt: entries.published_at, filmTitle: films.title, filmTitleZh: films.title_zh,
    filmDirector: films.director, filmRuntimeMin: films.runtime_min,
    filmReleaseYear: films.release_year, filmPosterUrl: films.poster_url,
  })
  .from(entries)
  .leftJoin(films, eq(entries.primary_film_id, films.id))
  .where(and(eq(entries.is_published, true), ne(entries.id, entryId)))
  .orderBy(desc(entries.published_at))
  .limit(limit);

  return rows.map(mapRow);
}

export type AdjacentEntry = {
  slug: string;
  entryTitle: string;
  filmTitle: string;
};

export async function getAdjacentEntries(publishedAt: Date): Promise<{
  prev: AdjacentEntry | null;
  next: AdjacentEntry | null;
}> {
  const pick = (r: { slug: string; entryTitle: string; filmTitle: string | null; filmTitleZh: string | null; }): AdjacentEntry => ({
    slug: r.slug,
    entryTitle: r.entryTitle,
    filmTitle: r.filmTitleZh ?? r.filmTitle ?? r.entryTitle,
  });

  const fields = {
    slug: entries.slug,
    entryTitle: entries.title,
    filmTitle: films.title,
    filmTitleZh: films.title_zh,
  };

  const [prevRows, nextRows] = await Promise.all([
    db.select(fields)
      .from(entries)
      .leftJoin(films, eq(entries.primary_film_id, films.id))
      .where(and(eq(entries.is_published, true), lt(entries.published_at, publishedAt)))
      .orderBy(desc(entries.published_at))
      .limit(1),
    db.select(fields)
      .from(entries)
      .leftJoin(films, eq(entries.primary_film_id, films.id))
      .where(and(eq(entries.is_published, true), gt(entries.published_at, publishedAt)))
      .orderBy(asc(entries.published_at))
      .limit(1),
  ]);

  return {
    prev: prevRows[0] ? pick(prevRows[0]) : null,
    next: nextRows[0] ? pick(nextRows[0]) : null,
  };
}

export async function searchEntries(query: string): Promise<EntryWithFilm[]> {
  if (!query.trim()) return [];
  const q = `%${query.trim()}%`;
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
      filmRuntimeMin: films.runtime_min,
      filmReleaseYear: films.release_year,
      filmPosterUrl: films.poster_url,
    })
    .from(entries)
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(
      and(
        eq(entries.is_published, true),
        or(
          ilike(entries.title, q),
          ilike(entries.body_md, q),
          ilike(films.title, q),
          ilike(films.title_zh, q),
        )
      )
    )
    .orderBy(desc(entries.published_at))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    backdropUrl: r.manualBackdropUrl ?? r.backdropUrl,
    publishedAt: r.publishedAt,
    snippet: toExcerpt(r.bodyMd ?? ""),
    film: r.filmTitle
      ? {
          title: r.filmTitle,
          titleZh: r.filmTitleZh,
          director: r.filmDirector,
          runtimeMin: r.filmRuntimeMin,
          posterUrl: r.filmPosterUrl,
          releaseYear: r.filmReleaseYear,
        }
      : null,
    chips: [],
  }));
}

export async function getEntryBySlug(slug: string) {
  const row = await db
    .select()
    .from(entries)
    .leftJoin(films, eq(entries.primary_film_id, films.id))
    .where(and(eq(entries.slug, slug), eq(entries.is_published, true)))
    .limit(1);

  if (!row[0]) return null;

  const chips = await db
    .select({ label: entryChips.label, kind: entryChips.kind, is_live: entryChips.is_live })
    .from(entryChips)
    .where(eq(entryChips.entry_id, row[0].entries.id));

  return { entry: row[0].entries, film: row[0].films, chips };
}

export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: entries.slug })
    .from(entries)
    .where(eq(entries.is_published, true));
  return rows.map((r) => r.slug);
}
