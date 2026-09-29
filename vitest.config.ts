import dotenv from "dotenv";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globalSetup: ["./src/tests/setup/testcontainers.global.ts"],
    setupFiles: ["./src/tests/vitest-setup.ts"],
  },
});
