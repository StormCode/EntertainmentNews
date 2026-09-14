import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZES,
  FONT_SIZE_INIT_SCRIPT,
  FONT_SIZE_STORAGE_KEY,
  parseStoredSize,
} from "./font-size";

/**
 * 在受控環境裡執行 <head> 的 inline script，回傳它寫上 <html> 的 data-font-size。
 * 不用 jsdom：script 只碰 document.documentElement.dataset 與 localStorage，
 * 兩個假物件就夠了，也讓斷言的範圍精確到只有這兩個接觸點。
 */
function runInitScript(
  stored: string | null,
  opts: { throwOnRead?: boolean } = {},
): string | undefined {
  // 真實 DOM 的 dataset 是 DOMStringMap：任何寫入都會被轉成字串。
  // 用普通物件當假替身會讓數字保持數字，測不出真正的行為。
  const store: Record<string, string> = {};
  const dataset = new Proxy(store, {
    set(target, key: string, value) {
      target[key] = String(value);
      return true;
    },
  });
  const fakeDocument = { documentElement: { dataset } };
  const fakeLocalStorage = {
    getItem(key: string) {
      if (opts.throwOnRead) throw new Error("localStorage blocked");
      expect(key).toBe(FONT_SIZE_STORAGE_KEY);
      return stored;
    },
  };

  new Function("document", "localStorage", FONT_SIZE_INIT_SCRIPT)(
    fakeDocument,
    fakeLocalStorage,
  );
  return store.fontSize;
}

describe("parseStoredSize", () => {
  it("接受白名單內的字級", () => {
    for (const size of FONT_SIZES) {
      expect(parseStoredSize(String(size))).toBe(size);
    }
  });

  it("白名單外的數字落回預設", () => {
    expect(parseStoredSize("17")).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize("99")).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize("0")).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize("-16")).toBe(DEFAULT_FONT_SIZE);
  });

  it("無法解析的值落回預設", () => {
    expect(parseStoredSize("abc")).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize("")).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize(null)).toBe(DEFAULT_FONT_SIZE);
    expect(parseStoredSize(undefined)).toBe(DEFAULT_FONT_SIZE);
  });

  it("預設值本身在白名單裡", () => {
    expect(FONT_SIZES).toContain(DEFAULT_FONT_SIZE);
  });
});

describe("inline script", () => {
  it("把存過的合法字級寫上 <html>", () => {
    expect(runInitScript("16")).toBe("16");
    expect(runInitScript("21")).toBe("21");
  });

  it("非法值與空值落回預設", () => {
    expect(runInitScript("99")).toBe(String(DEFAULT_FONT_SIZE));
    expect(runInitScript("abc")).toBe(String(DEFAULT_FONT_SIZE));
    expect(runInitScript(null)).toBe(String(DEFAULT_FONT_SIZE));
  });

  it("localStorage 被封鎖時仍寫入預設值，不拋例外", () => {
    // 無痕模式、企業政策封鎖 —— 頁面不能因此整個掛掉
    expect(() => runInitScript(null, { throwOnRead: true })).not.toThrow();
    expect(runInitScript(null, { throwOnRead: true })).toBe(
      String(DEFAULT_FONT_SIZE),
    );
  });

  it("永遠會寫入某個值 —— 沒寫的話 CSS 屬性選擇器全部落空", () => {
    for (const stored of ["16", "abc", null]) {
      expect(runInitScript(stored)).toBeDefined();
    }
  });
});

/**
 * 🔴 CRITICAL GAP #2 的守門員（2026-09-15 工程審查）。
 *
 * inline script 在 hydration 前把字級寫進 DOM，React 的 lazy useState 初始值
 * 再從同一個 DOM 屬性讀回來。只要兩邊對同一個輸入算出不同結果，React 就會
 * 判定 hydration mismatch，從錯誤邊界重建 DOM，**inline script 的修正整個被
 * 丟棄** —— 零閃爍失效，而且不會有任何錯誤訊息。
 *
 * 這組測試把兩邊釘在一起。任何一邊的解析邏輯漂移都會在這裡紅燈。
 */
describe("inline script 與 parseStoredSize 必須永遠同意", () => {
  const inputs = [
    "16", "18", "21",           // 白名單
    "17", "20", "99", "0", "-16", // 白名單外的數字
    "abc", "", "  ", "1e3",     // 無法解析
    "16px", "18 ", " 21",       // 有雜質但 parseInt 吃得下
    null,                       // 沒存過
  ];

  it.each(inputs)("輸入 %j 時兩邊結果一致", (stored) => {
    const fromScript = runInitScript(stored);
    const fromModule = parseStoredSize(stored);
    expect(fromScript).toBe(String(fromModule));
  });

  it("兩邊的結果永遠在白名單內", () => {
    for (const stored of inputs) {
      expect(FONT_SIZES).toContain(Number(runInitScript(stored)));
      expect(FONT_SIZES).toContain(parseStoredSize(stored));
    }
  });
});
