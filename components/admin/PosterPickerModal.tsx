"use client";

import { useEffect, useRef, useState } from "react";
import type { TmdbPoster } from "@/lib/tmdb";
import { fetchFilmPosters } from "@/components/admin/poster-actions";
import styles from "./PosterPickerModal.module.css";

const TMDB_W185 = "https://image.tmdb.org/t/p/w185";

interface Props {
  tmdbId: number;
  onSelect: (posterPath: string) => void;
  onClose: () => void;
}

export function PosterPickerModal({ tmdbId, onSelect, onClose }: Props) {
  const [posters, setPosters] = useState<TmdbPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchFilmPosters(tmdbId);
      setPosters(result);
    } catch {
      setError("無法載入海報，請重試");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSelect(path: string) {
    setSelected(path);
    onSelect(path);
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal aria-label="選擇海報">
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>選擇海報</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="關閉">✕</button>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={load} type="button">重試</button>
          </div>
        )}

        {loading && !error && (
          <div className={styles.loading}>載入中…</div>
        )}

        {!loading && !error && posters.length === 0 && (
          <div className={styles.loading}>沒有找到海報</div>
        )}

        {!loading && !error && posters.length > 0 && (
          <div className={styles.grid}>
            {posters.map((p) => (
              <button
                key={p.file_path}
                className={`${styles.posterBtn} ${selected === p.file_path ? styles.posterBtnSelected : ""}`}
                onClick={() => handleSelect(p.file_path)}
                type="button"
                title={p.iso_639_1 ? `語言：${p.iso_639_1}` : "無文字版"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${TMDB_W185}${p.file_path}`}
                  alt="海報選項"
                  className={styles.posterImg}
                  loading="lazy"
                />
                {p.iso_639_1 && (
                  <span className={styles.langBadge}>{p.iso_639_1}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
