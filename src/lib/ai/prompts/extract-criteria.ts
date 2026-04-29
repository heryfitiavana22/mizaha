import { z } from "zod";
import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/llm";

export const searchCriteriaSchema = z.object({
  sector: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Business sector or industry (e.g. SaaS, e-commerce, fintech). null if not mentioned.",
    ),

  location: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "City or region in France (e.g. Paris, Lyon, Île-de-France). null if not mentioned.",
    ),

  techStack: z
    .array(z.string())
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Technologies explicitly mentioned (e.g. React, Node.js, Python). null if none.",
    ),

  employeeRange: z
    .object({ min: z.number(), max: z.number() })
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Employee count range if mentioned. null if not specified."),

  targetPersona: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Specific role to target if mentioned (e.g. CTO, Head of Product, HR Director). null if not mentioned.",
    ),

  maxResults: z
    .number()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Maximum number of results explicitly requested by the user. null if not specified.",
    ),

  searchStrategies: z
    .array(z.string())
    .describe(
      "3 to 5 search queries ready to be sent to a web search engine. " +
        "Goal: surface pages of REAL companies (their own website, careers page, blog, news coverage) — not aggregated job board listings. " +
        "Vary the angles: company careers pages, funding announcements, sector news, tech blogs. " +
        "Avoid site: operators pointing to aggregated job boards (indeed.com, linkedin.com, welcometothejungle.com) — they list many companies at once. " +
        "Prefer queries that land on a specific company's own page. " +
        "Examples: 'startup SaaS TypeScript Node.js recrutement Paris site:...', " +
        "'\"nous recrutons\" développeur senior fintech France 2024', " +
        "'levée de fonds startup React 2024 site:...'",
    ),

  qualificationCriteria: z
    .array(z.string())
    .describe(
      "2 to 4 criteria to verify on each company website to confirm relevance. " +
        "Written in French as affirmations to validate — they will be shown to the user. " +
        "Be specific and verifiable from website content. " +
        "Examples: \"L'entreprise a une offre d'emploi développeur ouverte\", " +
        '"Aucun développeur interne visible dans l\'équipe ou sur le site", ' +
        '"L\'entreprise a annoncé un financement récent"',
    ),
});

function flattenUiCriteria({
  uiCriteria,
}: {
  uiCriteria: Record<string, unknown>;
}): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(uiCriteria)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        flat[nestedKey] = nestedValue;
      }
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

export function buildExtractCriteriaPrompt({
  rawQuery,
  useCase,
  uiCriteria,
}: ExtractCriteriaInput): string {
  const flat =
    uiCriteria && Object.keys(uiCriteria).length > 0
      ? flattenUiCriteria({ uiCriteria })
      : {};

  const uiCriteriaSection =
    Object.keys(flat).length > 0
      ? `\n\nThe user also explicitly selected the following criteria via the UI — treat these as hard constraints:\n${Object.entries(
          flat,
        )
          .map(
            ([k, v]) =>
              `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
          )
          .join("\n")}`
      : "";

  return `You are a B2B lead generation assistant specialized in French companies.

Use case: ${useCase}

Extract structured search criteria from the user's natural language query.

Query: "${rawQuery}"${uiCriteriaSection}

Instructions:
- For searchStrategies: generate queries that find specific company pages (careers, about, blog, news coverage). Avoid queries that return aggregated job boards — the goal is to land on a real company's own page, not a listing of many companies.
- For qualificationCriteria: write in French what must be found on the company website to confirm relevance. Each criterion must be verifiable from website content.
- Omit optional fields if they are not mentioned and cannot be reliably inferred.`;
}
