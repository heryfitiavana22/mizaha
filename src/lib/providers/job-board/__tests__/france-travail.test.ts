import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    FRANCE_TRAVAIL_CLIENT_ID: "test-client-id",
    FRANCE_TRAVAIL_CLIENT_SECRET: "test-client-secret",
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
const { FranceTravailProvider } =
  await import("@/lib/providers/job-board/france-travail");

type MockResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function makeAuthResponse(): MockResponse {
  return { ok: true, json: async () => ({ access_token: "token-123" }) };
}

function makeSearchResponse(resultats: unknown[]): MockResponse {
  return { ok: true, json: async () => ({ resultats }) };
}

const validOffre = {
  id: "offre-1",
  intitule: "Développeur React Senior",
  entreprise: { nom: "Acme SAS" },
  lieuTravail: { libelle: "Paris (75)" },
  typeContrat: "CDI",
  description: "We are looking for a React developer.",
  origineOffre: { urlOrigine: "https://francetravail.fr/offres/offre-1" },
  dateCreation: "2024-01-15",
  competences: [{ libelle: "React" }, { libelle: "TypeScript" }],
};

describe("FranceTravailProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has signalSource france_travail", () => {
    const provider = new FranceTravailProvider();
    expect(provider.signalSource).toBe("france_travail");
  });

  describe("searchJobs", () => {
    it("returns JobPosting[] mapped from API offres", async () => {
      mockFetch
        .mockResolvedValueOnce(makeAuthResponse())
        .mockResolvedValueOnce(makeSearchResponse([validOffre]));

      const provider = new FranceTravailProvider();
      const result = await provider.searchJobs({ keywords: ["React"] });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Développeur React Senior");
      expect(result.data[0].companyName).toBe("Acme SAS");
      expect(result.data[0].contractType).toBe("CDI");
      expect(result.data[0].techStack).toEqual(["React", "TypeScript"]);
    });

    it("returns failure when auth request fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const provider = new FranceTravailProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(false);
    });

    it("returns failure when search API fails", async () => {
      mockFetch
        .mockResolvedValueOnce(makeAuthResponse())
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        });

      const provider = new FranceTravailProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(false);
    });

    it("skips offres missing title or company name", async () => {
      const offreNoTitle = { ...validOffre, intitule: undefined };
      const offreNoCompany = { ...validOffre, entreprise: undefined };

      mockFetch
        .mockResolvedValueOnce(makeAuthResponse())
        .mockResolvedValueOnce(
          makeSearchResponse([offreNoTitle, offreNoCompany, validOffre]),
        );

      const provider = new FranceTravailProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].companyName).toBe("Acme SAS");
    });

    it("falls back to API URL when origineOffre is missing", async () => {
      const offreNoUrl = { ...validOffre, origineOffre: undefined };

      mockFetch
        .mockResolvedValueOnce(makeAuthResponse())
        .mockResolvedValueOnce(makeSearchResponse([offreNoUrl]));

      const provider = new FranceTravailProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].url).toContain("offres/offre-1");
    });
  });
});
