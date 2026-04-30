import { z } from "zod";
import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/llm";

export const searchCriteriaSchema = z.object({
  targetEntity: z
    .enum(["company", "job_offer"])
    .describe(
      "What kind of entity to find. 'company' for B2B lead gen (freelance client search). 'job_offer' for job seekers.",
    ),

  signalSources: z
    .array(z.enum(["france_travail", "wttj", "pappers_search", "brave"]))
    .describe(
      "Which data sources to activate in discover. " +
        "Include 'france_travail' and/or 'wttj' when the query implies hiring signals. " +
        "Include 'pappers_search' for sector/location/size filters. " +
        "Include 'brave' for news or funding signals.",
    ),

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
      "Specific city or region in France (e.g. Paris, Lyon, Île-de-France). null if not mentioned or if the user means all of France ('françaises', 'en France', 'France' without a specific city).",
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
      "3 to 5 search queries ready to be sent to Brave Search. " +
        "Goal: surface pages of real individual companies — their own website, engineering blog, press coverage, funding news. NOT job boards or aggregated listings. " +
        "Target company-side signals that reveal the underlying need — not job-board vocabulary. " +
        "Vary the angles across these types: " +
        "(1) company blog or sector content — 'engineering blog startup TypeScript Node.js France', " +
        "(2) funding or growth news — 'levée de fonds startup France 2024 recrutement ingénieur', " +
        "(3) direct career page signal — '\"rejoindre notre équipe\" TypeScript Node.js startup France', " +
        "(4) press or sector coverage — 'startup SaaS France croissance équipe technique 2024'. " +
        "Write natural-language queries. Use at most one quoted phrase per query — stacking multiple quoted terms returns zero results. " +
        "You may use site:.fr to target French company pages specifically — but NEVER use site: with a plain word (site:company, site:careers are invalid and waste the query). " +
        "Avoid job-board vocabulary ('offre emploi', 'freelance mission', 'CDI développeur') — those surface job platforms, not company pages.",
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

targetEntity:
- Set to "company" when the user is looking for companies to prospect or contact (freelance client search, agency prospecting, B2B sales).
- Set to "job_offer" when the user is looking for a job, mission, or CDI for themselves.

signalSources — include only what the query implies:
- "france_travail": query implies a company is hiring — "recrutent", "ont un poste ouvert", "ont besoin d'un dev", "cherchent un développeur", or any phrasing suggesting an open position.
- "wttj": query mentions startups, tech companies, or tech stack — WTTJ specializes in tech startup jobs. Include alongside "france_travail" when both apply.
- "pappers_search": query mentions sector, size, location, or legal form — Pappers enables structured company lookup.
- "brave": query mentions funding ("levée de fonds"), recent news, or signals with no dedicated API.
- Always include at least one source. Include multiple when the query has several signal types. For "company" targetEntity with hiring signals, include BOTH "france_travail" AND "wttj" by default.

searchStrategies (only for targetEntity = "company"):
- 3 to 5 Brave queries targeting company-side pages — their blog, press coverage, funding news, career page.
- Never use job-board vocabulary ("offre emploi", "recrutement CDI") — those return job platforms, not company pages.
- One quoted phrase per query maximum.

qualificationCriteria:
- 3 to 5 criteria written in French as affirmations to verify on the entity.
- For companies: verifiable from the company website content.
- For job offers: verifiable from the job posting content.
- Be specific and observable — not vague assessments.
- Always include this negative criterion when targetEntity is "company": "L'entreprise n'est pas un cabinet de recrutement, une ESN, une agence d'intérim, ni un prestataire RH".

Omit optional fields if they are not mentioned and cannot be reliably inferred.`;
}
