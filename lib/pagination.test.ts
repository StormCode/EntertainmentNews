import { describe, expect, it } from "vitest";
import {
  DIRECTOR_PAGE_SIZE,
  ENTRY_PAGE_SIZE,
  offsetFor,
  parsePageParam,
} from "./pagination";

describe("parsePageParam", () => {
  it("缺少參數時回第 1 頁", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
  });

  it("解析正常頁碼", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam("999")).toBe(999);
  });

  it("無法解析的字串回第 1 頁", () => {
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("  ")).toBe(1);
    expect(parsePageParam("page2")).toBe(1);
  });

  it("小於 1 的頁碼夾到 1 —— 負 offset 會讓 SQL 報錯", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-1")).toBe(1);
    expect(parsePageParam("-999")).toBe(1);
  });

  it("寬鬆處理小數與前後空白，與 parseInt 一致", () => {
    expect(parsePageParam("2.7")).toBe(2);
    expect(parsePageParam(" 4 ")).toBe(4);
  });

  it("永遠回傳 >= 1 的整數", () => {
    const inputs = [undefined, "", "abc", "0", "-5", "2.9", "7", "1e3"];
    for (const input of inputs) {
      const page = parsePageParam(input);
      expect(Number.isInteger(page)).toBe(true);
      expect(page).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("offsetFor", () => {
  it("第 1 頁的 offset 為 0", () => {
    expect(offsetFor(1, ENTRY_PAGE_SIZE)).toBe(0);
    expect(offsetFor(1, DIRECTOR_PAGE_SIZE)).toBe(0);
  });

  it("依頁碼遞增", () => {
    expect(offsetFor(2, ENTRY_PAGE_SIZE)).toBe(8);
    expect(offsetFor(3, ENTRY_PAGE_SIZE)).toBe(16);
    expect(offsetFor(2, DIRECTOR_PAGE_SIZE)).toBe(20);
  });

  it("與 parsePageParam 串起來絕不產生負 offset", () => {
    for (const raw of ["0", "-5", "abc", undefined]) {
      expect(offsetFor(parsePageParam(raw), ENTRY_PAGE_SIZE)).toBe(0);
    }
  });
});

describe("分頁大小常數", () => {
  it("是正整數", () => {
    expect(Number.isInteger(ENTRY_PAGE_SIZE)).toBe(true);
    expect(Number.isInteger(DIRECTOR_PAGE_SIZE)).toBe(true);
    expect(ENTRY_PAGE_SIZE).toBeGreaterThan(0);
    expect(DIRECTOR_PAGE_SIZE).toBeGreaterThan(0);
  });
});
