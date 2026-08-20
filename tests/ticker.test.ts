import { describe, expect, it } from "vitest";
import { isValidTickerFormat } from "@/lib/ticker";

describe("isValidTickerFormat", () => {
  it("accepts plain 1-5 letter tickers", () => {
    expect(isValidTickerFormat("A")).toBe(true);
    expect(isValidTickerFormat("AAPL")).toBe(true);
    expect(isValidTickerFormat("GOOGL")).toBe(true);
  });

  it("accepts a share-class suffix", () => {
    expect(isValidTickerFormat("BRK.B")).toBe(true);
    expect(isValidTickerFormat("BRK-B")).toBe(true);
  });

  it("rejects lowercase, empty, and overly long input", () => {
    expect(isValidTickerFormat("aapl")).toBe(false);
    expect(isValidTickerFormat("")).toBe(false);
    expect(isValidTickerFormat("TOOLONG")).toBe(false);
  });

  it("rejects digits, spaces, and punctuation outside the share-class form", () => {
    expect(isValidTickerFormat("123")).toBe(false);
    expect(isValidTickerFormat("AA PL")).toBe(false);
    expect(isValidTickerFormat("AAPL!")).toBe(false);
    expect(isValidTickerFormat("<script>")).toBe(false);
  });
});
