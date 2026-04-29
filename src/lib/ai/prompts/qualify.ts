import { z } from "zod";
import type { QualifyInput } from "@/lib/providers/interfaces/llm";

export const qualificationResultSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Relevance score from 0.0 (no match) to 1.0 (perfect match)."),
  reason: z
    .string()
    .describe(
      "Human-readable explanation in French of why this company matches or does not match. Shown directly to the user.",
    ),
  matchedCriteria: z
    .array(z.string())
    .describe(
      "Qualification criteria that are actually confirmed by the website content. Only include criteria with clear evidence.",
    ),
});

const MAX_SCRAPED_CONTENT_CHARS = 4000;

export function buildQualifyPrompt({
  company,
  criteria,
  scrapedContent,
}: QualifyInput): string {
  const techLine = criteria.techStack?.length
    ? `\n- Required tech stack: ${criteria.techStack.join(", ")}`
    : "";
  const rangeLine = criteria.employeeRange
    ? `\n- Employee count: between ${criteria.employeeRange.min} and ${criteria.employeeRange.max}`
    : "";
  const personaLine = criteria.targetPersona
    ? `\n- Target persona: ${criteria.targetPersona}`
    : "";

  const criteriaList = criteria.qualificationCriteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  return `You are a B2B lead qualification assistant. Evaluate how well this company matches the search criteria.

Company:
- Name: ${company.name}
- Domain: ${company.domain}
- Sector: ${company.sector || "unknown"}
- Location: ${company.location || "unknown"}
${company.employeeCount ? `- Employees: ${company.employeeCount}` : ""}

Search criteria:
- Sector: ${criteria.sector ?? "any"}
- Location: ${criteria.location ?? "France"}${techLine}${rangeLine}${personaLine}

Criteria to verify on this website:
${criteriaList}

Website content (extract):
${scrapedContent.slice(0, MAX_SCRAPED_CONTENT_CHARS)}

Scoring guide:
- 0.0–0.3: poor match, most criteria not met
- 0.4–0.6: partial match, some criteria confirmed
- 0.7–0.9: strong match, most criteria confirmed
- 1.0: perfect match

Only list criteria in matchedCriteria that are clearly confirmed by the website content.
Write the reason in French — it will be displayed directly to the user.`;
}
