import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { EnrichedCompany, QualifiedCompany, Result } from "@/types";

const SCORE_THRESHOLD = 0.35;

type EnrichOptions = {
  companies: QualifiedCompany[];
  email: EmailProvider;
};

export async function enrich({
  companies,
  email,
}: EnrichOptions): Promise<Result<EnrichedCompany[]>> {
  const above = companies.filter(
    (c) => c.qualification.score >= SCORE_THRESHOLD,
  );

  const settlements = await Promise.allSettled(
    above.map(async (company) => {
      const contactsResult = await email.findByDomain(company.domain);
      const contacts = contactsResult.success ? contactsResult.data : [];
      return { ...company, contacts } as EnrichedCompany;
    }),
  );

  const enriched = settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);

  return { success: true, data: enriched };
}
