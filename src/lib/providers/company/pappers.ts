import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  CompanyCriteria,
  CompanyProvider,
} from "@/lib/providers/interfaces/company";
import type { CompanyData, Result } from "@/types";

const BASE_URL = "https://api.pappers.fr/v2";

type PappersEntreprise = {
  nom_entreprise?: string;
  siren?: string;
  libelle_code_naf?: string;
  siege?: {
    ville?: string;
    code_postal?: string;
  };
  date_creation?: string;
  effectif?: string;
};

type PappersSearchResponse = {
  resultats?: PappersEntreprise[];
};

function isPappersSearchResponse(data: unknown): data is PappersSearchResponse {
  return typeof data === "object" && data !== null;
}

function toCompanyData(e: PappersEntreprise): CompanyData | null {
  if (!e.nom_entreprise || !e.siren) return null;
  return {
    name: e.nom_entreprise,
    domain: e.siren, // no direct domain from Pappers — using SIREN as identifier
    sector: e.libelle_code_naf ?? "",
    location: [e.siege?.code_postal, e.siege?.ville].filter(Boolean).join(" "),
    foundedAt: e.date_creation,
  };
}

async function fetchEntreprises({
  query,
  apiToken,
}: {
  query: string;
  apiToken: string;
}): Promise<PappersSearchResponse> {
  const params = new URLSearchParams({ q: query, api_token: apiToken });
  const response = await fetch(`${BASE_URL}/entreprises?${params}`);
  if (!response.ok)
    throw new Error(`Pappers API responded with ${response.status}`);
  const data: unknown = await response.json();
  if (!isPappersSearchResponse(data))
    throw new Error("Unexpected Pappers response shape");
  return data;
}

export class PappersCompanyProvider implements CompanyProvider {
  readonly name = "Pappers";

  async findByDomain(domain: string): Promise<Result<CompanyData | null>> {
    const start = Date.now();
    // Pappers has no domain-based lookup — derive company name from domain as best-effort
    const name = domain.replace(/\.[^.]+$/, "").replace(/-/g, " ");

    try {
      const data = await fetchEntreprises({
        query: name,
        apiToken: env.PAPPERS_API_KEY,
      });
      const first =
        (data.resultats ?? []).map(toCompanyData).find(Boolean) ?? null;

      logger.info(
        {
          provider: "pappers",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: first };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "pappers",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async findByName(name: string): Promise<Result<CompanyData | null>> {
    const start = Date.now();
    try {
      const data = await fetchEntreprises({
        query: name,
        apiToken: env.PAPPERS_API_KEY,
      });
      const first =
        (data.resultats ?? []).map(toCompanyData).find(Boolean) ?? null;

      logger.info(
        {
          provider: "pappers",
          method: "findByName",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: first };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "pappers",
          method: "findByName",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async search(criteria: CompanyCriteria): Promise<Result<CompanyData[]>> {
    const start = Date.now();
    const query = [criteria.sector, criteria.location]
      .filter(Boolean)
      .join(" ");

    try {
      const data = await fetchEntreprises({
        query,
        apiToken: env.PAPPERS_API_KEY,
      });
      const results = (data.resultats ?? [])
        .map(toCompanyData)
        .filter((c): c is CompanyData => c !== null);

      logger.info(
        {
          provider: "pappers",
          method: "search",
          durationMs: Date.now() - start,
          status: "success",
          count: results.length,
        },
        "API call completed",
      );

      return { success: true, data: results };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "pappers",
          method: "search",
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
