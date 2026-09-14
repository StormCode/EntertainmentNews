import type { ReactNode } from "react";

/**
 * 排序閘門：等某個 promise 就緒後才渲染 children。
 *
 * 用途是把次要內容排到主要內容之後。首頁的「探索類型」是同步的 server
 * component（只讀 lib/constants/genres.ts），不放閘門的話它會落在第一次
 * flush 裡，於是讀者在文章還是骨架時就先看到探索類型 —— 跟「文章是主角、
 * 類型探索是配角」的閱讀順序正好相反。
 *
 * 用 promise 而不是「各自打一次同樣的查詢」是刻意的：共用同一個 promise
 * 才能保證順序，兩次獨立查詢就算都命中快取也只是碰運氣。
 *
 * 呼叫端要自己包 <Suspense fallback={null}>，否則這裡的 await 會阻塞整頁。
 */
export async function AfterReady({
  gate,
  children,
}: {
  gate: Promise<unknown>;
  children: ReactNode;
}) {
  await gate;
  return <>{children}</>;
}
