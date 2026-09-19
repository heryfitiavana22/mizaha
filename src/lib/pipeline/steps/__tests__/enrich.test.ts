import { describe, expect, it, vi } from "vitest";
import { enrichCompanies, enrichJobOffers } from "@/lib/pipeline/steps/enrich";
import { fakeCompany, fakeQualifiedCompany } from "@/tests/fixtures/company";
import { fakeQualifiedJobOffer } from "@/tests/fixtures/job-posting";
import {
  makeMockCompanyProvider,
  makeMockEmailProvider,
} from "@/tests/mocks/providers";

describe("enrichCompanies", () => {
  it("extracts contacts from scrapedContent when emails are present", async () => {
    const qualifiedWithContent = {
      ...fakeQualifiedCompany,
      scrapedContent:
        "Contact us at jobs@acme.fr or hello@acme.fr for more info.",
    };

    const result = await enrichCompanies({
      entities: [qualifiedWithContent],
      email: makeMockEmailProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].contacts.length).toBeGreaterThan(0);
    expect(result.data[0].contacts[0].email).toContain("@acme.fr");
  });

  it("falls back to email provider when no emails in scrapedContent", async () => {
    const result = await enrichCompanies({
      entities: [fakeQualifiedCompany],
      email: makeMockEmailProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].contacts).toHaveLength(1);
    expect(result.data[0].contacts[0].email).toBe("alice@acme.fr");
  });

  it("returns empty contacts when email provider fails — does not propagate error", async () => {
    const email = makeMockEmailProvider({
      findByDomain: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("API down") }),
    });

    const result = await enrichCompanies({
      entities: [fakeQualifiedCompany],
      email,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].contacts).toEqual([]);
  });

  it("returns empty list when no entities are provided", async () => {
    const result = await enrichCompanies({
      entities: [],
      email: makeMockEmailProvider(),
    });

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("enrichJobOffers", () => {
  it("enriches job offer with company data from name lookup", async () => {
    const result = await enrichJobOffers({
      entities: [fakeQualifiedJobOffer],
      company: makeMockCompanyProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].company).toEqual(fakeCompany);
    expect(result.data[0].contacts).toEqual([]);
  });

  it("sets company to undefined when findByName returns null", async () => {
    const company = makeMockCompanyProvider({
      findByName: vi.fn().mockResolvedValue({ success: true, data: null }),
    });

    const result = await enrichJobOffers({
      entities: [fakeQualifiedJobOffer],
      company,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].company).toBeUndefined();
  });

  it("sets company to undefined when findByName fails", async () => {
    const company = makeMockCompanyProvider({
      findByName: vi
        .fn()
        .mockResolvedValue({
          success: false,
          error: new Error("Pappers down"),
        }),
    });

    const result = await enrichJobOffers({
      entities: [fakeQualifiedJobOffer],
      company,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].company).toBeUndefined();
  });
});
