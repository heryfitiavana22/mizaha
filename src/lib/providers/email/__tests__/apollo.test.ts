import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApolloEmailProvider } from "@/lib/providers/email/apollo";

vi.mock("@/env", () => ({
  env: { APOLLO_API_KEY: "test-apollo-key" },
}));

const fakeSearchResponse = {
  people: [
    { id: "person-1", first_name: "Alice", has_email: true },
    { id: "person-2", first_name: "Bob", has_email: false },
  ],
};

const fakeMatchResponse = {
  person: {
    id: "person-1",
    first_name: "Alice",
    last_name: "Martin",
    title: "CTO",
    email: "alice@acme.fr",
    linkedin_url: "https://linkedin.com/in/alice",
  },
};

describe("ApolloEmailProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("findByDomain", () => {
    it("searches people then reveals emails for candidates that have one", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeSearchResponse), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeMatchResponse), { status: 200 }),
        );

      const provider = new ApolloEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      // person-2 has has_email=false → skipped; person-1 revealed
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("alice@acme.fr");
      expect(result.data[0].name).toBe("Alice Martin");
      // fetch called twice: search + one reveal
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("returns empty list when no people have emails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ people: [{ id: "x", has_email: false }] }),
          { status: 200 },
        ),
      );

      const provider = new ApolloEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result).toEqual({ success: true, data: [] });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns failure on non-ok HTTP response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 401 }),
      );

      const provider = new ApolloEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain("401");
    });

    it("skips contacts where reveal returns no email", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              people: [{ id: "person-1", has_email: true }],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ person: {} }), { status: 200 }),
        );

      const provider = new ApolloEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result).toEqual({ success: true, data: [] });
    });
  });

  describe("findContact", () => {
    it("returns contact when found by name and domain", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(fakeMatchResponse), { status: 200 }),
      );

      const provider = new ApolloEmailProvider();
      const result = await provider.findContact({
        name: "Alice Martin",
        domain: "acme.fr",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.email).toBe("alice@acme.fr");
      expect(result.data?.title).toBe("CTO");
    });

    it("returns null when person has no email", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ person: {} }), { status: 200 }),
      );

      const provider = new ApolloEmailProvider();
      const result = await provider.findContact({
        name: "Unknown Person",
        domain: "acme.fr",
      });

      expect(result).toEqual({ success: true, data: null });
    });

    it("correctly splits first and last name", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ person: {} }), { status: 200 }),
      );

      const provider = new ApolloEmailProvider();
      await provider.findContact({ name: "Alice Martin", domain: "acme.fr" });

      const body = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]?.body as string,
      ) as Record<string, unknown>;
      expect(body.first_name).toBe("Alice");
      expect(body.last_name).toBe("Martin");
    });
  });
});
