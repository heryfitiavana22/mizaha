import { z } from "zod";
import type { QualifyInput } from "@/lib/providers/interfaces/llm";
import type { CompanyData, JobPosting } from "@/types";

export const qualificationResultSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Relevance score from 0.0 (no match) to 1.0 (perfect match)."),
  reason: z
    .string()
    .describe(
      "Human-readable explanation in French of why this entity matches or does not match. Shown directly to the user.",
    ),
  matchedCriteria: z
    .array(z.string())
    .describe(
      "Qualification criteria that are actually confirmed by the content. Only include criteria with clear evidence.",
    ),
});

const MAX_SCRAPED_CONTENT_CHARS = 4000;

function formatEntityDescription({
  entity,
}: {
  entity: CompanyData | JobPosting;
}): string {
  if ("domain" in entity) {
    return `Company:
- Name: ${entity.name}
- Domain: ${entity.domain}
- Sector: ${entity.sector || "unknown"}
- Location: ${entity.location || "unknown"}
${entity.employeeCount ? `- Employees: ${entity.employeeCount}` : ""}`;
  }
  return `Job offer:
- Title: ${entity.title}
- Company: ${entity.companyName}
- Location: ${entity.location}
- Contract: ${entity.contractType}
${entity.techStack?.length ? `- Tech stack: ${entity.techStack.join(", ")}` : ""}`;
}

export function buildQualifyPrompt({
  entity,
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
    .map((criterion, index) => `${index + 1}. ${criterion}`)
    .join("\n");

  return `You are a B2B lead qualification assistant. Evaluate how well this entity matches the search criteria.

${formatEntityDescription({ entity })}

Search criteria:
- Sector: ${criteria.sector ?? "any"}
- Location: ${criteria.location ?? "France"}${techLine}${rangeLine}${personaLine}

Criteria to verify:
${criteriaList}

Content (extract):
${scrapedContent.slice(0, MAX_SCRAPED_CONTENT_CHARS)}

Scoring guide:
- 0.0–0.3: poor match, most criteria not met
- 0.4–0.6: partial match, some criteria confirmed
- 0.7–0.9: strong match, most criteria confirmed
- 1.0: perfect match

Hard criteria rule: the following are binary and non-negotiable. If the content explicitly contradicts any of them, the score MUST NOT exceed 0.4, regardless of how well other criteria are met:
- Contract type: posting is CDI/CDD but freelance is required, or vice versa
- Remote policy: posting is on-site or hybrid but full remote is explicitly required
- Tech stack: posting mentions only completely unrelated technologies with zero overlap with the required stack (e.g., required TypeScript/Node.js but posting only mentions SAP, COBOL, or mainframe)
- Organizational type: entity is a recruitment agency, ESN, or staffing firm when the criterion forbids it

Only list criteria in matchedCriteria that are clearly confirmed by the content.
Write the reason in French — it will be displayed directly to the user.`;
}
