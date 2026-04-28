import logger from "@/lib/logger";
import type {
  EmailProvider,
  FindContactInput,
} from "@/lib/providers/interfaces/email";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import type { Contact, Result } from "@/types";

const MAX_CONTACTS = 3;
const MAX_PAGES_TO_SCRAPE = 3;

// Common contact page paths — French + English, tried when search returns no URLs
const FALLBACK_PATHS = [
  "/contact",
  "/nous-contacter",
  "/equipe",
  "/team",
  "/a-propos",
  "/about",
  "/staff",
];

function escapeForRegex({ value }: { value: string }): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractEmailsFromText({
  text,
  domain,
}: {
  text: string;
  domain: string;
}): string[] {
  const pattern = new RegExp(
    `[a-zA-Z0-9._%+\\-]+@${escapeForRegex({ value: domain })}`,
    "gi",
  );
  return [...new Set((text.match(pattern) ?? []).map((e) => e.toLowerCase()))];
}

function inferContactFromContext({
  content,
  email,
}: {
  content: string;
  email: string;
}): Pick<Contact, "name" | "title"> {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) =>
    l.toLowerCase().includes(email.toLowerCase()),
  );
  if (idx === -1) return {};

  const surroundingLines = lines
    .slice(Math.max(0, idx - 2), idx + 3)
    .join(" ")
    .replace(email, "")
    .replace(/[#*_[\]`]/g, " ") // strip markdown markers
    .replace(/\s+/g, " ")
    .trim();

  // 2–3 consecutive words starting with uppercase covers French accented names
  const nameMatch = surroundingLines.match(
    /\b([A-ZÁÀÂÄÉÈÊËÍÎÏÓÔÖÙÛÜÇÆŒ][a-záàâäéèêëíîïóôöùûüçæœ\-]+(?:\s+[A-ZÁÀÂÄÉÈÊËÍÎÏÓÔÖÙÛÜÇÆŒ][a-záàâäéèêëíîïóôöùûüçæœ\-]+){1,2})\b/,
  );

  const titleMatch = surroundingLines.match(
    /\b(CEO|CTO|COO|CFO|Fondateur|Co-fondateur|Founder|Co-founder|Directeur|Directrice|Président|Présidente|Manager|Responsable|Développeur|Ingénieur|Engineer|Developer)\b/i,
  );

  return {
    name: nameMatch?.[1],
    title: titleMatch?.[0],
  };
}

async function scrapeAndExtract({
  scraperProvider,
  url,
  domain,
}: {
  scraperProvider: ScraperProvider;
  url: string;
  domain: string;
}): Promise<Contact[]> {
  const result = await scraperProvider.scrape(url);
  if (!result.success) return [];

  const emails = extractEmailsFromText({ text: result.data.content, domain });
  return emails.map((email) => {
    const contactContext = inferContactFromContext({
      content: result.data.content,
      email,
    });
    return {
      email,
      name: contactContext.name,
      title: contactContext.title,
      confidence: contactContext.name ? 60 : 40,
    };
  });
}

function deduplicateContacts({
  contacts,
  seenEmails,
  incoming,
}: {
  contacts: Contact[];
  seenEmails: Set<string>;
  incoming: Contact[];
}): void {
  for (const contact of incoming) {
    if (!seenEmails.has(contact.email)) {
      seenEmails.add(contact.email);
      contacts.push(contact);
    }
  }
}

async function scrapePageSet({
  urls,
  scraperProvider,
  domain,
  seenEmails,
  contacts,
}: {
  urls: string[];
  scraperProvider: ScraperProvider;
  domain: string;
  seenEmails: Set<string>;
  contacts: Contact[];
}): Promise<void> {
  for (const url of urls) {
    if (contacts.length >= MAX_CONTACTS) break;

    const found = await scrapeAndExtract({ scraperProvider, url, domain });
    deduplicateContacts({ contacts, seenEmails, incoming: found });
  }
}

// Composite email provider: Brave Search + Firecrawl.
// Strategy: check search snippets first (zero scrape credits), then scrape
// only pages the search engine already identified as relevant.
export class FirecrawlEmailProvider implements EmailProvider {
  constructor(
    private searchProvider: SearchProvider,
    private scraperProvider: ScraperProvider,
  ) {}

  async findByDomain(domain: string): Promise<Result<Contact[]>> {
    const start = Date.now();

    try {
      const seenEmails = new Set<string>();
      const contacts: Contact[] = [];
      const candidateUrls: string[] = [];

      const searchResult = await this.searchProvider.search({
        query: `site:${domain} email contact`,
        options: { limit: 5 },
      });

      if (searchResult.success) {
        for (const result of searchResult.data) {
          const snippetEmails = extractEmailsFromText({
            text: result.snippet,
            domain,
          });
          deduplicateContacts({
            contacts,
            seenEmails,
            incoming: snippetEmails.map((email) => ({ email, confidence: 50 })),
          });
          candidateUrls.push(result.url);
        }
      }

      // Scrape targeted pages only if snippets yielded nothing
      if (contacts.length === 0) {
        const urlsToScrape =
          candidateUrls.length > 0
            ? candidateUrls.slice(0, MAX_PAGES_TO_SCRAPE)
            : FALLBACK_PATHS.slice(0, MAX_PAGES_TO_SCRAPE).map(
                (path) => `https://${domain}${path}`,
              );

        await scrapePageSet({
          urls: urlsToScrape,
          scraperProvider: this.scraperProvider,
          domain,
          seenEmails,
          contacts,
        });
      }

      logger.info(
        {
          provider: "firecrawl-email",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "success",
          count: contacts.length,
        },
        "API call completed",
      );

      return { success: true, data: contacts.slice(0, MAX_CONTACTS) };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "firecrawl-email",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async findContact({
    name,
    domain,
  }: FindContactInput): Promise<Result<Contact | null>> {
    const start = Date.now();

    try {
      // Search broadly: email often surfaces in snippets from directories, LinkedIn, etc.
      const searchResult = await this.searchProvider.search({
        query: `"${name}" "@${domain}"`,
        options: { limit: 3 },
      });

      if (searchResult.success) {
        const contact = await this.resolveContactFromSearch({
          name,
          domain,
          searchResults: searchResult.data,
          start,
        });
        if (contact !== undefined) return contact;
      }

      logger.info(
        {
          provider: "firecrawl-email",
          method: "findContact",
          durationMs: Date.now() - start,
          status: "success",
          found: false,
        },
        "API call completed",
      );

      return { success: true, data: null };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "firecrawl-email",
          method: "findContact",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  private async resolveContactFromSearch({
    name,
    domain,
    searchResults,
    start,
  }: {
    name: string;
    domain: string;
    searchResults: { url: string; snippet: string }[];
    start: number;
  }): Promise<Result<Contact | null> | undefined> {
    // Check snippets first — no scrape cost
    for (const result of searchResults) {
      const emails = extractEmailsFromText({ text: result.snippet, domain });
      if (emails[0]) {
        logger.info(
          {
            provider: "firecrawl-email",
            method: "findContact",
            durationMs: Date.now() - start,
            status: "success",
            found: true,
            source: "snippet",
          },
          "API call completed",
        );
        return {
          success: true,
          data: { email: emails[0], name, confidence: 65 },
        };
      }
    }

    // Scrape first result and look for this person's email
    if (searchResults.length === 0) return undefined;

    const found = await scrapeAndExtract({
      scraperProvider: this.scraperProvider,
      url: searchResults[0].url,
      domain,
    });
    const firstName = name.split(" ")[0].toLowerCase();
    const match = found.find(
      (contact) =>
        !contact.name || contact.name.toLowerCase().includes(firstName),
    );

    logger.info(
      {
        provider: "firecrawl-email",
        method: "findContact",
        durationMs: Date.now() - start,
        status: "success",
        found: !!match,
        source: "scrape",
      },
      "API call completed",
    );

    return { success: true, data: match ?? null };
  }
}
