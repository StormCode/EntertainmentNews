"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { fetchFilmData, saveEntry } from "./actions";
import { GENRES, type GenreLabel } from "@/lib/constants/genres";
import { PosterPickerModal } from "@/components/admin/PosterPickerModal";
import { PreviewPanel } from "@/components/admin/PreviewPanel";
import styles from "./page.module.css";

interface FilmPreview {
  tmdbId: number;
  title: string;
  director: string | null;
  runtimeMin: number | null;
  backdropPath: string | null;
  posterPath: string | null;
}

export function NewEntryForm() {
  const router = useRouter();
  const [tmdbUrl, setTmdbUrl] = useState("");
  const [film, setFilm] = useState<FilmPreview | null>(null);
  const [filmError, setFilmError] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [manualBackdropUrl, setManualBackdropUrl] = useState("");
  const [imageCredit, setImageCredit] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<GenreLabel[]>([]);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [view, setView] = useState<"write" | "preview">("write");
  const [isPending, startTransition] = useTransition();
  const [selectedPosterPath, setSelectedPosterPath] = useState<string | null>(null);
  const [posterPickerOpen, setPosterPickerOpen] = useState(false);

  function toggleGenre(label: GenreLabel) {
    setSelectedGenres((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  }

  async function handleTmdbBlur() {
    if (!tmdbUrl.trim()) return;
    const result = await fetchFilmData(tmdbUrl);
    if ("error" in result) {
      setFilmError(result.error ?? "未知錯誤");
      setFilm(null);
    } else {
      setFilmError("");
      setFilm(result.film as FilmPreview);
      setSelectedPosterPath(null);
    }
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const result = await saveEntry({ tmdbUrl, entryTitle, bodyMd, manualBackdropUrl, imageCredit, genreLabels: selectedGenres, publish: false, selectedPosterPath: selectedPosterPath ?? undefined });
      if ("slug" in result) {
        router.push(`/admin/entries/${result.slug}/edit`);
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await saveEntry({ tmdbUrl, entryTitle, bodyMd, manualBackdropUrl, imageCredit, genreLabels: selectedGenres, publish: true, selectedPosterPath: selectedPosterPath ?? undefined });
      if ("slug" in result) {
        router.push(`/entries/${result.slug}`);
      }
    });
  }

  return (
    <div className={styles.shell}>
      {/* Left panel */}
      <aside className={styles.leftPanel} aria-label="影片資料">
        <div className={styles.panelHeading}>影片資料</div>
        <div className={styles.tmdbInput}>
          <label className={styles.label} htmlFor="tmdb-url">TMDB 網址</label>
          <input
            id="tmdb-url"
            type="url"
            value={tmdbUrl}
            onChange={(e) => setTmdbUrl(e.target.value)}
            onBlur={handleTmdbBlur}
            placeholder="https://www.themoviedb.org/movie/..."
            className={styles.input}
          />
          {filmError && <p className={styles.error}>{filmError}</p>}
          {film && (
            <div className={styles.filmPreview}>
              {(selectedPosterPath || film.posterPath) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPosterPath
                    ? `https://image.tmdb.org/t/p/w342${selectedPosterPath}`
                    : film.posterPath!}
                  alt={film.title}
                  className={styles.poster}
                />
              )}
              <button
                type="button"
                className={styles.btnChangePoster}
                onClick={() => setPosterPickerOpen(true)}
                disabled={isPending}
              >
                重新選擇
              </button>
              <p className={styles.filmTitle}>{film.title}</p>
              {film.director && <p className={styles.hint}>{film.director}</p>}
              {film.runtimeMin && <p className={styles.hint}>{film.runtimeMin} min</p>}
            </div>
          )}
          {!film && !filmError && <p className={styles.hint}>貼入網址後自動填入片名、導演、海報</p>}

          <div className={styles.tmdbInput} style={{ marginTop: "20px" }}>
            <label className={styles.label} htmlFor="manual-backdrop">手動封面圖 URL</label>
            <input
              id="manual-backdrop"
              type="url"
              value={manualBackdropUrl}
              onChange={(e) => setManualBackdropUrl(e.target.value)}
              placeholder="https://..."
              className={styles.input}
            />
            <p className={styles.hint}>覆蓋 TMDB 圖片（留空則使用 TMDB）</p>
          </div>

          <div className={styles.tmdbInput} style={{ marginTop: "12px" }}>
            <label className={styles.label} htmlFor="image-credit">圖片來源</label>
            <input
              id="image-credit"
              type="text"
              value={imageCredit}
              onChange={(e) => setImageCredit(e.target.value)}
              placeholder="© 發行商 / 攝影師"
              className={styles.input}
            />
            <p className={styles.hint}>顯示於封面右下角（版權聲明）</p>
          </div>
          <div className={styles.genreSection}>
            <p className={styles.panelHeading}>類型</p>
            <div className={styles.genreGrid}>
              {GENRES.map(({ label }) => (
                <label key={label} className={styles.genreCheckLabel}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(label)}
                    onChange={() => toggleGenre(label)}
                    className={styles.genreCheckbox}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Center — write or preview view */}
      {view === "write" ? (
        <main className={styles.editor} aria-label="文章編輯器">
          <input
            type="text"
            value={entryTitle}
            onChange={(e) => setEntryTitle(e.target.value)}
            placeholder="文章標題"
            className={styles.titleInput}
            aria-label="文章標題"
          />
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            placeholder="開始寫作……"
            className={styles.bodyTextarea}
            aria-label="文章內文（Markdown）"
          />
          <div className={styles.actionBar}>
            <button
              className={styles.btnDraft}
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending || !entryTitle}
            >
              {isPending ? "儲存中…" : "儲存草稿"}
            </button>
            <button
              className={styles.btnPreview}
              type="button"
              onClick={() => setView("preview")}
            >
              預覽 →
            </button>
          </div>
        </main>
      ) : (
        <div className={styles.previewOuter} aria-label="文章預覽">
          <PreviewPanel title={entryTitle} bodyMd={bodyMd} />
          <div className={styles.actionBarPreview}>
            <button
              className={styles.btnBack}
              type="button"
              onClick={() => setView("write")}
            >
              ← 返回編輯
            </button>
            <button
              className={styles.btnPublish}
              type="button"
              onClick={handlePublish}
              disabled={isPending || !entryTitle || !bodyMd}
            >
              {isPending ? "發布中…" : "發布"}
            </button>
          </div>
        </div>
      )}

      {/* Publish toast — shown after redirect returns (slug set via server) */}
      {publishedSlug && (
        <Toast
          filmTitle={film?.title ?? entryTitle}
          redirectTo={`/entries/${publishedSlug}`}
        />
      )}

      {posterPickerOpen && film?.tmdbId && (
        <PosterPickerModal
          tmdbId={film.tmdbId}
          onSelect={(path) => {
            setSelectedPosterPath(path);
            setPosterPickerOpen(false);
          }}
          onClose={() => setPosterPickerOpen(false)}
        />
      )}
    </div>
  );
}
