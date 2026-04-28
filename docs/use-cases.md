# Use Cases

## Core Principle

The pipeline is **identical** for all use cases.
What changes between cases: the criteria, the priority sources, the qualification logic.
Adding a new use case = creating a config file in `src/lib/use-cases/`. Nothing else.

---

## Manual Steps → Automated

This table shows what a human does manually today, and how the system automates it.

| Step                    | What the human does                    | What the system does                                  |
| ----------------------- | -------------------------------------- | ----------------------------------------------------- |
| 1. Define criteria      | Thinks in their head                   | Conversational chat → Claude extracts structured JSON |
| 2. Search for companies | LinkedIn, Google, Crunchbase for hours | Brave Search + Pappers + SIRENE automatically         |
| 3. Qualify each company | Visits each site, checks the team      | Firecrawl scrape + Claude scores and explains         |
| 4. Find the contact     | Searches for CTO/founder on LinkedIn   | Hunter.io + Apollo find name, role, email             |
| 5. Contact              | Writes a personalized message          | Claude generates a draft — the human sends            |

**Steps 1 and 5 remain human** (criteria and final contact).
**Steps 2, 3, 4 are fully automated.**

---

## Use Case 1 — Freelance Dev (current MVP)

**Who**: Freelance developer looking for client missions in France

**What they look for**: Companies that need a dev but don't have one yet

**Signals searched**:

- Dev job posting open for 2+ months → they're struggling to recruit
- Recent funding → budget available, need to move fast
- No developer visible in the team (LinkedIn, team page)
- New product or new feature announced

**Priority sources**:

- Pappers / SIRENE → official French company data
- Job boards (Welcome to the Jungle, Indeed) → open dev positions
- Brave Search → startup lists, news
- Firecrawl → scraping sites for tech stack and context

**Output for each company**:

- Name + website
- Why it matches the criteria (readable explanation)
- Recommended contact: name, role, email

**Query examples** (French users type in French):

> "Je cherche des startups françaises qui ont besoin d'un dev React"
> "Trouve-moi des PME en Île-de-France sans développeur interne qui ont levé des fonds"
> "Je suis dev Node.js, cherche des boîtes e-commerce qui recrutent un dev depuis plus d'un mois"

---

## Use Case 2 — Small Agency (future)

**Who**: Agency (marketing, dev, design) that prospects manually in Excel files

**What they look for**: Companies without a current agency, with a budget

**Signals**:

- No visible digital service provider
- Weak online presence (outdated site, no active social media)
- Sector and size matching their ideal client profile

**Differences vs Use Case 1**:

- Higher volume (need hundreds of results)
- Output to CRM (HubSpot / Pipedrive integration later)
- Multiple team members accessing the same searches (organizations)

**Query examples**:

> "Je cherche des PME en France dans le e-commerce qui n'ont pas encore d'agence marketing"
> "Trouve des restaurants et hôtels en région PACA avec un site vieillissant"
> "PME industrielles de 20 à 100 personnes en Bretagne sans présence sur les réseaux sociaux"

---

## Use Case 3 — LinkedIn Sales (future)

**Who**: B2B sales person spending their days on LinkedIn Sales Navigator

**What they look for**: Qualified leads quickly with the right filters

**Signals**:

- Exact role (CTO, Head of Product, HR Director...)
- Recent team growth
- LinkedIn activity of the target

**Differences vs Use Case 1**:

- Criteria very persona-oriented (role, seniority)
- More focused on individual contact than company
- High volume, regular cadence

**Query examples**:

> "Je cherche des boîtes de 50 à 200 personnes dans la logistique en Île-de-France"
> "Trouve des directeurs RH dans des entreprises tech françaises de plus de 100 personnes"
> "Startups SaaS B2B françaises en croissance avec un Head of Sales récemment recruté"

---

## Adding a New Use Case

1. Create `src/lib/use-cases/[name].ts`
2. Define:
   - The criteria to extract from natural language
   - The sources to activate in priority
   - The scoring / qualification logic
   - The output format
3. Register it in `src/lib/use-cases/index.ts`
4. The pipeline handles it automatically — nothing else to touch
