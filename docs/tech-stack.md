# Tech Stack

## Main Rule

Code against **interfaces**, never against tools directly.
If a tool closes its free tier or becomes too expensive, change the adapter. The rest of the code doesn't move.

---

## Frontend

| Tool                              | Role                        | Reason                                                           |
| --------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| Next.js (App Router)              | Main framework              | Compatible with Vercel AI SDK, industry standard                 |
| Vercel AI SDK                     | Streaming and chat hooks    | Built exactly for this use case                                  |
| AI Elements (elements.ai-sdk.dev) | AI-native UI components     | Ready-made chat, messages, tools components — built on shadcn/ui |
| Streamdown (streamdown.ai)        | Streamed Markdown rendering | Optimized to display LLM responses in real time                  |
| shadcn/ui                         | Base UI components          | Standard, customizable, no heavy dependency                      |
| json-render (json-render.dev)     | Generative UI               | AI dynamically generates interactive interfaces via JSON         |

---

### json-render — Generative UI

json-render is used at two specific points in Mizaha:

**1. Search chat (step 1)**
When the user refines their criteria, the AI responds with interactive components instead of plain text — checkboxes for sector, slider for company size, signal selector. The chat becomes an intelligent configuration interface.

**2. Results display (step 3)**
The AI adapts the results layout based on the search context. Search by region → adapted view. Search by funding → funding timeline highlighted.

**Principle:** we define a catalog of allowed components. The AI can only use these components — no improvisation. Two catalogs:

- `catalog/chat.ts` → components for refining criteria
- `catalog/results.ts` → components for displaying companies

---

## Artificial Intelligence

| Tool                 | Role     | Reason                                             |
| -------------------- | -------- | -------------------------------------------------- |
| OpenAI (gpt-4o-mini) | Main LLM | Structured Outputs support, cost-effective for MVP |

The LLM is used for:

- Extracting structured criteria from natural language
- Qualifying and scoring each found company
- Explaining why a company matches (in French)
- Generating a contact message draft

The model is injected at runtime via `VercelLLMProvider` — switching to another model (Claude, Gemini, etc.) means changing one line in `src/lib/use-cases/freelance.ts`.

---

## Database

| Tool                  | Role      | Reason                                                               |
| --------------------- | --------- | -------------------------------------------------------------------- |
| PostgreSQL + pgvector | Database  | Relational + vector search in a single system                        |
| Docker (local)        | Local dev | 1 lightweight container — no Supabase local (too heavy)              |
| Drizzle ORM           | ORM       | TypeScript native, close to SQL, better pgvector support than Prisma |

**Local Docker**:

```yaml
# Single container, official pgvector image
image: pgvector/pgvector:pg16
```

**Production**: To be decided. Do not anticipate before it's needed.

---

## Orchestration

In MVP, the pipeline is orchestrated directly in code in `src/lib/pipeline/index.ts`.
n8n comes when the pipeline is stable and needs to be modifiable without touching the code.

---

## Deployment

| Tool             | Status                     |
| ---------------- | -------------------------- |
| Vercel           | MVP — free tier sufficient |
| Production infra | To be decided later        |

---

## Developer Tooling

| Tool                | Role                            | Reason                                                             |
| ------------------- | ------------------------------- | ------------------------------------------------------------------ |
| pnpm                | Package manager                 | Faster than npm/yarn, strict dependency resolution, disk efficient |
| ESLint              | Static analysis                 | Catches bugs and enforces rules at development time                |
| Prettier            | Code formatter                  | Uniform formatting, no debates — format on save                    |
| Husky + lint-staged | Pre-commit hooks                | Runs ESLint + Prettier on staged files only before each commit     |
| commitlint          | Commit message validation       | Enforces Conventional Commits format                               |
| pino + pino-pretty  | Structured logging              | JSON logs in production, human-readable in development             |
| @t3-oss/env-nextjs  | Environment variable validation | Zod-validated — app refuses to start if a required var is missing  |

---

### Commit format (commitlint)

Conventional Commits:

```text
<type>(<scope>): <description>

Types: feat, fix, refactor, docs, test, chore
```

Examples:

```text
feat(pipeline): add qualify step with scoring
fix(providers): handle firecrawl timeout error
docs(conventions): add early return rule
```

---

### Logging (pino)

- **Production**: `pino` — structured JSON, compatible with log aggregators
- **Development**: `pino-pretty` — human-readable colored output
- **Used in**: providers (each API call logged with duration + status) and pipeline orchestrator (`pipeline/index.ts`)
- **Relation to DB**: the `pipeline_runs` table is the persistent history. pino is real-time debugging. Both coexist.

---

### Env validation (@t3-oss/env-nextjs)

All environment variables are declared in `src/env.ts`, zod-validated at startup.
If a required key is missing or malformed, the app refuses to start — no silent failures.

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1),
    BRAVE_SEARCH_API_KEY: z.string().min(1),
    PAPPERS_API_KEY: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    HUNTER_API_KEY: z.string().optional(),
    APOLLO_API_KEY: z.string().optional(),
    SERP_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
});
```

---

## Rejected Decisions and Why

| Tool              | Rejected            | Reason                                                          |
| ----------------- | ------------------- | --------------------------------------------------------------- |
| Prisma            | In favor of Drizzle | Worse pgvector support, external query engine, less SQL control |
| Supabase local    | Rejected            | Too heavy (~10 Docker containers) for a small machine           |
| Crunchbase API    | Rejected            | No free tier, too expensive                                     |
| LinkedIn scraping | Rejected            | Against their ToS                                               |
