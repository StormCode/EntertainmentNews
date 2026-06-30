"use client";

import { useEffect, useState } from "react";
import styles from "@/app/admin/entries/[slug]/edit/edit.module.css";

interface Props {
  title: string;
  bodyMd: string;
}

export function PreviewPanel({ title, bodyMd }: Props) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!bodyMd) {
      setHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { unified } = await import("unified");
      const { default: remarkParse } = await import("remark-parse");
      const { default: remarkGfm } = await import("remark-gfm");
      const { default: remarkHtml } = await import("remark-html");
      const result = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkHtml)
        .process(bodyMd);
      if (!cancelled) setHtml(String(result));
    })();
    return () => {
      cancelled = true;
    };
  }, [bodyMd]);

  return (
    <>
      <p className={styles.previewLabel}>預覽</p>
      <hr className={styles.previewDivider} />
      {title && <h1 className={styles.previewTitle}>{title}</h1>}
      {bodyMd ? (
        // Content is admin-authored markdown — not public user input
        // eslint-disable-next-line react/no-danger
        <div className={styles.previewBody} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className={styles.previewBodyEmpty}>尚無內容</p>
      )}
    </>
  );
}
