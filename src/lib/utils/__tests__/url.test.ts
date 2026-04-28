import { describe, expect, it } from "vitest";
import { buildCompanyUrl, extractDomain } from "@/lib/utils/url";

describe("extractDomain", () => {
  it("strips www from hostname", () => {
    expect(extractDomain({ url: "https://www.acme.fr/path?q=1" })).toBe(
      "acme.fr",
    );
  });

  it("returns hostname for URL without www", () => {
    expect(extractDomain({ url: "https://acme.fr" })).toBe("acme.fr");
  });

  it("ignores port in hostname", () => {
    expect(extractDomain({ url: "https://acme.fr:8080/path" })).toBe("acme.fr");
  });

  it("returns null for invalid URL", () => {
    expect(extractDomain({ url: "not-a-url" })).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDomain({ url: "" })).toBeNull();
  });
});

describe("buildCompanyUrl", () => {
  it("prepends https:// to domain", () => {
    expect(buildCompanyUrl({ domain: "acme.fr" })).toBe("https://acme.fr");
  });
});
