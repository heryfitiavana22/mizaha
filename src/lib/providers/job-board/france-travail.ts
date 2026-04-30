import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  JobBoardProvider,
  JobSearchCriteria,
} from "@/lib/providers/interfaces/job-board";
import type { JobPosting, Result } from "@/types";

const AUTH_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const API_BASE_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2";
const DEFAULT_LIMIT = 20;

// Freelance maps closest to interim in France Travail taxonomy
const CONTRACT_TYPE_MAP: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  freelance: "MIS",
  alternance: "ALT",
};

type FranceTravailOffre = {
  id?: string;
  intitule?: string;
  entreprise?: { nom?: string };
  lieuTravail?: { libelle?: string };
  typeContrat?: string;
  description?: string;
  origineOffre?: { urlOrigine?: string };
  dateCreation?: string;
  competences?: { libelle?: string }[];
};

type FranceTravailSearchResponse = {
  resultats?: FranceTravailOffre[];
};

function isFranceTravailSearchResponse(
  data: unknown,
): data is FranceTravailSearchResponse {
  return typeof data === "object" && data !== null;
}

function toJobPosting({
  offre,
}: {
  offre: FranceTravailOffre;
}): JobPosting | null {
  if (!offre.intitule || !offre.entreprise?.nom) return null;
  return {
    title: offre.intitule,
    companyName: offre.entreprise.nom,
    location: offre.lieuTravail?.libelle ?? "",
    contractType: offre.typeContrat ?? "",
    description: offre.description ?? "",
    url: offre.origineOffre?.urlOrigine ?? `${API_BASE_URL}/offres/${offre.id}`,
    postedAt: offre.dateCreation,
    techStack: (offre.competences ?? [])
      .map((competence) => competence.libelle)
      .filter((label): label is string => Boolean(label)),
  };
}

async function fetchAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.FRANCE_TRAVAIL_CLIENT_ID,
    client_secret: env.FRANCE_TRAVAIL_CLIENT_SECRET,
    scope: "api_offresdemploiv2 o2dsoffre",
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok)
    throw new Error(`France Travail auth failed with ${response.status}`);

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in auth response");
  return data.access_token;
}

async function fetchOffres({
  criteria,
  token,
}: {
  criteria: JobSearchCriteria;
  token: string;
}): Promise<FranceTravailOffre[]> {
  const params = new URLSearchParams({
    range: `0-${(criteria.limit ?? DEFAULT_LIMIT) - 1}`,
  });

  if (criteria.keywords?.length)
    params.set("motsCles", criteria.keywords.join(" "));
  if (criteria.location) params.set("commune", criteria.location);
  if (criteria.contractType && CONTRACT_TYPE_MAP[criteria.contractType])
    params.set("typeContrat", CONTRACT_TYPE_MAP[criteria.contractType]);

  const response = await fetch(`${API_BASE_URL}/offres/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok)
    throw new Error(`France Travail API responded with ${response.status}`);

  const data: unknown = await response.json();
  if (!isFranceTravailSearchResponse(data))
    throw new Error("Unexpected France Travail response shape");

  return data.resultats ?? [];
}

export class FranceTravailProvider implements JobBoardProvider {
  readonly name = "FranceTravail";

  async searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>> {
    const start = Date.now();

    try {
      const token = await fetchAccessToken();
      const offres = await fetchOffres({ criteria, token });
      const postings = offres
        .map((offre) => toJobPosting({ offre }))
        .filter((posting): posting is JobPosting => posting !== null);

      logger.info(
        {
          provider: "france_travail",
          method: "searchJobs",
          durationMs: Date.now() - start,
          status: "success",
          count: postings.length,
        },
        "API call completed",
      );

      return { success: true, data: postings };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "france_travail",
          method: "searchJobs",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
