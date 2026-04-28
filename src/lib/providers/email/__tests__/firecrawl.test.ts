import { describe, expect, it, vi } from "vitest";
import { FirecrawlEmailProvider } from "@/lib/providers/email/firecrawl";
import {
  makeMockScraperProvider,
  makeMockSearchProvider,
} from "@/tests/mocks/providers";

describe("FirecrawlEmailProvider", () => {
  describe("findByDomain", () => {
    it("extracts emails directly from search snippets without scraping", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/contact",
              title: "Contact",
              snippet: "Reach us at alice@acme.fr or bob@acme.fr",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.map((c) => c.email)).toContain("alice@acme.fr");
      expect(result.data.map((c) => c.email)).toContain("bob@acme.fr");
      // Scraper should not have been called since snippets had emails
      expect(scraper.scrape).not.toHaveBeenCalled();
    });

    it("scrapes candidate URLs when snippets have no emails", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/equipe",
              title: "Notre équipe",
              snippet: "Rencontrez notre équipe passionnée",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider({
        scrape: vi.fn().mockResolvedValue({
          success: true,
          data: {
            url: "https://acme.fr/equipe",
            title: "Notre équipe",
            content: "Alice Martin\nCTO\nalice@acme.fr",
            metadata: {},
          },
        }),
      });

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("alice@acme.fr");
      expect(result.data[0].name).toBe("Alice Martin");
      expect(result.data[0].title).toBe("CTO");
    });

    it("falls back to common paths when search returns no results", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({ success: true, data: [] }),
      });
      const scraper = makeMockScraperProvider({
        scrape: vi.fn().mockResolvedValue({
          success: true,
          data: {
            url: "https://acme.fr/contact",
            title: "Contact",
            content: "contact@acme.fr",
            metadata: {},
          },
        }),
      });

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].email).toBe("contact@acme.fr");
      // First fallback path is /contact
      expect(scraper.scrape).toHaveBeenCalledWith("https://acme.fr/contact");
    });

    it("deduplicates emails found across multiple pages", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/p1",
              title: "p1",
              snippet: "alice@acme.fr",
            },
            {
              url: "https://acme.fr/p2",
              title: "p2",
              snippet: "alice@acme.fr",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
    });

    it("caps results at 3 contacts", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/team",
              title: "Team",
              snippet: "a@acme.fr b@acme.fr c@acme.fr d@acme.fr",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(3);
    });

    it("returns failure when search provider throws", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockRejectedValue(new Error("network error")),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain("network error");
    });

    it("skips a page when scraper fails and continues with next", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { url: "https://acme.fr/p1", title: "p1", snippet: "" },
            { url: "https://acme.fr/p2", title: "p2", snippet: "" },
          ],
        }),
      });
      const scraper = makeMockScraperProvider({
        scrape: vi
          .fn()
          .mockResolvedValueOnce({
            success: false,
            error: new Error("timeout"),
          })
          .mockResolvedValueOnce({
            success: true,
            data: {
              url: "https://acme.fr/p2",
              title: "p2",
              content: "alice@acme.fr",
              metadata: {},
            },
          }),
      });

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("alice@acme.fr");
    });
  });

  describe("findContact", () => {
    it("returns email found in search snippet without scraping", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/team",
              title: "Team",
              snippet: "Alice Martin alice@acme.fr CTO",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findContact({
        name: "Alice Martin",
        domain: "acme.fr",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.email).toBe("alice@acme.fr");
      expect(result.data?.name).toBe("Alice Martin");
      expect(scraper.scrape).not.toHaveBeenCalled();
    });

    it("scrapes first result when snippet has no email", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              url: "https://acme.fr/alice",
              title: "Alice Martin",
              snippet: "CTO at Acme",
            },
          ],
        }),
      });
      const scraper = makeMockScraperProvider({
        scrape: vi.fn().mockResolvedValue({
          success: true,
          data: {
            url: "https://acme.fr/alice",
            title: "Alice Martin",
            content: "Alice Martin\nCTO\nalice@acme.fr",
            metadata: {},
          },
        }),
      });

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findContact({
        name: "Alice Martin",
        domain: "acme.fr",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.email).toBe("alice@acme.fr");
    });

    it("returns null when no email found anywhere", async () => {
      const search = makeMockSearchProvider({
        search: vi.fn().mockResolvedValue({ success: true, data: [] }),
      });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      const result = await provider.findContact({
        name: "Unknown Person",
        domain: "acme.fr",
      });

      expect(result).toEqual({ success: true, data: null });
    });

    it("builds search query with quoted name and domain", async () => {
      const mockSearch = vi.fn().mockResolvedValue({ success: true, data: [] });
      const search = makeMockSearchProvider({ search: mockSearch });
      const scraper = makeMockScraperProvider();

      const provider = new FirecrawlEmailProvider(search, scraper);
      await provider.findContact({ name: "Alice Martin", domain: "acme.fr" });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '"Alice Martin" "@acme.fr"',
        }),
      );
    });
  });
});
