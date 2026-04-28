export function extractDomain({ url }: { url: string }): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function buildCompanyUrl({ domain }: { domain: string }): string {
  return `https://${domain}`;
}
