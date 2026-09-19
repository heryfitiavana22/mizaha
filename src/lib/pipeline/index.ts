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
import { discoverCompanies, discoverJobOffers } from "./steps/discover";
import { enrichCompanies, enrichJobOffers } from "./steps/enrich";
import {
  companyQualifyStrategy,
  jobOfferQualifyStrategy,
  qualify,
} from "./steps/qualify";

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

async function runCompanyPipeline({
  searchId,
  criteria,
  providers,
}: {
  searchId: string;
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<EnrichedCompany[]> {
  // Level 2 — never crash, continue with empty on step failure

  const discoverResult = await trackStep({
    searchId,
    step: "discover",
    inputData: {
      signalSources: criteria.signalSources,
      targetEntity: "company",
    },
    run: () =>
      discoverCompanies({
        criteria,
        search: providers.search,
        company: providers.company,
        llm: providers.llm,
        jobBoardProviders: providers.jobBoard,
        companySignals: providers.companySignals,
      }),
  });
  if (!discoverResult.success)
    logger.warn(
      { searchId },
      "Discover failed — continuing with empty results",
    );
  const discovered: CompanyData[] = discoverResult.success
    ? discoverResult.data
    : [];

  const qualifyResult = await trackStep({
    searchId,
    step: "qualify",
    inputData: { entityCount: discovered.length, targetEntity: "company" },
    run: () =>
      qualify({
        entities: discovered,
        criteria,
        scraper: providers.scraper,
        llm: providers.llm,
        strategy: companyQualifyStrategy,
      }),
  });
  if (!qualifyResult.success)
    logger.warn({ searchId }, "Qualify failed — continuing with empty results");
  const qualified: QualifiedCompany[] = qualifyResult.success
    ? qualifyResult.data
    : [];

  const enrichResult = await trackStep({
    searchId,
    step: "enrich",
    inputData: { entityCount: qualified.length, targetEntity: "company" },
    run: () => enrichCompanies({ entities: qualified, email: providers.email }),
  });
  if (!enrichResult.success)
    logger.warn({ searchId }, "Enrich failed — continuing with empty results");
  return enrichResult.success ? enrichResult.data : [];
}

async function runJobOfferPipeline({
  searchId,
  criteria,
  providers,
}: {
  searchId: string;
  criteria: SearchCriteria;
  providers: UseCaseProviders;
}): Promise<EnrichedJobOffer[]> {
  if (!providers.jobBoard?.length) {
    logger.warn(
      { searchId },
      "No job board providers configured — returning empty",
    );
    return [];
  }

  const discoverResult = await trackStep({
    searchId,
    step: "discover",
    inputData: {
      signalSources: criteria.signalSources,
      targetEntity: "job_offer",
    },
    run: () =>
      discoverJobOffers({
        criteria,
        jobBoardProviders: providers.jobBoard!,
      }),
  });
  if (!discoverResult.success)
    logger.warn(
      { searchId },
      "Discover failed — continuing with empty results",
    );
  const discovered: JobPosting[] = discoverResult.success
    ? discoverResult.data
    : [];

  const qualifyResult = await trackStep({
    searchId,
    step: "qualify",
    inputData: { entityCount: discovered.length, targetEntity: "job_offer" },
    run: () =>
      qualify({
        entities: discovered,
        criteria,
        scraper: providers.scraper,
        llm: providers.llm,
        strategy: jobOfferQualifyStrategy,
      }),
  });
  if (!qualifyResult.success)
    logger.warn({ searchId }, "Qualify failed — continuing with empty results");
  const qualified: QualifiedJobOffer[] = qualifyResult.success
    ? qualifyResult.data
    : [];

  const enrichResult = await trackStep({
    searchId,
    step: "enrich",
    inputData: { entityCount: qualified.length, targetEntity: "job_offer" },
    run: () =>
      enrichJobOffers({ entities: qualified, company: providers.company }),
  });
  if (!enrichResult.success)
    logger.warn({ searchId }, "Enrich failed — continuing with empty results");
  return enrichResult.success ? enrichResult.data : [];
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

async function executePipeline({
  searchId,
  useCaseName,
  rawQuery,
  providers,
  uiCriteria,
  maxResults,
}: ExecutePipelineOptions): Promise<void> {
  // Step 1 — blocking: no criteria = no pipeline
  const criteriaResult = await trackStep({
    searchId,
    step: "extract-criteria",
    inputData: { rawQuery, uiCriteria },
    run: () =>
      providers.llm.extractCriteria({
        rawQuery,
        useCase: useCaseName,
        uiCriteria,
      }),
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

  const persistResult = await persistCriteria({ searchId, criteria });
  if (!persistResult.success)
    logger.error(
      { searchId, error: persistResult.error.message },
      "Failed to persist criteria",
    );

  const results =
    criteria.targetEntity === "job_offer"
      ? await runJobOfferPipeline({ searchId, criteria, providers })
      : await runCompanyPipeline({ searchId, criteria, providers });

  const saveResult = await saveResults({
    searchId,
    results,
    targetEntity: criteria.targetEntity,
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
