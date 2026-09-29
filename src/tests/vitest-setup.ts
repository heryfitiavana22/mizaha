import { inject } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

// If testcontainers globalSetup provided a URL, override DATABASE_URL before src/env is evaluated.
// This makes src/lib/db (which reads env.DATABASE_URL at import) point to the ephemeral DB.
// Falls back to file written by globalSetup if provide/inject is not available.
let testDbUrl: string | undefined;
try {
  testDbUrl = (inject as unknown as (key: string) => string | undefined)(
    "testDatabaseUrl",
  );
} catch {
  // inject not available outside Vitest context
}
if (!testDbUrl) {
  const fallback = join(process.cwd(), "node_modules", ".cache", "test-db-url");
  if (existsSync(fallback)) {
    try {
      testDbUrl = readFileSync(fallback, "utf-8").trim();
    } catch {
      // ignore
    }
  }
}
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
