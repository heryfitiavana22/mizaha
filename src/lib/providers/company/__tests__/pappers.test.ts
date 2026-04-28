import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PappersCompanyProvider } from "@/lib/providers/company/pappers";

vi.mock("@/env", () => ({
  env: { PAPPERS_API_KEY: "test-pappers-key" },
}));

const fakePappersResponse = {
  resultats: [
    {
      nom_entreprise: "Acme SAS",
      siren: "123456789",
      libelle_code_naf: "SaaS",
      siege: { ville: "Paris", code_postal: "75001" },
      date_creation: "2019-01-01",
    },
  ],
};

describe("PappersCompanyProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("findByDomain", () => {
    it("returns first matching company", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(fakePappersResponse), { status: 200 }),
      );

      const provider = new PappersCompanyProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.name).toBe("Acme SAS");
      expect(result.data?.location).toBe("75001 Paris");
    });

    it("returns null when no results", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ resultats: [] }), { status: 200 }),
      );

      const provider = new PappersCompanyProvider();
      const result = await provider.findByDomain("unknown.fr");

      expect(result).toEqual({ success: true, data: null });
    });

    it("returns failure on non-ok HTTP response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 500 }),
      );

      const provider = new PappersCompanyProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(false);
    });
  });

  describe("search", () => {
    it("returns list of companies matching criteria", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(fakePappersResponse), { status: 200 }),
      );

      const provider = new PappersCompanyProvider();
      const result = await provider.search({
        sector: "SaaS",
        location: "Paris",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Acme SAS");
    });
  });
});
