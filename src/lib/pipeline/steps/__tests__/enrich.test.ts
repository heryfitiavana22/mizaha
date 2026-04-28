import { describe, expect, it, vi } from "vitest";
import { enrich } from "@/lib/pipeline/steps/enrich";
import { fakeQualifiedCompany } from "@/tests/fixtures/company";
import { makeMockEmailProvider } from "@/tests/mocks/providers";

describe("enrich", () => {
  it("returns enriched companies with contacts", async () => {
    const email = makeMockEmailProvider();

    const result = await enrich({
      companies: [fakeQualifiedCompany],
      email,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].contacts).toHaveLength(1);
    expect(result.data[0].contacts[0].email).toBe("alice@acme.fr");
  });

  it("returns empty contacts when email provider fails — does not propagate error", async () => {
    const email = makeMockEmailProvider({
      findByDomain: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("API down") }),
    });

    const result = await enrich({
      companies: [fakeQualifiedCompany],
      email,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].contacts).toEqual([]);
  });

  it("returns empty list when no companies are provided", async () => {
    const email = makeMockEmailProvider();

    const result = await enrich({ companies: [], email });

    expect(result).toEqual({ success: true, data: [] });
  });
});
