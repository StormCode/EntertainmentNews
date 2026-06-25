import type { MetadataRoute } from "next";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://etfilmnews.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/genres/comedy`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/genres/mystery`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/genres/sci-fi`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/genres/romance`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/genres/documentary`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/genres/action`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  let entryRoutes: MetadataRoute.Sitemap = [];
  try {
    const published = await db
      .select({ slug: entries.slug, published_at: entries.published_at })
      .from(entries)
      .where(eq(entries.is_published, true))
      .orderBy(desc(entries.published_at));

    entryRoutes = published.map((e) => ({
      url: `${SITE_URL}/entries/${e.slug}`,
      lastModified: e.published_at ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable — return static routes only
  }

  return [...staticRoutes, ...entryRoutes];
}
