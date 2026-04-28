import { z } from "zod";
import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/llm";

// OpenAI Structured Outputs: all fields must be in `required` — use .nullable() + transform to keep SearchCriteria types unchanged
export const searchCriteriaSchema = z.object({
  sector: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Business sector or industry (e.g. SaaS, e-commerce, fintech). Use null if not mentioned.",
    ),
  location: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Geographic location in France (e.g. Paris, Île-de-France, Lyon). Use null if not mentioned.",
    ),
  signals: z
    .array(z.string())
    .describe(
      "Qualifying signals found in the query. Use these exact strings: recently_funded, hiring_dev, no_internal_dev, new_product, weak_online_presence, growing_team",
    ),
  techStack: z
    .array(z.string())
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Technologies explicitly mentioned (e.g. React, Node.js, Python). Use null if none mentioned.",
    ),
  employeeRange: z
    .object({ min: z.number(), max: z.number() })
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Employee count range if mentioned. Use null if not specified."),
});

export function buildExtractCriteriaPrompt({
  rawQuery,
  useCase,
  uiCriteria,
}: ExtractCriteriaInput): string {
  const uiCriteriaSection =
    uiCriteria && Object.keys(uiCriteria).length > 0
      ? `\n\nThe user also explicitly selected the following criteria via the UI — treat these as high-confidence signals:\n${Object.entries(
          uiCriteria,
        )
          .map(
            ([k, v]) =>
              `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
          )
          .join("\n")}`
      : "";

  return `You are a B2B lead generation assistant specialized in French companies.

Use case context: ${useCase}

The user is a French professional looking for potential client companies. Extract structured search criteria from their natural language query.

Query: "${rawQuery}"${uiCriteriaSection}

Available signals — use these exact strings when the query implies them:
- "recently_funded": company received funding recently
- "hiring_dev": company has open developer positions
- "no_internal_dev": company has no internal developer
- "new_product": company launched a new product or feature
- "weak_online_presence": company has an outdated or minimal web presence
- "growing_team": company is hiring actively and expanding

If no signals are explicitly mentioned, infer the most relevant ones from the use case context and query intent.
Omit optional fields entirely if they are not mentioned or cannot be inferred.`;
}
