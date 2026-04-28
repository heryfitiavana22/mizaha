import { db } from "@/lib/db";
import {
  companies,
  contacts,
  dataSources,
  pipelineRuns,
  searchCompanies,
  searches,
} from "@/lib/db/schema";

export async function resetTestDb(): Promise<void> {
  await db.delete(dataSources);
  await db.delete(contacts);
  await db.delete(searchCompanies);
  await db.delete(pipelineRuns);
  await db.delete(searches);
  await db.delete(companies);
}
