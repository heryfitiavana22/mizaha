# Mizaha — Source of Truth

**Mizaha** — Malagasy word meaning _"to search, to look, to examine"_.
A name that reflects exactly what the project does: find and examine companies.

> This folder is the source of truth for the project.
> Read before touching any code. Update when a decision changes.

---

## Index

| File                                             | Content                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| [vision.md](./vision.md)                         | The idea, the problem solved, the future             |
| [use-cases.md](./use-cases.md)                   | Use cases, manual → automated pipeline               |
| [tech-stack.md](./tech-stack.md)                 | All technology decisions and why                     |
| [architecture.md](./architecture.md)             | System architecture, pipeline, abstraction           |
| [database.md](./database.md)                     | Complete database schema                             |
| [providers.md](./providers.md)                   | External APIs, interfaces, free tiers                |
| [project-structure.md](./project-structure.md)   | Project folder structure                             |
| [conventions.md](./conventions.md)               | Code conventions — rules to follow                   |
| [checklist.md](./checklist.md)                   | Build checklist — phases A to Z (from scratch)       |
| [refactor-checklist.md](./refactor-checklist.md) | Refactor checklist — what to change in existing code |
| [alignment.md](./alignment.md)                   | Alignment doc — read before coding the refactor      |

---

## In One Sentence

A natural language-driven company search engine — the user describes what they're looking for, the system finds, qualifies, and presents matching companies with the right contact.

---

## Core Principles

These principles never change. If a decision violates them, discuss before acting.

**1. Total abstraction**
Code against interfaces, never against implementations directly.
Changing an external tool = changing one adapter file. Nothing else.

**2. Generic pipeline**
Same engine for all use cases. Only the configuration changes.
Adding a new use case = creating a config file. Don't touch the pipeline.

**3. France first**
The MVP targets French companies only.
Internationalization comes later — the engine is designed to accommodate it.

**4. No premature complexity**
Only add what is needed now.
Future tables exist in the schema but are not used in the MVP.

**5. Schema designed for the future**
The database schema anticipates multi-tenant, billing, CRM integrations, etc.
We don't implement them now but we will never be blocked later.

**6. Always verify online before coding**
Knowledge has an expiration date. Before implementing anything with an external tool, verify online:

- The current official documentation
- Is the free tier still valid? Have the limits changed?
- Has the API changed since last time?
- Does the tool still exist?

This applies to everything: providers (Brave, Pappers, Firecrawl, Hunter...), libraries (json-render, Drizzle, AI SDK...), and any tool referenced in this doc.
**Never assume that what was true yesterday is still true today.**

---

## What Is Decided (do not question without discussion)

- First use case: freelance dev looking for clients in France
- No login in MVP (personal use only)
- PostgreSQL + pgvector in Docker locally
- Drizzle ORM (not Prisma)
- Claude API as main LLM
- Production DB: to be decided later

---

## Project Status

| Phase                                                          | Status      |
| -------------------------------------------------------------- | ----------- |
| Discussion & design                                            | Done        |
| Project setup                                                  | Done        |
| Core pipeline (extract-criteria → discover → qualify → enrich) | Done        |
| Provider abstraction (6 interfaces, all adapters wired)        | Done        |
| UC1 — Freelance client search (company discovery)              | Done        |
| UC2 — Job/mission search (job_offer discovery, FreeWork)       | Done        |
| Results page (company cards + job offer cards)                 | Done        |
| Chat interface (json-render, interactive criteria)             | In progress |
| Production deployment                                          | To do       |
