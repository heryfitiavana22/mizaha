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

export type EnrichOptions = {
  entities: QualifiedCompany[] | QualifiedJobOffer[];
  targetEntity: "company" | "job_offer";
  company: CompanyProvider;
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

async function enrichCompanies({
  companies,
  email,
}: {
  companies: QualifiedCompany[];
  email: EmailProvider;
}): Promise<Result<EnrichedCompany[]>> {
  const settlements = await Promise.allSettled(
    companies.map((company) => enrichOneCompany({ company, email })),
  );
  const enriched = settlements
    .filter((settlement) => settlement.status === "fulfilled")
    .map((settlement) => settlement.value);
  return { success: true, data: enriched };
}

async function enrichJobOffers({
  offers,
  company,
}: {
  offers: QualifiedJobOffer[];
  company: CompanyProvider;
}): Promise<Result<EnrichedJobOffer[]>> {
  const settlements = await Promise.allSettled(
    offers.map((offer) => enrichOneJobOffer({ offer, company })),
  );
  const enriched = settlements
    .filter((settlement) => settlement.status === "fulfilled")
    .map((settlement) => settlement.value);
  return { success: true, data: enriched };
}

export async function enrich({
  entities,
  targetEntity,
  company,
  email,
}: EnrichOptions): Promise<Result<EnrichedCompany[] | EnrichedJobOffer[]>> {
  if (targetEntity === "job_offer") {
    return enrichJobOffers({
      offers: entities as QualifiedJobOffer[],
      company,
    });
  }
  return enrichCompanies({ companies: entities as QualifiedCompany[], email });
}
