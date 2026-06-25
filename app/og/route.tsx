import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { entries, films } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const revalidate = 3600; // 1h — social platforms cache OG images longer anyway

const OG_W = 1200;
const OG_H = 630;
const PAPER = "#0c0a08";
const INK = "#f1ebdf";
const MUTED = "#9c9080";
const GOLD = "#c9a96e";
const SITE = "散場之後";
const TMDB_BASE = "https://image.tmdb.org/t/p/w1280";

// Module-level cache survives across requests within the same serverless instance.
// Key = encoded text; same film titles + wordmark = same glyph subset = cache hit.
const _fontCache = new Map<string, ArrayBuffer>();

// Fetch a Noto Serif TC subset for the characters we need.
// Google Fonts returns truetype format when no browser UA is sent.
async function fetchFont(text: string): Promise<ArrayBuffer | null> {
  const cached = _fontCache.get(text);
  if (cached) return cached;
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(4000) }
    ).then((r) => r.text());

    // Match any supported font format (truetype, woff, woff2, opentype)
    const match = css.match(/src: url\(([^)]+)\) format\('[^']+'\)/);
    if (!match) return null;
    const buf = await fetch(match[1], { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer());
    _fontCache.set(text, buf);
    return buf;
  } catch {
    return null;
  }
}

function resolveBackdropUrl(url: string | null): string | null {
  if (!url) return null;
  // Raw TMDB path (not yet uploaded to R2) — use TMDB CDN directly
  if (url.startsWith("/")) return `${TMDB_BASE}${url}`;
  return url;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  let entryTitle = SITE;
  let filmLabel: string | null = null; // 《片名》line
  let director: string | null = null;
  let backdropUrl: string | null = null;

  if (slug) {
    try {
      const [row] = await db
        .select({
          title: entries.title,
          entryBackdrop: entries.backdrop_url,
          manualBackdrop: entries.manual_backdrop_url,
          filmTitle: films.title,
          filmTitleZh: films.title_zh,
          filmDirector: films.director,
          filmBackdrop: films.backdrop_url,
        })
        .from(entries)
        .leftJoin(films, eq(entries.primary_film_id, films.id))
        .where(and(eq(entries.slug, slug), eq(entries.is_published, true)))
        .limit(1);

      if (row) {
        entryTitle = row.title;
        filmLabel = row.filmTitleZh ?? row.filmTitle;
        director = row.filmDirector;
        // Priority: manual override > entry R2 > film R2/TMDB
        backdropUrl = resolveBackdropUrl(
          row.manualBackdrop ?? row.entryBackdrop ?? row.filmBackdrop
        );
      }
    } catch {
      // DB unavailable — fall back to generic card
    }
  }

  // Pre-fetch backdrop + font in parallel — they are independent of each other.
  // Satori's lazy external image fetch fails in Vercel serverless, so we materialise
  // the backdrop as a data URL ourselves. Font is cached across requests (module scope).
  const allText = [SITE, entryTitle, filmLabel, director].filter(Boolean).join("");

  const [backdropDataUrl, fontData] = await Promise.all([
    backdropUrl
      ? fetch(backdropUrl, { signal: AbortSignal.timeout(4000) })
          .then(async (r) => {
            const imgBuf = await r.arrayBuffer();
            const b64 = Buffer.from(imgBuf).toString("base64");
            const mime = backdropUrl!.endsWith(".png") ? "image/png" : "image/jpeg";
            return `data:${mime};base64,${b64}` as string;
          })
          .catch(() => null as string | null)
      : Promise.resolve(null as string | null),
    fetchFont(allText),
  ]);

  if (!fontData) {
    // Font fetch failed — redirect to homepage rather than crash with empty fonts
    return new Response(null, {
      status: 302,
      headers: { Location: process.env.NEXT_PUBLIC_SITE_URL ?? "/" },
    });
  }

  const fonts = [{ name: "Noto Serif TC", data: fontData, weight: 700 as const, style: "normal" as const }];

  try {
  return new ImageResponse(
    (
      <div
        style={{
          width: OG_W,
          height: OG_H,
          display: "flex",
          background: PAPER,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Backdrop image — uses pre-fetched data URL (not external URL) */}
        {backdropDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropDataUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Gradient overlay — darker when backdrop present */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: backdropDataUrl
              ? "linear-gradient(to bottom, rgba(12,10,8,0.1) 0%, rgba(12,10,8,0.65) 45%, rgba(12,10,8,0.95) 100%)"
              : "linear-gradient(135deg, #161310 0%, #0c0a08 100%)",
          }}
        />

        {/* Gold accent strip at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: GOLD,
          }}
        />

        {/* Content row */}
        <div
          style={{
            position: "absolute",
            bottom: "52px",
            left: "60px",
            right: "60px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Left: film label + entry title + director */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "900px",
            }}
          >
            {filmLabel && (
              <div
                style={{
                  fontSize: "20px",
                  color: GOLD,
                  fontFamily: "Noto Serif TC",
                  letterSpacing: "0.06em",
                }}
              >
                {`《${filmLabel}》`}
              </div>
            )}
            <div
              style={{
                fontSize: "36px",
                color: INK,
                fontFamily: "Noto Serif TC",
                fontWeight: 700,
                lineHeight: 1.3,
                letterSpacing: "0.02em",
              }}
            >
              {entryTitle}
            </div>
            {director && (
              <div
                style={{
                  fontSize: "17px",
                  color: MUTED,
                  fontFamily: "Noto Serif TC",
                  letterSpacing: "0.04em",
                }}
              >
                {director}
              </div>
            )}
          </div>

          {/* Right: wordmark */}
          <div
            style={{
              fontSize: "15px",
              color: GOLD,
              fontFamily: "Noto Serif TC",
              letterSpacing: "0.16em",
              flexShrink: 0,
              marginLeft: "40px",
              paddingBottom: "3px",
            }}
          >
            {SITE}
          </div>
        </div>
      </div>
    ),
    { width: OG_W, height: OG_H, fonts }
  );
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: process.env.NEXT_PUBLIC_SITE_URL ?? "/" },
    });
  }
}
