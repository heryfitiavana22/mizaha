import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type {
  Contact,
  EnrichedCompany,
  EnrichedJobOffer,
  QualifiedCompany,
  QualifiedJobOffer,
  Result,
} from "@/types";

const MAX_CONTACTS = 3;

export type EnrichCompaniesOptions = {
  entities: QualifiedCompany[];
  email: EmailProvider;
};

export type EnrichJobOffersOptions = {
  entities: QualifiedJobOffer[];
  company: CompanyProvider;
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
    ...new Set(
      (content.match(pattern) ?? []).map((email) => email.toLowerCase()),
    ),
  ];
  return emails
    .slice(0, MAX_CONTACTS)
    .map((email) => ({ email, confidence: 50 }));
}

async function enrichOneCompany({
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
    if (contacts.length > 0) return { ...company, contacts };
  }

  const contactsResult = await email.findByDomain(company.domain);
  const contacts = contactsResult.success ? contactsResult.data : [];
  return { ...company, contacts };
}

async function enrichOneJobOffer({
  offer,
  company,
}: {
  offer: QualifiedJobOffer;
  company: CompanyProvider;
}): Promise<EnrichedJobOffer> {
  const companyResult = await company.findByName(offer.companyName);
  const companyData =
    companyResult.success && companyResult.data
      ? companyResult.data
      : undefined;
  return { ...offer, company: companyData, contacts: [] };
}

export async function enrichCompanies({
  entities,
  email,
}: EnrichCompaniesOptions): Promise<Result<EnrichedCompany[]>> {
  const settlements = await Promise.allSettled(
    entities.map((company) => enrichOneCompany({ company, email })),
  );
  const enriched = settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => (s as PromiseFulfilledResult<EnrichedCompany>).value);
  return { success: true, data: enriched };
}

// SIRENE rate limit: 7 req/s — 3 concurrent + 150ms between chunks to stay safe
const SIRENE_CONCURRENCY = 3;
const SIRENE_CHUNK_DELAY_MS = 150;

export async function enrichJobOffers({
  entities,
  company,
}: EnrichJobOffersOptions): Promise<Result<EnrichedJobOffer[]>> {
  const enriched: EnrichedJobOffer[] = [];
  for (let i = 0; i < entities.length; i += SIRENE_CONCURRENCY) {
    if (i > 0) await new Promise((r) => setTimeout(r, SIRENE_CHUNK_DELAY_MS));
    const chunk = entities.slice(i, i + SIRENE_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((offer) => enrichOneJobOffer({ offer, company })),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      enriched.push(
        r.status === "fulfilled" ? r.value : { ...chunk[j], contacts: [] },
      );
    }
  }
  return { success: true, data: enriched };
}
