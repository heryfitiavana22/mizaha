import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { FIRECRAWL_API_KEY: "test-key" },
}));

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock("@mendable/firecrawl-js", () => ({
  // Must be a regular function — arrow functions cannot be used as constructors
  default: function FirecrawlApp() {
    return { scrape: mockScrape };
  },
}));

// Import after mocks are set up
const { WttjProvider } = await import("@/lib/providers/job-board/wttj");

const VALID_MARKDOWN = `
## Développeur React Senior
**Entreprise :** Acme SAS
**Lieu :** Paris
**Type de contrat :** CDI
[Voir l'offre](https://www.welcometothejungle.com/fr/companies/acme-sas/jobs/dev-react-123)

## DevOps Engineer
**Entreprise :** Beta Corp
**Lieu :** Lyon
**Type de contrat :** CDI
[Voir l'offre](https://www.welcometothejungle.com/fr/companies/beta-corp/jobs/devops-456)
`;

describe("WttjProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has signalSource wttj", () => {
    const provider = new WttjProvider();
    expect(provider.signalSource).toBe("wttj");
  });

  describe("searchJobs", () => {
    it("returns JobPosting[] parsed from Firecrawl markdown", async () => {
      mockScrape.mockResolvedValue({ markdown: VALID_MARKDOWN });

      const provider = new WttjProvider();
      const result = await provider.searchJobs({ keywords: ["React"] });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe("Développeur React Senior");
      expect(result.data[0].companyName).toBe("Acme SAS");
      expect(result.data[0].location).toBe("Paris");
      expect(result.data[0].url).toContain("welcometothejungle.com");
    });

    it("returns failure when Firecrawl throws", async () => {
      mockScrape.mockRejectedValue(new Error("Firecrawl down"));

      const provider = new WttjProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(false);
    });

    it("returns empty list when markdown has no matching job blocks", async () => {
      mockScrape.mockResolvedValue({ markdown: "No jobs here." });

      const provider = new WttjProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(0);
    });

    it("respects the limit option", async () => {
      mockScrape.mockResolvedValue({ markdown: VALID_MARKDOWN });

      const provider = new WttjProvider();
      const result = await provider.searchJobs({ limit: 1 });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
    });

    it("handles missing markdown gracefully", async () => {
      mockScrape.mockResolvedValue({});

      const provider = new WttjProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(0);
    });
  });
});
