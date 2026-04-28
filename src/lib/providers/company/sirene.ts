import logger from "@/lib/logger";
import type {
  CompanyCriteria,
  CompanyProvider,
} from "@/lib/providers/interfaces/company";
import type { CompanyData, Result } from "@/types";

// Open data — no auth required, 7 req/s rate limit
const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";
const DEFAULT_RESULTS_LIMIT = 10;

type SireneEtablissement = {
  nom_complet?: string;
  siren?: string;
  activite_principale?: string;
  siege?: {
    commune?: string;
    code_postal?: string;
  };
};

type SireneSearchResponse = {
  results?: SireneEtablissement[];
};

function isSireneSearchResponse(data: unknown): data is SireneSearchResponse {
  return typeof data === "object" && data !== null;
}

function toCompanyData(e: SireneEtablissement): CompanyData | null {
  if (!e.nom_complet || !e.siren) return null;
  return {
    name: e.nom_complet,
    domain: e.siren, // no direct domain from SIRENE — using SIREN as identifier
    sector: e.activite_principale ?? "",
    location: [e.siege?.code_postal, e.siege?.commune]
      .filter(Boolean)
      .join(" "),
  };
}

async function fetchSirene({
  query,
}: {
  query: string;
}): Promise<SireneSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    per_page: String(DEFAULT_RESULTS_LIMIT),
  });
  const response = await fetch(`${BASE_URL}?${params}`);
  if (!response.ok)
    throw new Error(`SIRENE API responded with ${response.status}`);
  const data: unknown = await response.json();
  if (!isSireneSearchResponse(data))
    throw new Error("Unexpected SIRENE response shape");
  return data;
}

export class SireneCompanyProvider implements CompanyProvider {
  async findByDomain(domain: string): Promise<Result<CompanyData | null>> {
    const start = Date.now();
    // SIRENE has no domain-based lookup — derive name from domain as best-effort
    const name = domain.replace(/\.[^.]+$/, "").replace(/-/g, " ");

    try {
      const data = await fetchSirene({ query: name });
      const first =
        (data.results ?? []).map(toCompanyData).find(Boolean) ?? null;

      logger.info(
        {
          provider: "sirene",
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
          provider: "sirene",
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

  async search(criteria: CompanyCriteria): Promise<Result<CompanyData[]>> {
    const start = Date.now();
    const query = [criteria.sector, criteria.location]
      .filter(Boolean)
      .join(" ");

    try {
      const data = await fetchSirene({ query });
      const results = (data.results ?? [])
        .map(toCompanyData)
        .filter((c): c is CompanyData => c !== null);

      logger.info(
        {
          provider: "sirene",
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
          provider: "sirene",
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
