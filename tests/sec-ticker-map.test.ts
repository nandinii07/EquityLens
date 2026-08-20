import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFetchSecJson = vi.fn();
vi.mock("@/lib/sec-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sec-client")>("@/lib/sec-client");
  return {
    ...actual,
    fetchSecJson: (...args: unknown[]) => mockFetchSecJson(...args),
  };
});

const { resolveTicker, __resetTickerMapForTests } = await import("@/lib/sec-ticker-map");
const { SecFetchError } = await import("@/lib/sec-client");

const SAMPLE_MAPPING = {
  "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" },
};

beforeEach(() => {
  __resetTickerMapForTests();
  mockFetchSecJson.mockReset();
  mockFetchSecJson.mockResolvedValue(SAMPLE_MAPPING);
});

describe("ticker -> CIK resolution", () => {
  it("resolves an uppercase ticker directly", async () => {
    const resolved = await resolveTicker("AAPL");
    expect(resolved).toEqual({ cik: 320193, cikPadded: "0000320193", ticker: "AAPL", title: "Apple Inc." });
  });

  it("normalizes a lowercase ticker to the same result", async () => {
    const resolved = await resolveTicker("aapl");
    expect(resolved?.ticker).toBe("AAPL");
    expect(resolved?.cik).toBe(320193);
  });

  it("normalizes mixed case", async () => {
    const resolved = await resolveTicker("AaPl");
    expect(resolved?.ticker).toBe("AAPL");
  });

  it("resolves an exact case-insensitive company title match as a fallback", async () => {
    const resolved = await resolveTicker("microsoft corp");
    expect(resolved?.ticker).toBe("MSFT");
  });

  it("returns null for a ticker with no SEC record, without throwing", async () => {
    const resolved = await resolveTicker("ZZZZZ");
    expect(resolved).toBeNull();
  });

  it("returns null for empty input without fetching anything", async () => {
    const resolved = await resolveTicker("   ");
    expect(resolved).toBeNull();
  });

  it("zero-pads the CIK to exactly 10 digits, as the companyfacts/submissions URLs require", async () => {
    const resolved = await resolveTicker("AAPL");
    expect(resolved?.cikPadded).toHaveLength(10);
    expect(resolved?.cikPadded).toBe("0000320193");
  });
});

describe("caching the bulk ticker directory", () => {
  it("only fetches the directory once across multiple resolutions in the same process", async () => {
    await resolveTicker("AAPL");
    await resolveTicker("MSFT");
    await resolveTicker("AAPL");
    expect(mockFetchSecJson).toHaveBeenCalledTimes(1);
  });
});

describe("provider failure resolving the ticker directory", () => {
  it("propagates the failure when there is no prior cached mapping to fall back to", async () => {
    mockFetchSecJson.mockRejectedValue(new SecFetchError("provider_error", "Could not reach SEC EDGAR."));
    await expect(resolveTicker("AAPL")).rejects.toThrow();
  });
});
