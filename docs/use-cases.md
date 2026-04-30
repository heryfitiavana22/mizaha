# Use Cases

## Core Principle

The pipeline is **identical** for all use cases.
What changes: the target entity type, the sources to activate, the qualification logic, the output format.
Adding a new use case = creating a config file in `src/lib/use-cases/`. Nothing else.

---

## Target Entity

The most important decision in a use case config is **what we're searching for**.

| `targetEntity` | What the pipeline returns          | Examples                                    |
| -------------- | ---------------------------------- | ------------------------------------------- |
| `"company"`    | Companies matching the criteria    | Freelance client search, agency prospecting |
| `"job_offer"`  | Job postings matching the criteria | Dev looking for missions or CDI             |

This single field changes the behavior of discover, qualify, and enrich.

---

## Manual Steps → Automated

| Step               | What the human does                    | What the system does                                         |
| ------------------ | -------------------------------------- | ------------------------------------------------------------ |
| 1. Define criteria | Thinks in their head                   | Chat → Claude extracts structured criteria                   |
| 2. Search          | Browse LinkedIn, job boards for hours  | Multi-source discover (France Travail, WTTJ, Pappers, Brave) |
| 3. Qualify         | Visits each site or reads each posting | Firecrawl scrape + Claude scores and explains                |
| 4. Enrich          | Searches for contact / company info    | Scrape team page / Pappers lookup                            |
| 5. Contact         | Writes a personalized message          | Claude generates a draft — the human sends                   |

**Steps 1 and 5 remain human.**
**Steps 2, 3, 4 are fully automated.**

---

## Use Case 1 — Freelance Dev looking for client companies (MVP)

**Who**: Freelance developer prospecting for client missions in France

**targetEntity**: `"company"`

**What they look for**: Companies that need a dev but don't have one yet

**Sources activated**:

- France Travail API → companies with open dev positions
- WTTJ Algolia API → tech startups (public Algolia index — no scraping)
- SIRENE → official company data + domain resolution

**Signals extracted dynamically by the LLM from the user's query** (no hardcoded list):

- "cherche un dev" → hiring signal → France Travail + WTTJ
- "levée de fonds" → news signal → Brave targeted queries
- "sans développeur interne" → structural signal → Pappers search

**Output per company**:

- Name + website
- Why it matches (readable explanation in French)
- Recommended contact: name, role, email

**Query examples** (users type in French):

> "Je cherche des startups françaises qui ont besoin d'un dev React"
> "Trouve-moi des PME en Île-de-France sans développeur interne qui ont levé des fonds"
> "Je suis dev Node.js, cherche des boîtes e-commerce qui recrutent un dev depuis plus d'un mois"

---

## Use Case 2 — Dev looking for job offers / missions

**Who**: Developer (freelance or employee) looking for missions or CDI in France

**targetEntity**: `"job_offer"`

**What they look for**: Job postings matching their tech stack, contract type, location, seniority

**Sources activated**:

- FreeWork API → freelance/contractor missions (primary — public JSON API, no auth)
- France Travail API → CDI/CDD postings (fallback)
- No Brave needed (job boards ARE the source here)

**Output per job offer**:

- Job title + company name + location
- Contract type (CDI, CDD, freelance, alternance)
- Tech stack mentioned
- Why it matches (score + explanation)
- Apply link + company info from SIRENE

**Query examples**:

> "Je cherche une mission freelance TypeScript Node.js en full remote"
> "Trouve-moi des offres CDI dev React Paris pour un profil confirmé"
> "Missions freelance backend Python pour une startup, Île-de-France ou remote"

**Key difference vs Use Case 1**:

- The target entity is the **job offer**, not the company
- No contact finding needed (apply link is the output)
- qualify scores the posting content directly — no website scraping
- enrich adds company metadata from Pappers/SIRENE

---

## Use Case 3 — Small Agency looking for clients (future)

**Who**: Agency (marketing, dev, design) prospecting manually

**targetEntity**: `"company"`

**What they look for**: Companies without a current agency, with budget

**Differences vs Use Case 1**:

- Higher volume (`maxResults: 200` vs 20)
- `enrichStrategy: "domain"` (any company email, not persona-targeted)
- Future: CRM export (HubSpot / Pipedrive)

**Query examples**:

> "Je cherche des PME en France dans le e-commerce qui n'ont pas encore d'agence marketing"
> "Trouve des restaurants et hôtels en région PACA avec un site vieillissant"

---

## Use Case 4 — B2B Sales / LinkedIn Sales (future)

**Who**: B2B sales person looking for qualified leads

**targetEntity**: `"company"`

**What they look for**: Companies with a specific decision-maker profile

**Differences vs Use Case 1**:

- `enrichStrategy: "persona"` — targets a specific role (CTO, DRH, Head of Product)
- High volume, regular cadence

**Query examples**:

> "Je cherche des boîtes de 50 à 200 personnes dans la logistique en Île-de-France"
> "Trouve des directeurs RH dans des entreprises tech françaises de plus de 100 personnes"

---

## Adding a New Use Case

1. Create `src/lib/use-cases/[name].ts`
2. Define:
   - `targetEntity: "company" | "job_offer"` — what to search for
   - `providers` — which adapters to activate
   - `enrichStrategy: "domain" | "persona"` — how to find contacts
   - `maxResults` — default result count
3. Register it in `src/lib/use-cases/index.ts`
4. The pipeline handles it automatically — nothing else to touch

The search criteria (`searchStrategies`, `qualificationCriteria`, `signalSources`, etc.) are generated dynamically by the LLM from the user's natural language query. No hardcoded signals or scoring weights in the config.

---

## What Makes the Pipeline Flexible

The pipeline never hardcodes what it's looking for. Every decision about **what signals matter**, **which sources to use**, and **how to qualify** is generated by the LLM at runtime from the user's query. The use case config only defines structural decisions (which adapters are available, what entity type to return, how many results).

This means:

- An investor looking for startups → same pipeline, new config file
- A journalist looking for company stories → same pipeline, new config file
- A recruiter looking for companies that are hiring → same pipeline, new config file
- A developer looking for internships → same pipeline, `targetEntity: "job_offer"`, new config file
