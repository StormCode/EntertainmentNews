import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * 單元測試設定。
 *
 * 只跑純函式：分頁解析、字級解析、閱讀時間計算。
 * 視覺行為（零閃爍、翻頁骨架、錯誤頁）由 Playwright 負責，見 playwright.config.ts。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
