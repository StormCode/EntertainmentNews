import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { MAIN_CONTENT_ID } from "@/lib/dom-ids";
import styles from "./Masthead.module.css";

export function Masthead() {
  const now = new Date();
  const year = now.getFullYear();
  const vol = year - 2026 + 1; // volume starts at 1 in 2026

  return (
    <header className={styles.masthead} style={{ position: "relative" }}>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>跳到主要內容</a>
      <div className={styles.inner}>
        <div className={`${styles.topBar} ui date`}>
          vol.{vol} · {now.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })} · est. 2026
        </div>

        <Link href="/" className={styles.wordmark} aria-label="散場之後 — 首頁">
          散場之後
        </Link>

        <p className={styles.kicker}>after the screening</p>
        <p className={`${styles.tag} ui`}>一份個人藝術電影日誌 · 每夜更新</p>

        <NavLinks />
      </div>

      {/* Mobile-only: hamburger button + slide-in drawer (design D10) */}
      <MobileNav />
    </header>
  );
}
