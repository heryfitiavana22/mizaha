import { z } from "zod";
import type { QualifyInput } from "@/lib/providers/interfaces/llm";

export const qualificationResultSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Relevance score from 0.0 (no match) to 1.0 (perfect match)"),
  reason: z
    .string()
    .describe(
      "Human-readable explanation in French of why this company matches or does not match the criteria",
    ),
  matchedSignals: z
    .array(z.string())
    .describe(
      "Signals from the criteria that are confirmed by the company data",
    ),
});

export function buildQualifyPrompt({
  company,
  criteria,
}: QualifyInput): string {
  const techLine = criteria.techStack?.length
    ? `\n- Tech stack required: ${criteria.techStack.join(", ")}`
    : "";
  const rangeLine = criteria.employeeRange
    ? `\n- Employee count: between ${criteria.employeeRange.min} and ${criteria.employeeRange.max}`
    : "";

  return `You are a B2B lead qualification assistant. Evaluate how well this company matches the search criteria.

Company:
- Name: ${company.name}
- Domain: ${company.domain}
- Sector: ${company.sector || "unknown"}
- Location: ${company.location || "unknown"}
${company.employeeCount ? `- Employees: ${company.employeeCount}` : ""}

Search criteria:
- Sector: ${criteria.sector ?? "any"}
- Location: ${criteria.location ?? "any"}
- Signals to find: ${criteria.signals.join(", ")}${techLine}${rangeLine}

Scoring guide:
- 0.0–0.3: poor match, missing most criteria
- 0.4–0.6: partial match, some criteria met
- 0.7–0.9: strong match, most criteria confirmed
- 1.0: perfect match

Only list signals in matchedSignals that are actually confirmed by the company data.
Write the reason in French — it will be shown directly to the user.`;
}
