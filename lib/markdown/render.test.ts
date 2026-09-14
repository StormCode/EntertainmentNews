import { describe, expect, it } from "vitest";
import { wordCount } from "./render";

/**
 * wordCount 決定文章頁「約 N 分鐘閱讀」那行字。
 *
 * 中文沒有空格分隔，用 /\s+/ 或 \b 切詞會把整段中文算成 1 個 token，
 * 導致每篇中文文章都顯示「約 1 分鐘閱讀」。現在的實作把 CJK 逐字計算、
 * 英文按單詞計算再相加，這組測試釘住那個行為。
 */
describe("wordCount", () => {
  it("逐字計算中文，不是整段算一個詞", () => {
    const short = wordCount("一二三四五");
    const long = wordCount("一二三四五".repeat(400));
    expect(long).toBeGreaterThan(short);
  });

  it("以 400 字為一分鐘", () => {
    expect(wordCount("字".repeat(400))).toBe(1);
    expect(wordCount("字".repeat(1200))).toBe(3);
  });

  it("計算英文單詞", () => {
    expect(wordCount("word ".repeat(800))).toBe(2);
  });

  it("中英混排時兩者相加", () => {
    const mixed = "字".repeat(200) + " " + "word ".repeat(200);
    expect(wordCount(mixed)).toBe(1);
  });

  it("最短回傳 1 分鐘，不會出現 0 或負數", () => {
    expect(wordCount("")).toBe(1);
    expect(wordCount("嗨")).toBe(1);
    expect(wordCount("   \n\n   ")).toBe(1);
  });

  it("標點與 markdown 語法不計入字數", () => {
    const plain = wordCount("字".repeat(400));
    const marked = wordCount("## " + "字".repeat(400) + "\n\n---\n\n（、。！？）");
    expect(marked).toBe(plain);
  });
});
