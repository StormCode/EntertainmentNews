"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chip } from "@/components/ui/Chip";
import type { EntryWithFilm } from "@/lib/queries/entries";
import styles from "./HeroCarousel.module.css";

const SLIDE_INTERVAL = 5500;

interface Props {
  entries: EntryWithFilm[];
}

export function HeroCarousel({ entries }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = useCallback(() => {
    setActiveIdx((i) => (i + 1) % entries.length);
  }, [entries.length]);

  const goPrev = useCallback(() => {
    setActiveIdx((i) => (i - 1 + entries.length) % entries.length);
  }, [entries.length]);

  useEffect(() => {
    if (paused || entries.length <= 1) return;
    timerRef.current = setTimeout(goNext, SLIDE_INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIdx, paused, entries.length, goNext]);

  if (entries.length === 0) {
    return <div className={styles.hero} aria-hidden="true" />;
  }

  const showControls = entries.length > 1;

  return (
    <div
      className={styles.hero}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="精選文章輪播"
      aria-roledescription="carousel"
    >
      {entries.map((entry, i) => {
        const backdrop = entry.backdropUrl ?? "/images/hero-placeholder.jpg";
        const genreChips = entry.chips.filter((c) => c.kind === "genre");
        const filmLabel = entry.film?.titleZh ?? entry.film?.title ?? null;
        const isActive = i === activeIdx;

        return (
          <Link
            key={entry.id}
            href={`/entries/${entry.slug}`}
            className={`${styles.slide} ${isActive ? styles.slideActive : ""}`}
            aria-hidden={!isActive}
            tabIndex={isActive ? 0 : -1}
            aria-label={`閱讀：${entry.title}`}
            aria-roledescription="slide"
          >
            <Image
              src={backdrop}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={styles.bg}
            />
            <div className={styles.overlay} />

            <div className={styles.content}>
              {genreChips.length > 0 && (
                <div className={styles.chips}>
                  {genreChips.map((c) => (
                    <Chip key={c.label} label={c.label} />
                  ))}
                </div>
              )}
              {filmLabel && (
                <p className={`${styles.filmTitle} ui`}>《{filmLabel}》</p>
              )}
              <h2 className={styles.title}>{entry.title}</h2>
              <span className={`${styles.cta} ui`}>閱讀全文 →</span>
            </div>
          </Link>
        );
      })}

      {showControls && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={(e) => { e.preventDefault(); goPrev(); }}
            aria-label="上一篇"
            type="button"
          >
            ‹
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={(e) => { e.preventDefault(); goNext(); }}
            aria-label="下一篇"
            type="button"
          >
            ›
          </button>

          <div className={styles.dots} role="tablist" aria-label="幻燈片指示器">
            {entries.map((entry, i) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`第 ${i + 1} 篇`}
                className={`${styles.dot} ${i === activeIdx ? styles.dotActive : ""}`}
                onClick={() => setActiveIdx(i)}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
