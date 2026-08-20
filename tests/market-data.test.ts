import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getLatestPrice } = await import("@/lib/market-data");

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("getLatestPrice — best-effort, never throws", () => {
  it("returns a price and its as-of date on a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: { result: [{ meta: { regularMarketPrice: 231.5, regularMarketTime: 1755561600 } }] },
      }),
    }) as unknown as typeof fetch;

    const result = await getLatestPrice("AAPL");
    expect(result).not.toBeNull();
    expect(result?.value).toBe(231.5);
    expect(result?.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns null (never throws) when the upstream response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const result = await getLatestPrice("AAPL");
    expect(result).toBeNull();
  });

  it("returns null when the response body doesn't contain a usable price", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [] } }) }) as unknown as typeof fetch;
    const result = await getLatestPrice("AAPL");
    expect(result).toBeNull();
  });

  it("returns null (never throws) on a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    await expect(getLatestPrice("AAPL")).resolves.toBeNull();
  });

  it("returns null on malformed JSON rather than propagating a parse error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("invalid json");
      },
    }) as unknown as typeof fetch;
    await expect(getLatestPrice("AAPL")).resolves.toBeNull();
  });

  it("rejects a non-positive price as unusable", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 0 } }] } }),
    }) as unknown as typeof fetch;
    const result = await getLatestPrice("AAPL");
    expect(result).toBeNull();
  });
});
