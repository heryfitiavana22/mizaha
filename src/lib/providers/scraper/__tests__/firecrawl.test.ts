import { describe, expect, it, vi } from "vitest";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { createFirecrawlExecutor } from "@/lib/rate-limit/firecrawl-executor";

vi.mock("@/env", () => ({
  env: { FIRECRAWL_API_KEY: "test-firecrawl-key" },
}));

const mockScrape = vi.fn();

vi.mock("@mendable/firecrawl-js", () => ({
  // regular function required — arrow function cannot be used with `new`
  default: vi.fn(function () {
    return { scrape: mockScrape };
  }),
}));

describe("FirecrawlScraperProvider", () => {
  it("returns scraped content on success", async () => {
    mockScrape.mockResolvedValueOnce({
      success: true,
      metadata: { title: "Acme SAS" },
      markdown: "We are hiring a React developer",
    });

    const rateLimitedExecutor = createFirecrawlExecutor();
    const provider = new FirecrawlScraperProvider(rateLimitedExecutor);
    const result = await provider.scrape("https://acme.fr");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Acme SAS");
    expect(result.data.content).toBe("We are hiring a React developer");
    expect(result.data.url).toBe("https://acme.fr");
  });

  it("returns failure when SDK throws", async () => {
    mockScrape.mockRejectedValueOnce(new Error("Firecrawl limit reached"));

    const rateLimitedExecutor = createFirecrawlExecutor();
    const provider = new FirecrawlScraperProvider(rateLimitedExecutor);
    const result = await provider.scrape("https://acme.fr");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toContain("Firecrawl limit reached");
  });

  it("handles missing markdown and metadata gracefully", async () => {
    mockScrape.mockResolvedValueOnce({});

    const rateLimitedExecutor = createFirecrawlExecutor();
    const provider = new FirecrawlScraperProvider(rateLimitedExecutor);
    const result = await provider.scrape("https://acme.fr");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("");
    expect(result.data.content).toBe("");
  });
});
