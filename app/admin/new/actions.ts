"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db";
import { films, entries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchTmdbFilm } from "@/lib/tmdb";
import { recomputeGenreChips } from "@/lib/chips/recompute";
import { uploadFilmImages } from "@/lib/images/r2-upload";

// Fetch TMDB data for admin autofill
export async function fetchFilmData(
  tmdbUrl: string
): Promise<{ error: string } | { film: NonNullable<Awaited<ReturnType<typeof fetchTmdbFilm>>> }> {
  try {
    const film = await fetchTmdbFilm(tmdbUrl);
    if (!film) return { error: "找不到影片，請確認 TMDB 網址" };
    return { film };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知錯誤";
    return { error: `TMDB 查詢失敗：${msg}` };
  }
}

interface SaveEntryInput {
  tmdbUrl?: string;
  titleZh?: string;
  entryTitle: string;
  bodyMd: string;
  manualBackdropUrl?: string;
  imageCredit?: string;
  genreLabels?: string[];
  publish: boolean;
  selectedPosterPath?: string;
}

export async function saveEntry(input: SaveEntryInput) {
  const { tmdbUrl, titleZh, entryTitle, bodyMd, manualBackdropUrl, imageCredit, genreLabels, publish, selectedPosterPath } = input;

  let filmId: number | null = null;

  // Upsert film if TMDB URL provided
  if (tmdbUrl) {
    const tmdbFilm = await fetchTmdbFilm(tmdbUrl);
    if (tmdbFilm) {
      const existing = await db
        .select({ id: films.id })
        .from(films)
        .where(eq(films.tmdb_id, tmdbFilm.tmdbId))
        .limit(1);

      if (existing[0]) {
        filmId = existing[0].id;
      } else {
        const inserted = await db
          .insert(films)
          .values({
            tmdb_id: tmdbFilm.tmdbId,
            title: tmdbFilm.title,
            title_zh: titleZh ?? null,
            director: tmdbFilm.director,
            runtime_min: tmdbFilm.runtimeMin,
            release_year: tmdbFilm.releaseYear,
            backdrop_url: tmdbFilm.backdropPath,  // raw TMDB URL; R2 upload in background
            poster_url: selectedPosterPath
              ? `https://image.tmdb.org/t/p/w500${selectedPosterPath}`
              : tmdbFilm.posterPath,
            tmdb_data: tmdbFilm.rawJson,
          })
          .returning({ id: films.id });
        filmId = inserted[0].id;

        // Kick off R2 upload in background — entry saves even if this fails (eng D14)
        uploadFilmImages({
          tmdbId: tmdbFilm.tmdbId,
          backdropTmdbPath: tmdbFilm.backdropPath,
          posterTmdbPath: selectedPosterPath ?? tmdbFilm.posterPath,
        })
          .then(async ({ heroUrl, posterUrl }) => {
            if (heroUrl || posterUrl) {
              await db
                .update(films)
                .set({
                  ...(heroUrl ? { backdrop_url: heroUrl } : {}),
                  ...(posterUrl ? { poster_url: posterUrl } : {}),
                })
                .where(eq(films.id, filmId!));
            }
          })
          .catch(() => {
            // R2 failure is non-fatal — admin shows "圖片待補" (eng D14)
          });
      }
    }
  }

  // Generate slug from entry title
  const slug = entryTitle
    .toLowerCase()
    .replace(/[《》「」【】、，。！？]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9一-鿿-]/g, "")
    .slice(0, 60)
    + `-${Date.now().toString(36)}`;

  const [entry] = await db
    .insert(entries)
    .values({
      slug,
      title: entryTitle,
      body_md: bodyMd,
      manual_backdrop_url: manualBackdropUrl || null,
      image_credit: imageCredit || null,
      primary_film_id: filmId,
      is_published: publish,
      published_at: publish ? new Date() : null,
    })
    .returning({ id: entries.id, slug: entries.slug });

  if (genreLabels && genreLabels.length > 0) {
    await recomputeGenreChips(entry.id, genreLabels);
  }

  if (publish) {
    revalidateTag("entries", "max");
    revalidatePath("/");
    revalidatePath(`/entries/${entry.slug}`);
    revalidatePath("/rss.xml");
  }

  return { entryId: entry.id, slug: entry.slug };
}
