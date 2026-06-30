"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEntry, retryR2Upload, updateFilmPoster } from "./actions";
import { GENRES, type GenreLabel } from "@/lib/constants/genres";
import { PosterPickerModal } from "@/components/admin/PosterPickerModal";
import styles from "./edit.module.css";

interface EntryChip {
  label: string;
  kind: string;
  is_live: string | null;
}

// Serializable subset — Date fields converted to ISO strings by the Server Component
interface EntryProps {
  id: number;
  slug: string;
  title: string;
  body_md: string;
  manual_backdrop_url: string | null;
  backdrop_url: string | null;
  image_credit: string | null;
  is_published: boolean;
  is_hero_featured: boolean;
  published_at: string | null;
}

interface FilmProps {
  id: number;
  tmdb_id: number | null;
  title: string;
  title_zh: string | null;
  director: string | null;
  runtime_min: number | null;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
}

interface Props {
  entry: EntryProps;
  film: FilmProps | null;
  chips: EntryChip[];
}

export function EditEntryForm({ entry, film, chips: initialChips }: Props) {
  const router = useRouter();
  const [entryTitle, setEntryTitle] = useState(entry.title);
  const [bodyMd, setBodyMd] = useState(entry.body_md);
  const [manualBackdropUrl, setManualBackdropUrl] = useState(entry.manual_backdrop_url ?? "");
  const [imageCredit, setImageCredit] = useState(entry.image_credit ?? "");
  const [selectedGenres, setSelectedGenres] = useState<GenreLabel[]>(
    () => initialChips.filter((c) => c.kind === "genre").map((c) => c.label as GenreLabel)
  );
  const [heroFeatured, setHeroFeatured] = useState(entry.is_hero_featured);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [r2Pending, startR2] = useTransition();
  const [posterUrl, setPosterUrl] = useState(film?.poster_url ?? null);
  const [posterPickerOpen, setPosterPickerOpen] = useState(false);
  const [posterUploading, setPosterUploading] = useState(false);

  function toggleGenre(label: GenreLabel) {
    setSelectedGenres((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  }

  const heroUrl = entry.backdrop_url ?? film?.backdrop_url;
  const r2Missing = !heroUrl || heroUrl.startsWith("/");
  // Poster is still on TMDB CDN when R2 upload failed (poster picker fallback or initial save failure)
  const r2PosterMissing = !!posterUrl && posterUrl.includes("image.tmdb.org");
  const r2AnyMissing = r2Missing || r2PosterMissing;

  async function handlePosterSelect(posterPath: string) {
    if (!film) return;
    setPosterUploading(true);
    setPosterPickerOpen(false);
    try {
      const result = await updateFilmPoster(film.id, posterPath);
      if ("error" in result) {
        setMessage(`海報更換失敗：${result.error}`);
      } else {
        setPosterUrl(result.posterUrl);
        setMessage("海報已更換");
      }
    } catch {
      setMessage("海報更換失敗，請再試");
    } finally {
      setPosterUploading(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await updateEntry({
          entryId: entry.id,
          slug: entry.slug,
          entryTitle,
          bodyMd,
          manualBackdropUrl,
          imageCredit,
          genreLabels: selectedGenres,
          heroFeatured,
        });
        if ("ok" in result) setMessage("儲存成功");
        else setMessage("儲存失敗，請再試");
      } catch {
        setMessage("儲存失敗，請再試");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        await updateEntry({
          entryId: entry.id,
          slug: entry.slug,
          entryTitle,
          bodyMd,
          manualBackdropUrl,
          imageCredit,
          genreLabels: selectedGenres,
          heroFeatured,
          publish: true,
        });
        router.push(`/entries/${entry.slug}`);
      } catch {
        setMessage("發布失敗，請再試");
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      try {
        await updateEntry({
          entryId: entry.id,
          slug: entry.slug,
          entryTitle,
          bodyMd,
          imageCredit,
          genreLabels: selectedGenres,
          heroFeatured,
          unpublish: true,
        });
        setMessage("已取消發布");
      } catch {
        setMessage("取消發布失敗，請再試");
      }
    });
  }

  function handleRetryR2() {
    if (!film) return;
    startR2(async () => {
      const result = await retryR2Upload(film.id);
      if ("error" in result) {
        setMessage(`R2 上傳失敗：${result.error}`);
      } else {
        if (result.posterUrl) setPosterUrl(result.posterUrl);
        setMessage("圖片已上傳至 R2");
      }
    });
  }

  return (
    <div className={styles.shell}>
      {/* Left panel — film info + image status */}
      <aside className={styles.leftPanel} aria-label="影片資料">
        <div className={styles.panelHeading}>影片資料</div>

        {film ? (
          <div className={styles.filmInfo}>
            {posterUrl && !posterUrl.startsWith("/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt={film.title} className={styles.poster} />
            ) : (
              <div className={styles.posterMissing}>圖片待補</div>
            )}
            {film.tmdb_id && (
              <button
                type="button"
                className={styles.btnChangePoster}
                onClick={() => setPosterPickerOpen(true)}
                disabled={posterUploading || isPending}
              >
                {posterUploading ? "上傳中…" : "重新選擇"}
              </button>
            )}
            <p className={styles.filmTitle}>{film.title}</p>
            {film.title_zh && <p className={styles.hint}>{film.title_zh}</p>}
            {film.director && <p className={styles.hint}>{film.director}</p>}
            {film.runtime_min && <p className={styles.hint}>{film.runtime_min} min</p>}
            {film.release_year && <p className={styles.hint}>{film.release_year}</p>}
          </div>
        ) : (
          <p className={styles.hint}>無關聯影片</p>
        )}

        {r2AnyMissing && film && (
          <div className={styles.r2Warning}>
            <p className={styles.warningText}>圖片待補 — R2 尚未上傳</p>
            <button
              className={styles.btnRetry}
              onClick={handleRetryR2}
              disabled={r2Pending}
              type="button"
            >
              {r2Pending ? "上傳中…" : "重試 R2 上傳"}
            </button>
          </div>
        )}

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

        <div className={styles.backdropOverride}>
          <label className={styles.label} htmlFor="manual-backdrop">手動封面圖 URL</label>
          <input
            id="manual-backdrop"
            type="url"
            value={manualBackdropUrl}
            onChange={(e) => setManualBackdropUrl(e.target.value)}
            placeholder="https://..."
            className={styles.input}
          />
          <p className={styles.hint}>覆蓋 R2 圖片（留空則使用 R2）</p>
        </div>

        <div className={styles.backdropOverride}>
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

        <div className={styles.heroToggle}>
          <label className={styles.heroLabel}>
            <input
              type="checkbox"
              checked={heroFeatured}
              onChange={(e) => setHeroFeatured(e.target.checked)}
              className={styles.heroCheckbox}
            />
            Hero 精選
          </label>
          <p className={styles.hint}>勾選後此文章優先顯示於首頁 Hero 輪播</p>
        </div>

        <div className={styles.metaSection}>
          <p className={styles.metaRow}>
            <span className={styles.metaLabel}>Slug</span>
            <code className={styles.metaValue}>{entry.slug}</code>
          </p>
          <p className={styles.metaRow}>
            <span className={styles.metaLabel}>狀態</span>
            <span className={entry.is_published ? styles.badgePublished : styles.badgeDraft}>
              {entry.is_published ? "已發布" : "草稿"}
            </span>
          </p>
          {entry.published_at && (
            <p className={styles.metaRow}>
              <span className={styles.metaLabel}>發布時間</span>
              <span className={styles.metaValue}>
                {new Date(entry.published_at).toLocaleDateString("zh-Hant", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "Asia/Taipei",
                })}
              </span>
            </p>
          )}
        </div>
      </aside>

      {/* Center editor */}
      <main className={styles.editor} aria-label="文章編輯器">
        {message && <div className={styles.inlineMessage}>{message}</div>}
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
          {entry.is_published ? (
            <button
              className={styles.btnUnpublish}
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
            >
              取消發布
            </button>
          ) : (
            <button
              className={styles.btnPublish}
              type="button"
              onClick={handlePublish}
              disabled={isPending || !entryTitle || !bodyMd}
            >
              發布
            </button>
          )}
          <button
            className={styles.btnSave}
            type="button"
            onClick={handleSave}
            disabled={isPending || !entryTitle}
          >
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </main>

      {/* Right preview */}
      <aside className={styles.rightPanel} aria-label="預覽">
        <div className={styles.panelHeading}>預覽</div>
        <div className={styles.previewContent}>
          {bodyMd ? (
            <pre className={styles.previewPre}>{bodyMd}</pre>
          ) : (
            <p className={styles.previewEmpty}>開始輸入後顯示預覽</p>
          )}
        </div>
      </aside>

      {posterPickerOpen && film?.tmdb_id && (
        <PosterPickerModal
          tmdbId={film.tmdb_id}
          onSelect={handlePosterSelect}
          onClose={() => setPosterPickerOpen(false)}
        />
      )}
    </div>
  );
}
