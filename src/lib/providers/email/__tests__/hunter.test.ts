import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HunterEmailProvider } from "@/lib/providers/email/hunter";

vi.mock("@/env", () => ({
  env: { HUNTER_API_KEY: "test-hunter-key" },
}));

describe("HunterEmailProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("findByDomain", () => {
    it("returns contacts for a domain", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              emails: [
                {
                  value: "alice@acme.fr",
                  first_name: "Alice",
                  last_name: "Martin",
                  position: "CTO",
                  confidence: 90,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

      const provider = new HunterEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("alice@acme.fr");
      expect(result.data[0].name).toBe("Alice Martin");
    });

    it("skips emails without a value", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { emails: [{ position: "CEO" }] } }),
          { status: 200 },
        ),
      );

      const provider = new HunterEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(0);
    });

    it("returns failure on non-ok HTTP response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 401 }),
      );

      const provider = new HunterEmailProvider();
      const result = await provider.findByDomain("acme.fr");

      expect(result.success).toBe(false);
    });
  });

  describe("findContact", () => {
    it("returns null when no email is found", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      );

      const provider = new HunterEmailProvider();
      const result = await provider.findContact({
        name: "Alice Martin",
        domain: "acme.fr",
      });

      expect(result).toEqual({ success: true, data: null });
    });

    it("returns contact when email is found", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              email: "alice@acme.fr",
              first_name: "Alice",
              last_name: "Martin",
              position: "CTO",
              score: 88,
            },
          }),
          { status: 200 },
        ),
      );

      const provider = new HunterEmailProvider();
      const result = await provider.findContact({
        name: "Alice Martin",
        domain: "acme.fr",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.email).toBe("alice@acme.fr");
      expect(result.data?.confidence).toBe(88);
    });
  });
});
