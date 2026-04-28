import { db } from "@/lib/db";
import { searches as searchesTable } from "@/lib/db/schema";
import logger from "@/lib/logger";
import type { Result } from "@/types";
import { desc } from "drizzle-orm";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function listSearches(): Promise<
  Result<
    {
      id: string;
      rawQuery: string;
      useCase: string | null;
      status: string | null;
      createdAt: Date | null;
    }[]
  >
> {
  try {
    const rows = await db
      .select({
        id: searchesTable.id,
        rawQuery: searchesTable.rawQuery,
        useCase: searchesTable.useCase,
        status: searchesTable.status,
        createdAt: searchesTable.createdAt,
      })
      .from(searchesTable)
      .orderBy(desc(searchesTable.createdAt));
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function GET(): Promise<Response> {
  const result = await listSearches();
  if (!result.success) {
    logger.error({ error: result.error.message }, "Failed to list searches");
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
  return Response.json(result.data);
}
