import { Masthead } from "@/components/layout/Masthead";
import { EntryCard } from "@/components/entries/EntryCard";
import { searchEntries, type EntryWithFilm } from "@/lib/queries/entries";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export function generateMetadata() {
  // 裸標題即可，後綴由 app/layout.tsx 的 title.template 補上
  return { title: "搜尋" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let results: EntryWithFilm[] = [];
  if (query) {
    try {
      results = await searchEntries(query);
    } catch {
      // DB unavailable
    }
  }

  return (
    <>
      <Masthead />
      <main className={styles.main} id={MAIN_CONTENT_ID}>
        <form action="/search" method="GET" className={styles.form} role="search">
          <div className={styles.inputWrap}>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="搜尋片名、導演、文章內文…"
              className={styles.input}
              autoFocus={!query}
              aria-label="搜尋"
            />
          </div>
        </form>

        {query && (
          <p className={styles.meta}>
            {results.length > 0
              ? `「${query}」找到 ${results.length} 筆結果`
              : `找不到「${query}」的相關文章`}
          </p>
        )}

        {results.length > 0 && (
          <div className={styles.grid}>
            {results.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {!query && (
          <p className={styles.hint}>輸入片名、導演或關鍵字後按 Enter</p>
        )}
      </main>
    </>
  );
}
