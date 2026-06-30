"use server";

import { fetchTmdbPosters, type TmdbPoster } from "@/lib/tmdb";

export async function fetchFilmPosters(tmdbId: number): Promise<TmdbPoster[]> {
  return fetchTmdbPosters(tmdbId);
}
