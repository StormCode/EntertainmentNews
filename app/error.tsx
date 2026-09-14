"use client";

import { useEffect } from "react";
import styles from "./error.module.css";

/**
 * 路由層級錯誤邊界（2026-09-15 工程審查 D5）。
 *
 * 在此之前，四個列表頁都用 `try {} catch {}` 把資料庫錯誤吞掉，然後顯示
 * 「暫無文章。」—— 跟「真的還沒發文章」一模一樣的字串。Neon 是 serverless，
 * 冷啟動逾時會真的發生，那時讀者看到的是一個看起來正常但空無一物的網站，
 * 頁面還回 200，監控完全抓不到。
 *
 * 現在例外會往上拋到這裡：讀者看得到出事了，也點得到重試。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // server log 會收到完整 stack；這裡補一筆 client 端記錄，
    // digest 可用來跟伺服器日誌對上
    console.error("[散場之後] 頁面載入失敗", error);
  }, [error]);

  return (
    <main className={styles.wrap} role="alert" aria-live="assertive">
      <div className={styles.inner}>
        <p className={`${styles.kicker} ui`}>散場之後</p>
        <h1 className={styles.heading}>放映中斷</h1>
        <p className={styles.body}>
          這一頁沒能載入。多半是暫時的連線問題，稍等一下再試通常就好了。
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.retry} onClick={reset}>
            重新載入
          </button>
          <a href="/" className={styles.home}>
            回首頁
          </a>
        </div>
        {error.digest && (
          <p className={`${styles.digest} ui`}>錯誤代碼 {error.digest}</p>
        )}
      </div>
    </main>
  );
}
