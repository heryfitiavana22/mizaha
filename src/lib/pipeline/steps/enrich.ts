import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type {
  Contact,
  EnrichedCompany,
  QualifiedCompany,
  Result,
} from "@/types";

const MAX_CONTACTS = 3;

type EnrichOptions = {
  companies: QualifiedCompany[];
  email: EmailProvider;
};

function extractEmailsFromContent({
  content,
  domain,
}: {
  content: string;
  domain: string;
}): Contact[] {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`[a-zA-Z0-9._%+\\-]+@${escaped}`, "gi");
  const emails = [
    ...new Set((content.match(pattern) ?? []).map((e) => e.toLowerCase())),
  ];

  return emails.slice(0, MAX_CONTACTS).map((email) => ({
    email,
    confidence: 50,
  }));
}

async function enrichOne({
  company,
  email,
}: {
  company: QualifiedCompany;
  email: EmailProvider;
}): Promise<EnrichedCompany> {
  // Reuse content already scraped by qualify — avoids a second Firecrawl credit
  if (company.scrapedContent) {
    const contacts = extractEmailsFromContent({
      content: company.scrapedContent,
      domain: company.domain,
    });
    if (contacts.length > 0) {
      return { ...company, contacts };
    }
  }

  // No content or no emails found in it — fall back to email provider
  const contactsResult = await email.findByDomain(company.domain);
  const contacts = contactsResult.success ? contactsResult.data : [];
  return { ...company, contacts };
}

export async function enrich({
  companies,
  email,
}: EnrichOptions): Promise<Result<EnrichedCompany[]>> {
  const settlements = await Promise.allSettled(
    companies.map((company) => enrichOne({ company, email })),
  );

  const enriched = settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);

  return { success: true, data: enriched };
}
