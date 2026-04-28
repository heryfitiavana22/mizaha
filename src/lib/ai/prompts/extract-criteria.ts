import { z } from "zod";
import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/llm";

export const searchCriteriaSchema = z.object({
  sector: z
    .string()
    .optional()
    .describe(
      "Business sector or industry (e.g. SaaS, e-commerce, fintech). Omit if not mentioned.",
    ),
  location: z
    .string()
    .optional()
    .describe(
      "Geographic location in France (e.g. Paris, Île-de-France, Lyon). Omit if not mentioned.",
    ),
  signals: z
    .array(z.string())
    .describe(
      "Qualifying signals found in the query. Use these exact strings: recently_funded, hiring_dev, no_internal_dev, new_product, weak_online_presence, growing_team",
    ),
  techStack: z
    .array(z.string())
    .optional()
    .describe(
      "Technologies explicitly mentioned (e.g. React, Node.js, Python). Omit if none mentioned.",
    ),
  employeeRange: z
    .object({ min: z.number(), max: z.number() })
    .optional()
    .describe("Employee count range if mentioned. Omit if not specified."),
});

export function buildExtractCriteriaPrompt({
  rawQuery,
  useCase,
}: ExtractCriteriaInput): string {
  return `You are a B2B lead generation assistant specialized in French companies.

Use case context: ${useCase}

The user is a French professional looking for potential client companies. Extract structured search criteria from their natural language query.

Query: "${rawQuery}"

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
