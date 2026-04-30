import { db } from "@/lib/db";
import {
  contacts,
  dataSources,
  entities,
  pipelineRuns,
  searchResults,
  searches,
} from "@/lib/db/schema";

export async function resetTestDb(): Promise<void> {
  await db.delete(dataSources);
  await db.delete(contacts);
  await db.delete(searchResults);
  await db.delete(pipelineRuns);
  await db.delete(searches);
  await db.delete(entities);
}
