import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts as contactsTable,
  dataSources as dataSourcesTable,
  entities as entitiesTable,
  pipelineRuns as pipelineRunsTable,
  searches as searchesTable,
  searchResults as searchResultsTable,
} from "@/lib/db/schema";
import logger from "@/lib/logger";
import type { UseCaseProviders } from "@/lib/use-cases";
import { getUseCase } from "@/lib/use-cases";
import type { JobBoardProvider } from "@/lib/providers/interfaces/job-board";
import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type {
  CompanyData,
  Contact,
  EnrichedCompany,
  EnrichedJobOffer,
  JobPosting,
  QualifiedCompany,
  QualifiedJobOffer,
  Result,
  SearchCriteria,
} from "@/types";
import { discover } from "./steps/discover";
import { enrich } from "./steps/enrich";
import { extractCriteria } from "./steps/extract-criteria";
import { qualify } from "./steps/qualify";

type PipelineStep = "extract-criteria" | "discover" | "qualify" | "enrich";
type SearchStatus = "pending" | "running" | "completed" | "failed";
type StepRunRecord = { runId: string; start: number };

type RunPipelineOptions = {
  searchId: string;
  useCaseName: string;
};

type ExecutePipelineOptions = {
  searchId: string;
  useCaseName: string;
  rawQuery: string;
  providers: UseCaseProviders;
  uiCriteria?: Record<string, unknown>;
  maxResults?: number;
};

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
  inputData?: unknown;
}): Promise<Result<StepRunRecord>> {
  try {
    const start = Date.now();
    const [run] = await db
      .insert(pipelineRunsTable)
      .values({
        searchId,
        step,
        status: "running",
        inputData: inputData as Record<string, unknown> | undefined,
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
  outputData?: unknown;
}): Promise<Result<undefined>> {
  try {
    await db
      .update(pipelineRunsTable)
      .set({
        status: "completed",
        durationMs: Date.now() - start,
        outputData: outputData as Record<string, unknown> | undefined,
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

async function upsertEntity({
  type,
  dedupKey,
  data,
}: {
  type: "company" | "job_offer";
  dedupKey: string;
  data: Record<string, unknown>;
}): Promise<Result<string>> {
  try {
    const [row] = await db
      .insert(entitiesTable)
      .values({ type, dedupKey, data })
      .onConflictDoUpdate({
        target: [entitiesTable.type, entitiesTable.dedupKey],
        set: { data, enrichedAt: new Date() },
      })
      .returning({ id: entitiesTable.id });
    return { success: true, data: row.id };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function saveSearchResult({
  searchId,
  entityId,
  score,
  reason,
}: {
  searchId: string;
  entityId: string;
  score: number;
  reason: string;
}): Promise<Result<undefined>> {
  try {
    await db
      .insert(searchResultsTable)
      .values({ searchId, entityId, score, reason });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function saveDataSource({
  entityId,
  providerName,
  rawData,
}: {
  entityId: string;
  providerName: string;
  rawData: Record<string, unknown>;
}): Promise<void> {
  try {
    await db
      .insert(dataSourcesTable)
      .values({ entityId, providerName, rawData });
  } catch (error) {
    logger.error(
      { entityId, providerName, error: toError(error).message },
      "Failed to save data source",
    );
  }
}

async function saveContacts({
  entityId,
  contacts,
}: {
  entityId: string;
  contacts: Contact[];
}): Promise<Result<undefined>> {
  try {
    const validContacts = contacts.filter((contact) => Boolean(contact.name));
    await Promise.allSettled(
      validContacts.map((contact) =>
        db.insert(contactsTable).values({
          entityId,
          name: contact.name!,
          title: contact.title,
          email: contact.email,
          linkedinUrl: contact.linkedinUrl,
        }),
      ),
    );
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
  const entityResult = await upsertEntity({
    type: "company",
    dedupKey: company.domain,
    data: company as unknown as Record<string, unknown>,
  });
  if (!entityResult.success) return entityResult;

  await saveSearchResult({
    searchId,
    entityId: entityResult.data,
    score: company.qualification.score,
    reason: company.qualification.reason,
  });

  if (company.source) {
    await saveDataSource({
      entityId: entityResult.data,
      providerName: company.source,
      rawData: company as unknown as Record<string, unknown>,
    });
  }

  const contactsResult = await saveContacts({
    entityId: entityResult.data,
    contacts: company.contacts,
  });
  if (!contactsResult.success) {
    logger.error(
      { entityId: entityResult.data, error: contactsResult.error.message },
      "Failed to save contacts",
    );
  }

  return { success: true, data: undefined };
}

async function saveOneJobOffer({
  searchId,
  offer,
}: {
  searchId: string;
  offer: EnrichedJobOffer;
}): Promise<Result<undefined>> {
  const entityResult = await upsertEntity({
    type: "job_offer",
    dedupKey: offer.url,
    data: offer as unknown as Record<string, unknown>,
  });
  if (!entityResult.success) return entityResult;

  await saveSearchResult({
    searchId,
    entityId: entityResult.data,
    score: offer.qualification.score,
    reason: offer.qualification.reason,
  });

  if (offer.source) {
    await saveDataSource({
      entityId: entityResult.data,
      providerName: offer.source,
      rawData: offer as unknown as Record<string, unknown>,
    });
  }

  return { success: true, data: undefined };
}

async function saveResults({
  searchId,
  results,
  targetEntity,
}: {
  searchId: string;
  results: EnrichedCompany[] | EnrichedJobOffer[];
  targetEntity: "company" | "job_offer";
}): Promise<Result<undefined>> {
  if (targetEntity === "job_offer") {
    for (const offer of results as EnrichedJobOffer[]) {
      const result = await saveOneJobOffer({ searchId, offer });
      if (!result.success)
        logger.error(
          { url: offer.url, error: result.error.message },
          "Failed to save job offer — skipping",
        );
    }
  } else {
    for (const company of results as EnrichedCompany[]) {
      const result = await saveOneCompany({ searchId, company });
      if (!result.success)
        logger.error(
          { domain: company.domain, error: result.error.message },
          "Failed to save company — skipping",
        );
    }
  }
  return { success: true, data: undefined };
}

// Level 1 — primary provider fails → try backup automatically
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

// Wraps primary + backup into one CompanyProvider so steps get per-call fallback transparently.
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
    findByName: async (name) => {
      const result = await primary.findByName(name);
      if (result.success) return result;
      logger.warn(
        { name, error: result.error.message },
        "Primary company provider failed — trying backup",
      );
      return backup.findByName(name);
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

async function trackStep<TData>({
  searchId,
  step,
  inputData,
  run,
}: {
  searchId: string;
  step: PipelineStep;
  inputData?: unknown;
  run: () => Promise<Result<TData>>;
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
      await completeStepRun({ runId, start, outputData: result.data });
    } else {
      await failStepRun({ runId, start, error: result.error.message });
    }
  }

  return result;
}

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
    inputData: { rawQuery, uiCriteria },
    run: () =>
      extractCriteria({ rawQuery, useCase: useCaseName, llm, uiCriteria }),
  });
}

async function runDiscover({
  searchId,
  criteria,
  providers,
}: {
  searchId: string;
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<Result<CompanyData[] | JobPosting[]>> {
  const company = createFallbackCompanyProvider({
    primary: providers.company.primary,
    backup: providers.company.backup,
  });
  const jobBoardProviders = [
    providers.jobBoard?.primary,
    providers.jobBoard?.backup,
  ].filter((provider): provider is JobBoardProvider => provider !== undefined);

  return trackStep({
    searchId,
    step: "discover",
    inputData: {
      signalSources: criteria.signalSources,
      targetEntity: criteria.targetEntity,
    },
    run: () =>
      withFallback({
        primary: providers.search.primary,
        backup: providers.search.backup,
        run: (search) =>
          discover({
            criteria,
            search,
            company,
            llm: providers.llm,
            jobBoardProviders,
          }),
      }),
  });
}

async function runQualify({
  searchId,
  entities,
  criteria,
  providers,
}: {
  searchId: string;
  entities: CompanyData[] | JobPosting[];
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<Result<QualifiedCompany[] | QualifiedJobOffer[]>> {
  return trackStep({
    searchId,
    step: "qualify",
    inputData: {
      entityCount: entities.length,
      targetEntity: criteria.targetEntity,
    },
    run: () =>
      qualify({
        entities,
        criteria,
        scraper: providers.scraper.primary,
        llm: providers.llm,
      }),
  });
}

async function runEnrich({
  searchId,
  entities,
  providers,
  targetEntity,
}: {
  searchId: string;
  entities: QualifiedCompany[] | QualifiedJobOffer[];
  providers: UseCaseProviders;
  targetEntity: "company" | "job_offer";
}): Promise<Result<EnrichedCompany[] | EnrichedJobOffer[]>> {
  const company = createFallbackCompanyProvider({
    primary: providers.company.primary,
    backup: providers.company.backup,
  });
  return trackStep({
    searchId,
    step: "enrich",
    inputData: { entityCount: entities.length, targetEntity },
    run: () =>
      enrich({
        entities,
        targetEntity,
        company,
        email: providers.email.primary,
      }),
  });
}

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
}): Promise<EnrichedCompany[] | EnrichedJobOffer[]> {
  // Level 2 — never crash, continue with empty on failure
  const discoverResult = await runDiscover({ searchId, criteria, providers });
  if (!discoverResult.success)
    logger.warn(
      { searchId },
      "Discover failed — continuing with empty results",
    );
  const discovered = discoverResult.success ? discoverResult.data : [];

  const qualifyResult = await runQualify({
    searchId,
    entities: discovered,
    criteria,
    providers,
  });
  if (!qualifyResult.success)
    logger.warn({ searchId }, "Qualify failed — continuing with empty results");
  const qualified = qualifyResult.success ? qualifyResult.data : [];

  const enrichResult = await runEnrich({
    searchId,
    entities: qualified,
    providers,
    targetEntity: criteria.targetEntity,
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
  maxResults,
}: ExecutePipelineOptions): Promise<void> {
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

  const criteria: SearchCriteria = maxResults
    ? { ...criteriaResult.data, maxResults }
    : criteriaResult.data;

  const persistResult = await persistCriteria({
    searchId,
    criteria,
  });
  if (!persistResult.success)
    logger.error(
      { searchId, error: persistResult.error.message },
      "Failed to persist criteria",
    );

  const results = await runSteps({
    searchId,
    criteria,
    providers,
  });

  const saveResult = await saveResults({
    searchId,
    results,
    targetEntity: criteriaResult.data.targetEntity,
  });
  if (!saveResult.success)
    logger.error(
      { searchId, error: saveResult.error.message },
      "Failed to save results",
    );

  await updateSearchStatus({ searchId, status: "completed" });
  logger.info({ searchId, resultCount: results.length }, "Pipeline completed");
}

export async function runPipeline({
  searchId,
  useCaseName,
}: RunPipelineOptions): Promise<void> {
  const configResult = getUseCase({ name: useCaseName });
  if (!configResult.success) {
    logger.error(
      { searchId, useCaseName, error: configResult.error.message },
      "Unknown use case — pipeline aborted",
    );
    await updateSearchStatus({ searchId, status: "failed" });
    return;
  }
  const config = configResult.data;

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
      maxResults: config.maxResults,
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
