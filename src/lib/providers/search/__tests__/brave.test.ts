import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BraveSearchProvider } from "@/lib/providers/search/brave";

vi.mock("@/env", () => ({
  env: { BRAVE_SEARCH_API_KEY: "test-brave-key" },
}));

describe("BraveSearchProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns search results on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          web: {
            results: [
              { url: "https://acme.fr", title: "Acme", description: "SaaS" },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const provider = new BraveSearchProvider();
    const result = await provider.search({ query: "SaaS Paris" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].url).toBe("https://acme.fr");
    expect(result.data[0].snippet).toBe("SaaS");
  });

  it("returns failure on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 429 }));

    const provider = new BraveSearchProvider();
    const result = await provider.search({ query: "test" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toContain("429");
  });

  it("returns empty results when web.results is absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const provider = new BraveSearchProvider();
    const result = await provider.search({ query: "test" });

    expect(result).toEqual({ success: true, data: [] });
  });

  it("passes country option when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }),
    );

    const provider = new BraveSearchProvider();
    await provider.search({ query: "test", options: { country: "FR" } });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("country=FR");
  });
});
