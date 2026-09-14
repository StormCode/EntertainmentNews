"use client";

import { useEffect, useRef, useState } from "react";
import { ARTICLE_BODY_ID } from "@/lib/dom-ids";
import type { HeadingItem } from "@/lib/markdown/render";
import styles from "./TableOfContents.module.css";

interface Props {
  headings: HeadingItem[];
}

export function TableOfContents({ headings }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const article = document.getElementById(ARTICLE_BODY_ID);
    const headingEls: HTMLElement[] = article
      ? Array.from(article.querySelectorAll("h2[id], h3[id]"))
      : [];

    function getOffset() {
      return (navRef.current?.offsetHeight ?? 0) + 8;
    }

    function update() {
      if (headingEls.length === 0) {
        setActiveId(headings[0].id);
        return;
      }
      const offset = getOffset();
      const viewportH = window.innerHeight;

      // Primary: last heading whose top is within the visible viewport (below sticky TOC)
      let visibleIdx = -1;
      for (let i = 0; i < headingEls.length; i++) {
        const top = headingEls[i].getBoundingClientRect().top;
        if (top >= offset && top < viewportH) {
          visibleIdx = i;
        }
      }
      if (visibleIdx >= 0) {
        setActiveId(headings[visibleIdx]?.id ?? "");
        return;
      }

      // Fallback: no heading visible — use last one that scrolled above the fold
      let lastAbove = 0;
      for (let i = 0; i < headingEls.length; i++) {
        if (headingEls[i].getBoundingClientRect().top < offset) {
          lastAbove = i;
        }
      }
      setActiveId(headings[lastAbove]?.id ?? "");
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [headings]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el =
      document.getElementById(id) ??
      document.getElementById(`user-content-${id}`);
    if (!el) return;
    const offset = (navRef.current?.offsetHeight ?? 0) + 8;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    history.pushState(null, "", `#${id}`);
    setMobileOpen(false);
  }

  if (headings.length === 0) return null;

  return (
    <nav ref={navRef} className={styles.toc} aria-label="文章目錄">
      {/* Mobile: clickable toggle header; Desktop: plain label (pointer-events none via CSS) */}
      <button
        className={styles.tocToggle}
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
        aria-controls="toc-list"
      >
        <span className={styles.label}>目錄</span>
        <span
          className={styles.chevron}
          aria-hidden="true"
          style={{ transform: mobileOpen ? "rotate(180deg)" : undefined }}
        />
      </button>

      <ol
        id="toc-list"
        className={`${styles.list} ${mobileOpen ? styles.listOpen : ""}`}
        role="list"
      >
        {headings.map(({ id, text, depth }) => (
          <li key={id} className={depth === 3 ? styles.h3 : styles.h2}>
            <a
              href={`#${id}`}
              onClick={(e) => handleClick(e, id)}
              className={`${styles.link} ${activeId === id ? styles.active : ""}`}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
