import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies as companiesTable,
  contacts as contactsTable,
  dataSources as dataSourcesTable,
  pipelineRuns as pipelineRunsTable,
  searchCompanies as searchCompaniesTable,
  searches as searchesTable,
} from "@/lib/db/schema";
import logger from "@/lib/logger";
import type { UseCaseProviders } from "@/lib/use-cases";
import { getUseCase } from "@/lib/use-cases";
import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { Result } from "@/types";
import type {
  CompanyData,
  Contact,
  EnrichedCompany,
  QualifiedCompany,
  SearchCriteria,
} from "@/types";
import { discover } from "./steps/discover";
import { enrich } from "./steps/enrich";
import { extractCriteria } from "./steps/extract-criteria";
import { qualify } from "./steps/qualify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PipelineStep = "extract-criteria" | "discover" | "qualify" | "enrich";
type SearchStatus = "pending" | "running" | "completed" | "failed";
type StepRunRecord = { runId: string; start: number };

type RunPipelineOptions = {
  searchId: string;
  useCaseName: string;
};

const PIPELINE_PROVIDER_NAME = "pipeline";

// ---------------------------------------------------------------------------
// DB helpers — all return Result<T>, never throw
// ---------------------------------------------------------------------------
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function updateSearchStatus({
  searchId,
  status,
}: {
  searchId: string;
  status: SearchStatus;
}): Promise<Result<undefined>> {
  try {
    await db
      .update(searchesTable)
      .set({ status })
      .where(eq(searchesTable.id, searchId));
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function fetchSearch({
  searchId,
}: {
  searchId: string;
}): Promise<Result<{ rawQuery: string; uiCriteria: Record<string, unknown> }>> {
  try {
    const [search] = await db
      .select({
        rawQuery: searchesTable.rawQuery,
        uiCriteria: searchesTable.criteria,
      })
      .from(searchesTable)
      .where(eq(searchesTable.id, searchId));
    if (!search)
      return {
        success: false,
        error: new Error(`Search ${searchId} not found`),
      };
    return {
      success: true,
      data: {
        rawQuery: search.rawQuery,
        uiCriteria: (search.uiCriteria ?? {}) as Record<string, unknown>,
      },
    };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function startStepRun({
  searchId,
  step,
  inputData,
}: {
  searchId: string;
  step: PipelineStep;
  inputData?: Record<string, unknown>;
}): Promise<Result<StepRunRecord>> {
  try {
    const start = Date.now();
    const [run] = await db
      .insert(pipelineRunsTable)
      .values({
        searchId,
        step,
        status: "running",
        inputData: inputData ?? null,
      })
      .returning({ id: pipelineRunsTable.id });
    return { success: true, data: { runId: run.id, start } };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function completeStepRun({
  runId,
  start,
  outputData,
}: {
  runId: string;
  start: number;
  outputData?: Record<string, unknown>;
}): Promise<Result<undefined>> {
  try {
    await db
      .update(pipelineRunsTable)
      .set({
        status: "completed",
        durationMs: Date.now() - start,
        outputData: outputData ?? null,
      })
      .where(eq(pipelineRunsTable.id, runId));
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function failStepRun({
  runId,
  start,
  error,
}: {
  runId: string;
  start: number;
  error: string;
}): Promise<Result<undefined>> {
  try {
    await db
      .update(pipelineRunsTable)
      .set({ status: "failed", durationMs: Date.now() - start, error })
      .where(eq(pipelineRunsTable.id, runId));
    return { success: true, data: undefined };
  } catch (updateError) {
    return { success: false, error: toError(updateError) };
  }
}

async function upsertCompany({
  company,
}: {
  company: CompanyData;
}): Promise<Result<string>> {
  try {
    const [row] = await db
      .insert(companiesTable)
      .values({
        name: company.name,
        domain: company.domain,
        sector: company.sector,
        location: company.location,
        employeeCount: company.employeeCount,
        lastScrapedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: companiesTable.domain,
        set: { name: company.name, lastScrapedAt: new Date() },
      })
      .returning({ id: companiesTable.id });
    return { success: true, data: row.id };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function saveContacts({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}): Promise<Result<undefined>> {
  try {
    for (const contact of contacts) {
      if (!contact.name) continue; // name is notNull in DB schema
      await db.insert(contactsTable).values({
        companyId,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        linkedinUrl: contact.linkedinUrl,
      });
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function saveOneCompany({
  searchId,
  company,
}: {
  searchId: string;
  company: EnrichedCompany;
}): Promise<Result<undefined>> {
  try {
    const companyResult = await upsertCompany({ company });
    if (!companyResult.success) return companyResult;
    const companyId = companyResult.data;

    await db.insert(searchCompaniesTable).values({
      searchId,
      companyId,
      relevanceScore: company.qualification.score,
      relevanceReason: company.qualification.reason,
    });

    const contactsResult = await saveContacts({
      companyId,
      contacts: company.contacts,
    });
    if (!contactsResult.success) {
      logger.error(
        { companyId, error: contactsResult.error.message },
        "Failed to save contacts",
      );
    }

    await db.insert(dataSourcesTable).values({
      companyId,
      providerName: PIPELINE_PROVIDER_NAME,
      rawData: company as unknown as Record<string, unknown>,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function saveResults({
  searchId,
  companies,
}: {
  searchId: string;
  companies: EnrichedCompany[];
}): Promise<Result<undefined>> {
  for (const company of companies) {
    const result = await saveOneCompany({ searchId, company });
    if (!result.success) {
      logger.error(
        { domain: company.domain, error: result.error.message },
        "Failed to save company — skipping",
      );
    }
  }
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Level 1 — primary provider fails → try backup automatically
// ---------------------------------------------------------------------------
async function withFallback<TProvider, TData>({
  primary,
  backup,
  run,
  onFallback,
}: {
  primary: TProvider;
  backup: TProvider | undefined;
  run: (provider: TProvider) => Promise<Result<TData>>;
  onFallback?: () => void;
}): Promise<Result<TData>> {
  const primaryResult = await run(primary);
  if (primaryResult.success || !backup) return primaryResult;
  logger.warn("Primary provider failed — trying backup");
  onFallback?.();
  return run(backup);
}

// ---------------------------------------------------------------------------
// trackStep — handles pipeline_runs tracking for any step
// ---------------------------------------------------------------------------
async function trackStep<TData>({
  searchId,
  step,
  inputData,
  run,
  serializeOutput,
}: {
  searchId: string;
  step: PipelineStep;
  inputData?: Record<string, unknown>;
  run: () => Promise<Result<TData>>;
  serializeOutput?: (data: TData) => Record<string, unknown>;
}): Promise<Result<TData>> {
  const startResult = await startStepRun({ searchId, step, inputData });
  if (!startResult.success) {
    logger.error(
      { searchId, step, error: startResult.error.message },
      "Failed to start step tracking",
    );
  }

  const result = await run();

  if (startResult.success) {
    const { runId, start } = startResult.data;
    if (result.success) {
      const outputData = serializeOutput
        ? serializeOutput(result.data)
        : undefined;
      await completeStepRun({ runId, start, outputData });
    } else {
      await failStepRun({ runId, start, error: result.error.message });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step runners — each returns Result<T>
// ---------------------------------------------------------------------------
async function runExtractCriteria({
  searchId,
  rawQuery,
  useCaseName,
  llm,
  uiCriteria,
}: {
  searchId: string;
  rawQuery: string;
  useCaseName: string;
  llm: UseCaseProviders["llm"];
  uiCriteria?: Record<string, unknown>;
}): Promise<Result<SearchCriteria>> {
  return trackStep({
    searchId,
    step: "extract-criteria",
    inputData: {
      rawQuery,
      useCase: useCaseName,
      uiCriteria: uiCriteria ?? {},
      providers: { llm: llm.name },
    },
    run: () =>
      extractCriteria({ rawQuery, useCase: useCaseName, llm, uiCriteria }),
    serializeOutput: (criteria) =>
      criteria as unknown as Record<string, unknown>,
  });
}

// Wraps primary + backup into one CompanyProvider so discover() gets
// per-call fallback without knowing about the two-provider config.
function createFallbackCompanyProvider({
  primary,
  backup,
}: {
  primary: CompanyProvider;
  backup: CompanyProvider | undefined;
}): CompanyProvider {
  if (!backup) return primary;
  return {
    name: `${primary.name} + ${backup.name}`,
    findByDomain: async (domain) => {
      const result = await primary.findByDomain(domain);
      if (result.success) return result;
      logger.warn(
        { domain, error: result.error.message },
        "Primary company provider failed — trying backup",
      );
      return backup.findByDomain(domain);
    },
    search: async (criteria) => {
      const result = await primary.search(criteria);
      if (result.success) return result;
      logger.warn(
        { error: result.error.message },
        "Primary company provider failed — trying backup",
      );
      return backup.search(criteria);
    },
  };
}

async function runDiscover({
  searchId,
  criteria,
  providers,
}: {
  searchId: string;
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<Result<CompanyData[]>> {
  const company = createFallbackCompanyProvider({
    primary: providers.company.primary,
    backup: providers.company.backup,
  });
  let usedSearchFallback = false;
  return trackStep({
    searchId,
    step: "discover",
    inputData: {
      ...(criteria as unknown as Record<string, unknown>),
      providers: {
        search: providers.search.primary.name,
        searchBackup: providers.search.backup?.name ?? null,
        company: providers.company.primary.name,
        companyBackup: providers.company.backup?.name ?? null,
      },
    },
    run: () =>
      withFallback({
        primary: providers.search.primary,
        backup: providers.search.backup,
        run: (search) => discover({ criteria, search, company }),
        onFallback: () => {
          usedSearchFallback = true;
        },
      }),
    serializeOutput: (companies) => ({
      count: companies.length,
      usedSearchFallback,
      companies: companies.map((c) => ({
        name: c.name,
        domain: c.domain,
        sector: c.sector,
        location: c.location,
        employeeCount: c.employeeCount ?? null,
      })),
    }),
  });
}

async function runQualify({
  searchId,
  companies,
  criteria,
  providers,
}: {
  searchId: string;
  companies: CompanyData[];
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<Result<QualifiedCompany[]>> {
  return trackStep({
    searchId,
    step: "qualify",
    inputData: {
      count: companies.length,
      companies: companies.map((c) => ({ name: c.name, domain: c.domain })),
      providers: {
        scraper: providers.scraper.primary.name,
        scraperBackup: providers.scraper.backup?.name ?? null,
        llm: providers.llm.name,
      },
    },
    run: () =>
      qualify({
        companies,
        criteria,
        scraper: providers.scraper.primary,
        llm: providers.llm,
      }),
    serializeOutput: (qualified) => ({
      count: qualified.length,
      companies: qualified.map((c) => ({
        name: c.name,
        domain: c.domain,
        score: c.qualification.score,
        reason: c.qualification.reason,
        matchedSignals: c.qualification.matchedSignals,
      })),
    }),
  });
}

async function runEnrich({
  searchId,
  companies,
  providers,
}: {
  searchId: string;
  companies: QualifiedCompany[];
  providers: UseCaseProviders;
}): Promise<Result<EnrichedCompany[]>> {
  return trackStep({
    searchId,
    step: "enrich",
    inputData: {
      count: companies.length,
      companies: companies.map((c) => ({
        name: c.name,
        domain: c.domain,
        score: c.qualification.score,
      })),
      providers: { email: providers.email.primary.name },
    },
    run: () => enrich({ companies, email: providers.email.primary }),
    serializeOutput: (enriched) => ({
      count: enriched.length,
      companies: enriched.map((c) => ({
        name: c.name,
        domain: c.domain,
        contactCount: c.contacts.length,
        contacts: c.contacts.map((ct) => ({
          email: ct.email,
          name: ct.name ?? null,
          title: ct.title ?? null,
        })),
      })),
    }),
  });
}

// ---------------------------------------------------------------------------
// Pipeline execution
// ---------------------------------------------------------------------------
async function persistCriteria({
  searchId,
  criteria,
}: {
  searchId: string;
  criteria: SearchCriteria;
}): Promise<Result<undefined>> {
  try {
    await db
      .update(searchesTable)
      .set({ criteria: criteria as unknown as Record<string, unknown> })
      .where(eq(searchesTable.id, searchId));
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function runSteps({
  searchId,
  criteria,
  providers,
}: {
  searchId: string;
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<EnrichedCompany[]> {
  // Level 2 — never crash, continue with empty on failure
  const discoverResult = await runDiscover({ searchId, criteria, providers });
  if (!discoverResult.success)
    logger.warn(
      { searchId },
      "Discover failed — continuing with empty results",
    );
  const discoveredCompanies = discoverResult.success ? discoverResult.data : [];

  const qualifyResult = await runQualify({
    searchId,
    companies: discoveredCompanies,
    criteria,
    providers,
  });
  if (!qualifyResult.success)
    logger.warn({ searchId }, "Qualify failed — continuing with empty results");
  const qualifiedCompanies = qualifyResult.success ? qualifyResult.data : [];

  const enrichResult = await runEnrich({
    searchId,
    companies: qualifiedCompanies,
    providers,
  });
  if (!enrichResult.success)
    logger.warn({ searchId }, "Enrich failed — continuing with empty results");
  return enrichResult.success ? enrichResult.data : [];
}

async function executePipeline({
  searchId,
  useCaseName,
  rawQuery,
  providers,
  uiCriteria,
}: {
  searchId: string;
  useCaseName: string;
  rawQuery: string;
  providers: UseCaseProviders;
  uiCriteria?: Record<string, unknown>;
}): Promise<void> {
  // Step 1 — blocking: no criteria = no pipeline
  const criteriaResult = await runExtractCriteria({
    searchId,
    rawQuery,
    useCaseName,
    llm: providers.llm,
    uiCriteria,
  });
  if (!criteriaResult.success) {
    logger.error(
      { searchId, error: criteriaResult.error.message },
      "extract-criteria failed",
    );
    await updateSearchStatus({ searchId, status: "failed" });
    return;
  }

  const persistResult = await persistCriteria({
    searchId,
    criteria: criteriaResult.data,
  });
  if (!persistResult.success) {
    logger.error(
      { searchId, error: persistResult.error.message },
      "Failed to persist criteria",
    );
  }

  const enrichedCompanies = await runSteps({
    searchId,
    criteria: criteriaResult.data,
    providers,
  });

  const saveResult = await saveResults({
    searchId,
    companies: enrichedCompanies,
  });
  if (!saveResult.success) {
    logger.error(
      { searchId, error: saveResult.error.message },
      "Failed to save results",
    );
  }

  await updateSearchStatus({ searchId, status: "completed" });
  logger.info(
    { searchId, resultCount: enrichedCompanies.length },
    "Pipeline completed",
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function runPipeline({
  searchId,
  useCaseName,
}: RunPipelineOptions): Promise<void> {
  const config = getUseCase({ name: useCaseName });

  await updateSearchStatus({ searchId, status: "running" });

  const searchResult = await fetchSearch({ searchId });
  if (!searchResult.success) {
    logger.error(
      { searchId, error: searchResult.error.message },
      "Failed to fetch search",
    );
    await updateSearchStatus({ searchId, status: "failed" });
    return;
  }

  try {
    await executePipeline({
      searchId,
      useCaseName,
      rawQuery: searchResult.data.rawQuery,
      providers: config.providers,
      uiCriteria: searchResult.data.uiCriteria,
    });
  } catch (caughtError) {
    const pipelineError = toError(caughtError);
    logger.error(
      { searchId, error: pipelineError.message },
      "Pipeline crashed unexpectedly",
    );
    await updateSearchStatus({ searchId, status: "failed" });
  }
}
