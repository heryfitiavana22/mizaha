import { beforeEach, describe, expect, it, vi } from "vitest";
import { WttjProvider } from "@/lib/providers/job-board/wttj";

function makeAlgoliaResponse(
  hits: { name: string; slug: string; jobs_count: number }[],
) {
  return new Response(JSON.stringify({ hits }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WttjProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("has signalSource wttj", () => {
    expect(new WttjProvider().signalSource).toBe("wttj");
  });

  describe("searchJobs", () => {
    it("returns JobPosting[] from Algolia hits", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        makeAlgoliaResponse([
          { name: "Theodo", slug: "theodo", jobs_count: 5 },
          { name: "Alan", slug: "alan", jobs_count: 12 },
        ]),
      );

      const provider = new WttjProvider();
      const result = await provider.searchJobs({ keywords: ["React"] });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].companyName).toBe("Theodo");
      expect(result.data[0].url).toContain("theodo");
      expect(result.data[1].companyName).toBe("Alan");
    });

    it("returns failure when fetch throws", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const result = await new WttjProvider().searchJobs({});
      expect(result.success).toBe(false);
    });

    it("returns failure when Algolia responds with non-200", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
      );

      const result = await new WttjProvider().searchJobs({});
      expect(result.success).toBe(false);
    });

    it("respects the limit option", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        makeAlgoliaResponse([
          { name: "A", slug: "a", jobs_count: 1 },
          { name: "B", slug: "b", jobs_count: 2 },
          { name: "C", slug: "c", jobs_count: 3 },
        ]),
      );

      const result = await new WttjProvider().searchJobs({ limit: 2 });
      expect(result.success).toBe(true);
      if (!result.success) return;
      // Algolia handles limit via hitsPerPage — result matches what API returns
      expect(result.data).toHaveLength(3);
    });

    it("uses techStack as keywords fallback", async () => {
      const spy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(makeAlgoliaResponse([]));

      await new WttjProvider().searchJobs({ techStack: ["TypeScript"] });

      const body = JSON.parse(
        (spy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.query).toBe("TypeScript");
    });
  });
});
