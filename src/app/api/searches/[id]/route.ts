import { db } from "@/lib/db";
import {
  contacts as contactsTable,
  entities as entitiesTable,
  pipelineRuns as pipelineRunsTable,
  searchResults as searchResultsTable,
  searches as searchesTable,
} from "@/lib/db/schema";
import logger from "@/lib/logger";
import type { Result } from "@/types";
import { asc, desc, eq, inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function fetchSearch({
  searchId,
}: {
  searchId: string;
}): Promise<Result<typeof searchesTable.$inferSelect | null>> {
  try {
    const [search] = await db
      .select()
      .from(searchesTable)
      .where(eq(searchesTable.id, searchId));
    return { success: true, data: search ?? null };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function fetchSearchResults({ searchId }: { searchId: string }): Promise<
  Result<
    {
      entityId: string;
      score: number;
      reason: string;
      status: string | null;
      type: string;
      data: unknown;
    }[]
  >
> {
  try {
    const rows = await db
      .select({
        entityId: searchResultsTable.entityId,
        score: searchResultsTable.score,
        reason: searchResultsTable.reason,
        status: searchResultsTable.status,
        type: entitiesTable.type,
        data: entitiesTable.data,
      })
      .from(searchResultsTable)
      .innerJoin(
        entitiesTable,
        eq(searchResultsTable.entityId, entitiesTable.id),
      )
      .where(eq(searchResultsTable.searchId, searchId))
      .orderBy(desc(searchResultsTable.score));
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function fetchPipelineRuns({
  searchId,
}: {
  searchId: string;
}): Promise<Result<(typeof pipelineRunsTable.$inferSelect)[]>> {
  try {
    const rows = await db
      .select()
      .from(pipelineRunsTable)
      .where(eq(pipelineRunsTable.searchId, searchId))
      .orderBy(asc(pipelineRunsTable.createdAt));
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

async function fetchContacts({
  entityIds,
}: {
  entityIds: string[];
}): Promise<Result<(typeof contactsTable.$inferSelect)[]>> {
  if (entityIds.length === 0) return { success: true, data: [] };
  try {
    const rows = await db
      .select()
      .from(contactsTable)
      .where(inArray(contactsTable.entityId, entityIds));
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function GET(
  _req: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;

  const searchResult = await fetchSearch({ searchId: id });
  if (!searchResult.success) {
    logger.error(
      { searchId: id, error: searchResult.error.message },
      "Failed to fetch search",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
  if (!searchResult.data) {
    return Response.json({ error: "Search not found" }, { status: 404 });
  }

  const searchResultsResult = await fetchSearchResults({ searchId: id });
  if (!searchResultsResult.success) {
    logger.error(
      { searchId: id, error: searchResultsResult.error.message },
      "Failed to fetch search results",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  const entityIds = searchResultsResult.data.map((row) => row.entityId);
  const contactsResult = await fetchContacts({ entityIds });
  if (!contactsResult.success) {
    logger.error(
      { searchId: id, error: contactsResult.error.message },
      "Failed to fetch contacts",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  const pipelineRunsResult = await fetchPipelineRuns({ searchId: id });
  if (!pipelineRunsResult.success) {
    logger.error(
      { searchId: id, error: pipelineRunsResult.error.message },
      "Failed to fetch pipeline runs",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  const results = searchResultsResult.data.map((row) => {
    const entityData = (row.data ?? {}) as Record<string, unknown>;

    if (row.type === "job_offer") {
      return {
        type: "job_offer" as const,
        entityId: row.entityId,
        title: (entityData.title as string) ?? "",
        companyName: (entityData.companyName as string) ?? "",
        url: (entityData.url as string) ?? "",
        contractType: (entityData.contractType as string) ?? "",
        location: (entityData.location as string) ?? "",
        techStack: Array.isArray(entityData.techStack)
          ? (entityData.techStack as string[])
          : [],
        description: (entityData.description as string) ?? "",
        postedAt: (entityData.postedAt as string) ?? null,
        relevanceScore: row.score,
        relevanceReason: row.reason,
      };
    }

    const rawContacts = contactsResult.data.filter(
      (c) => c.entityId === row.entityId,
    );
    return {
      type: "company" as const,
      companyId: row.entityId,
      name: (entityData.name as string) ?? "",
      domain: (entityData.domain as string) ?? "",
      sector: (entityData.sector as string) || null,
      location: (entityData.location as string) || null,
      employeeCount: (entityData.employeeCount as number) ?? null,
      techStack: Array.isArray(entityData.techStack)
        ? entityData.techStack
        : [],
      relevanceScore: row.score,
      relevanceReason: row.reason,
      contacts: rawContacts.map((c) => ({
        id: c.id,
        name: c.name ?? "",
        title: c.title ?? null,
        email: c.email ?? null,
        linkedinUrl: c.linkedinUrl ?? null,
      })),
    };
  });

  return Response.json({
    search: searchResult.data,
    results,
    pipelineRuns: pipelineRunsResult.data,
  });
}
