import { db } from "@/lib/db";
import { searches as searchesTable } from "@/lib/db/schema";
import logger from "@/lib/logger";
import { runPipeline } from "@/lib/pipeline";
import type { Result } from "@/types";
import { z } from "zod";

const pipelineBodySchema = z.object({
  rawQuery: z.string().min(1),
  useCaseName: z.string().min(1),
});

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function createSearch({
  rawQuery,
  useCaseName,
}: {
  rawQuery: string;
  useCaseName: string;
}): Promise<Result<string>> {
  try {
    const [search] = await db
      .insert(searchesTable)
      .values({ rawQuery, useCase: useCaseName, criteria: {} })
      .returning({ id: searchesTable.id });
    return { success: true, data: search.id };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json();
  const parsed = pipelineBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { rawQuery, useCaseName } = parsed.data;
  const searchResult = await createSearch({ rawQuery, useCaseName });
  if (!searchResult.success) {
    logger.error(
      { error: searchResult.error.message },
      "Failed to create search",
    );
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Fire and forget — pipeline runs async (1-5 minutes)
  runPipeline({ searchId: searchResult.data, useCaseName }).catch(
    (error: unknown) => {
      logger.error(
        { searchId: searchResult.data, error },
        "Pipeline crashed unexpectedly",
      );
    },
  );

  return Response.json({ searchId: searchResult.data }, { status: 202 });
}
