import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { FreeWorkProvider } =
  await import("@/lib/providers/job-board/free-work");

type MockResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function makeResponse(data: unknown, status = 200): MockResponse {
  return { ok: status < 400, status, json: async () => data };
}

const validPosting = {
  id: 1,
  title: "Développeur Node.js TypeScript",
  slug: "dev-nodejs-typescript-acme",
  description: "<p>Mission freelance <strong>Node.js</strong> TypeScript.</p>",
  remoteMode: "full" as const,
  contracts: ["contractor"],
  location: { label: "Paris, Île-de-France", locality: "Paris" },
  company: { name: "Acme SAS" },
  job: { slug: "developer" },
  skills: [{ name: "Node.js" }, { name: "TypeScript" }],
  applicationUrl: "https://acme.com/apply",
  publishedAt: "2024-03-15",
};

describe("FreeWorkProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has signalSource free_work", () => {
    const provider = new FreeWorkProvider();
    expect(provider.signalSource).toBe("free_work");
  });

  describe("searchJobs", () => {
    it("returns JobPosting[] mapped from API response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([validPosting]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({ contractType: "freelance" });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);

      const posting = result.data[0];
      expect(posting.title).toBe("Développeur Node.js TypeScript");
      expect(posting.companyName).toBe("Acme SAS");
      expect(posting.contractType).toBe("freelance");
      expect(posting.location).toBe("Paris, Île-de-France");
      expect(posting.url).toBe("https://acme.com/apply");
      expect(posting.postedAt).toBe("2024-03-15");
      expect(posting.techStack).toEqual(["Node.js", "TypeScript"]);
    });

    it("strips HTML from description", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([validPosting]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].description).not.toContain("<p>");
      expect(result.data[0].description).not.toContain("<strong>");
      expect(result.data[0].description).toContain("Node.js");
    });

    it("falls back to constructed URL when applicationUrl is null", async () => {
      const postingNoUrl = { ...validPosting, applicationUrl: null };
      mockFetch.mockResolvedValueOnce(makeResponse([postingNoUrl]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].url).toContain("free-work.com");
      expect(result.data[0].url).toContain(validPosting.slug);
    });

    it("maps contractor contract to freelance", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([validPosting]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].contractType).toBe("freelance");
    });

    it("uses locality as fallback when location label is null", async () => {
      const postingNoLabel = {
        ...validPosting,
        location: { label: null, locality: "Lyon" },
      };
      mockFetch.mockResolvedValueOnce(makeResponse([postingNoLabel]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].location).toBe("Lyon");
    });

    it("defaults location to France when location is null", async () => {
      const postingNoLocation = { ...validPosting, location: null };
      mockFetch.mockResolvedValueOnce(makeResponse([postingNoLocation]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].location).toBe("France");
    });

    it("returns failure when API responds with non-ok status", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({}, 500));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(false);
    });

    it("returns failure when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(false);
    });

    it("returns empty array for empty API response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([]));

      const provider = new FreeWorkProvider();
      const result = await provider.searchJobs({});

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(0);
    });

    it("includes remote param in URL when remote is true", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([]));

      const provider = new FreeWorkProvider();
      await provider.searchJobs({ remote: true });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("remoteMode=full");
    });

    it("includes contracts param in URL when contractType is freelance", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([]));

      const provider = new FreeWorkProvider();
      await provider.searchJobs({ contractType: "freelance" });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("contracts=contractor");
    });

    it("includes keywords param in URL when techStack is provided", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse([]));

      const provider = new FreeWorkProvider();
      await provider.searchJobs({ techStack: ["TypeScript", "Node.js"] });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("keywords=");
      expect(calledUrl).toContain("TypeScript");
    });
  });
});
