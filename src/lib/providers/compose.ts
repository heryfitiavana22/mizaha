import type { CompanyProvider } from "./interfaces/company";
import type { ScraperProvider } from "./interfaces/scraper";
import type { SearchProvider } from "./interfaces/search";
import logger from "@/lib/logger";

export function withSearchFallback(
  primary: SearchProvider,
  backup: SearchProvider,
): SearchProvider {
  return {
    name: `${primary.name} + ${backup.name}`,
    search: async (input) => {
      const result = await primary.search(input);
      if (result.success) return result;
      logger.warn(
        { error: result.error.message, backup: backup.name },
        "Search provider failed — trying backup",
      );
      return backup.search(input);
    },
  };
}

export function withCompanyFallback(
  primary: CompanyProvider,
  backup: CompanyProvider,
): CompanyProvider {
  return {
    name: `${primary.name} + ${backup.name}`,
    findByDomain: async (domain) => {
      const result = await primary.findByDomain(domain);
      if (result.success) return result;
      logger.warn(
        { domain, error: result.error.message, backup: backup.name },
        "Company provider failed — trying backup",
      );
      return backup.findByDomain(domain);
    },
    findByName: async (name) => {
      const result = await primary.findByName(name);
      if (result.success) return result;
      logger.warn(
        { name, error: result.error.message, backup: backup.name },
        "Company provider failed — trying backup",
      );
      return backup.findByName(name);
    },
    search: async (criteria) => {
      const result = await primary.search(criteria);
      if (result.success) return result;
      logger.warn(
        { error: result.error.message, backup: backup.name },
        "Company provider failed — trying backup",
      );
      return backup.search(criteria);
    },
  };
}

export function withScraperFallback(
  primary: ScraperProvider,
  backup: ScraperProvider,
): ScraperProvider {
  return {
    name: `${primary.name} + ${backup.name}`,
    scrape: async (url) => {
      const result = await primary.scrape(url);
      if (result.success) return result;
      logger.warn(
        { url, error: result.error.message, backup: backup.name },
        "Scraper provider failed — trying backup",
      );
      return backup.scrape(url);
    },
  };
}
