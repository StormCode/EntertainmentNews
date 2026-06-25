"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db";
import { entries, films } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recomputeChips, recomputeGenreChips } from "@/lib/chips/recompute";
import { uploadFilmImages } from "@/lib/images/r2-upload";

interface UpdateEntryInput {
  entryId: number;
  slug: string;
  entryTitle: string;
  titleZh?: string;
  bodyMd: string;
  manualBackdropUrl?: string;
  imageCredit?: string;
  chips?: Array<{ label: string; kind: string; isLive?: boolean }>;
  genreLabels?: string[];
  publish?: boolean;
  unpublish?: boolean;
  heroFeatured?: boolean;
}

export async function updateEntry(input: UpdateEntryInput) {
  const { entryId, slug, entryTitle, titleZh, bodyMd, manualBackdropUrl, imageCredit, chips, genreLabels, publish, unpublish, heroFeatured } = input;

  const now = new Date();
  const publishedAt = publish ? now : unpublish ? null : undefined;

  await db
    .update(entries)
    .set({
      title: entryTitle,
      body_md: bodyMd,
      ...(manualBackdropUrl !== undefined ? { manual_backdrop_url: manualBackdropUrl || null } : {}),
      ...(imageCredit !== undefined ? { image_credit: imageCredit || null } : {}),
      ...(publish ? { is_published: true, published_at: publishedAt } : {}),
      ...(unpublish ? { is_published: false, published_at: null } : {}),
      ...(heroFeatured !== undefined ? { is_hero_featured: heroFeatured } : {}),
      updated_at: now,
    })
    .where(eq(entries.id, entryId));

  if (chips) {
    await recomputeChips(entryId, chips.map((c) => ({
      label: c.label,
      kind: c.kind as "streaming" | "festival" | "collaborator",
      is_live: c.isLive ? "1" : "0",
    })));
  }

  if (genreLabels !== undefined) {
    await recomputeGenreChips(entryId, genreLabels);
  }

  revalidateTag("entries", "max");
  revalidatePath("/");
  revalidatePath(`/entries/${slug}`);
  if (publish || unpublish) revalidatePath("/rss.xml");

  return { ok: true };
}

export async function updateFilmPoster(
  filmId: number,
  tmdbPosterPath: string
): Promise<{ posterUrl: string } | { error: string }> {
  const [film] = await db
    .select({ tmdb_id: films.tmdb_id })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);

  if (!film?.tmdb_id) return { error: "找不到影片" };

  const { posterUrl: r2Url } = await uploadFilmImages({
    tmdbId: film.tmdb_id,
    backdropTmdbPath: null,
    posterTmdbPath: tmdbPosterPath,
  });

  // R2 may not be configured — fall back to TMDB URL so the poster still updates
  const posterUrl = r2Url ?? `https://image.tmdb.org/t/p/w500${tmdbPosterPath}`;

  await db
    .update(films)
    .set({ poster_url: posterUrl })
    .where(eq(films.id, filmId));

  return { posterUrl };
}

export async function retryR2Upload(filmId: number) {
  const [film] = await db
    .select({ tmdb_id: films.tmdb_id, backdrop_url: films.backdrop_url, poster_url: films.poster_url })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);

  if (!film?.tmdb_id) return { error: "找不到影片" };

  // backdrop_url/poster_url at this point may be raw TMDB paths (not yet R2)
  const backdropPath = film.backdrop_url?.startsWith("/") ? film.backdrop_url : null;
  const posterPath = film.poster_url?.startsWith("/") ? film.poster_url : null;

  if (!backdropPath && !posterPath) return { error: "已無待處理的 TMDB 圖片路徑" };

  const { heroUrl, posterUrl } = await uploadFilmImages({
    tmdbId: film.tmdb_id,
    backdropTmdbPath: backdropPath,
    posterTmdbPath: posterPath,
  });

  if (!heroUrl && !posterUrl) return { error: "R2 上傳失敗，請稍後再試" };

  await db
    .update(films)
    .set({
      ...(heroUrl ? { backdrop_url: heroUrl } : {}),
      ...(posterUrl ? { poster_url: posterUrl } : {}),
    })
    .where(eq(films.id, filmId));

  return { ok: true };
}
