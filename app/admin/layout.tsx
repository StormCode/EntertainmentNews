import type { Metadata } from "next";
import Link from "next/link";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: { default: "管理後台", template: "%s — 散場之後管理" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <nav className={styles.adminNav}>
        <Link href="/admin/entries" className={styles.navBrand}>散場之後</Link>
        <div className={styles.navLinks}>
          <Link href="/admin/entries" className={styles.navLink}>文章</Link>
<Link href="/admin/health" className={styles.navLink}>健康</Link>
          <Link href="/admin/new" className={styles.navCta}>＋ 新增文章</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
