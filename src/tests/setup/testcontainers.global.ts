import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

function shouldStartContainer(): boolean {
  const argv = process.argv.join(" ");
  // pnpm test => vitest run --exclude '**/*.int.test.ts' => unit only, skip
  const isUnitOnly = argv.includes("--exclude") && argv.includes("int.test");
  return !isUnitOnly;
}

export async function setup({
  provide,
}: {
  provide: (key: string, value: string) => void;
}): Promise<void> {
  if (!shouldStartContainer()) {
    // No container for unit-only runs (pnpm test)
    return;
  }

  container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("mizaha_test")
    .withUsername("postgres")
    .withPassword("password")
    .start();

  const connectionUri = container.getConnectionUri();
  provide("testDatabaseUrl", connectionUri);

  // Also write to file for fallback if provide/inject not wired (transports edge)
  // Vitest setupFiles runs in same worker but globalSetup provide may not be injectable
  // in older vitest; file is a fallback.
  try {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "node_modules", ".cache");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "test-db-url"), connectionUri, "utf-8");
  } catch {
    // ignore
  }

  // Enable pgvector extension + run migrations
  client = postgres(connectionUri, { max: 1 });
  await client`CREATE EXTENSION IF NOT EXISTS vector`;

  const db = drizzle(client);
  await migrate(db, {
    migrationsFolder: "./src/lib/db/migrations",
  });

  // Keep client open for potential reuse; close on teardown
}

export async function teardown(): Promise<void> {
  if (client) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    client = null;
  }
  if (container) {
    try {
      await container.stop();
    } catch {
      // ignore
    }
    container = null;
  }
  // Cleanup fallback file
  try {
    const { unlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    unlinkSync(join(process.cwd(), "node_modules", ".cache", "test-db-url"));
  } catch {
    // ignore
  }
}
