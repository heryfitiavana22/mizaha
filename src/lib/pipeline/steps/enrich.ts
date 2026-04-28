import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { EnrichedCompany, QualifiedCompany, Result } from "@/types";

type EnrichOptions = {
  companies: QualifiedCompany[];
  email: EmailProvider;
};

export async function enrich({
  companies,
  email,
}: EnrichOptions): Promise<Result<EnrichedCompany[]>> {
  const enriched: EnrichedCompany[] = [];

  for (const company of companies) {
    const contactsResult = await email.findByDomain(company.domain);
    const contacts = contactsResult.success ? contactsResult.data : [];
    enriched.push({ ...company, contacts });
  }

  return { success: true, data: enriched };
}
