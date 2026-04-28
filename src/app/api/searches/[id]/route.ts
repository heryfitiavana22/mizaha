import { db } from "@/lib/db";
import {
  companies as companiesTable,
  contacts as contactsTable,
  pipelineRuns as pipelineRunsTable,
  searchCompanies as searchCompaniesTable,
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

async function fetchCompanyRows({ searchId }: { searchId: string }): Promise<
  Result<
    {
      relevanceScore: number;
      relevanceReason: string;
      companyId: string;
      name: string;
      domain: string;
      sector: string | null;
      location: string | null;
      employeeCount: number | null;
      techStack: unknown;
    }[]
  >
> {
  try {
    const rows = await db
      .select({
        relevanceScore: searchCompaniesTable.relevanceScore,
        relevanceReason: searchCompaniesTable.relevanceReason,
        companyId: companiesTable.id,
        name: companiesTable.name,
        domain: companiesTable.domain,
        sector: companiesTable.sector,
        location: companiesTable.location,
        employeeCount: companiesTable.employeeCount,
        techStack: companiesTable.techStack,
      })
      .from(searchCompaniesTable)
      .innerJoin(
        companiesTable,
        eq(searchCompaniesTable.companyId, companiesTable.id),
      )
      .where(eq(searchCompaniesTable.searchId, searchId))
      .orderBy(desc(searchCompaniesTable.relevanceScore));
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
  companyIds,
}: {
  companyIds: string[];
}): Promise<Result<(typeof contactsTable.$inferSelect)[]>> {
  if (companyIds.length === 0) return { success: true, data: [] };
  try {
    const rows = await db
      .select()
      .from(contactsTable)
      .where(inArray(contactsTable.companyId, companyIds));
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

  const companyRowsResult = await fetchCompanyRows({ searchId: id });
  if (!companyRowsResult.success) {
    logger.error(
      { searchId: id, error: companyRowsResult.error.message },
      "Failed to fetch companies",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  const companyIds = companyRowsResult.data.map((row) => row.companyId);
  const contactsResult = await fetchContacts({ companyIds });
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

  const results = companyRowsResult.data.map((row) => ({
    ...row,
    contacts: contactsResult.data.filter(
      (contact) => contact.companyId === row.companyId,
    ),
  }));

  return Response.json({
    search: searchResult.data,
    results,
    pipelineRuns: pipelineRunsResult.data,
  });
}
