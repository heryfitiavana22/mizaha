# Expected Model Behavior

LLM calls in the pipeline and what we expect from each.

---

## Call 1 — `extractCriteria`

**Input**

```
rawQuery: "je cherche un entreprise qui recherche un dev"
useCase: freelance
uiCriteria (flattened):
  - jobType: Développeur Full Stack
  - contract: Freelance
  - location: Télétravail
  - seniority: Confirmé
  - techStack: typescript,node
  - remoteOnly: true
```

**Expected output**

`searchStrategies` — queries that target company pages directly:

```
✓ startup TypeScript Node.js "développeur freelance" télétravail site:.fr
✓ "nous recrutons" développeur full stack TypeScript Node.js remote France
✓ entreprise SaaS France missions freelance TypeScript Node.js confirmé
```

NOT:

```
✗ site:indeed.com freelance TypeScript Node.js
✗ site:linkedin.com développeur freelance typescript
✗ développeur France  (too generic)
```

`qualificationCriteria` — verifiable from company website, in French:

```
✓ "L'entreprise publie une offre ou mission freelance pour un développeur TypeScript/Node.js"
✓ "La mission est proposée en télétravail ou remote"
```

---

## Call 2 — `extractCompanies`

**Input** — a list of Brave search results (title + url + snippet)

**Expected behavior**

| Result title                                                       | Expected output          |
| ------------------------------------------------------------------ | ------------------------ |
| `"Devoteam is looking for a Full Stack TypeScript developer"`      | `"Devoteam"`             |
| `"Acme SaaS recrute un développeur Node.js freelance"`             | `"Acme SaaS"`            |
| `"500 offres freelance TypeScript \| Indeed"`                      | _(nothing — aggregated)_ |
| `"Développeur Node.js Freelance \| LinkedIn"`                      | _(nothing — aggregated)_ |
| `"TechCorp Paris – Carrières"`                                     | `"TechCorp"`             |
| `"Offres d'emploi développeur TypeScript – Welcome to the Jungle"` | _(nothing — aggregated)_ |

**What makes this call succeed or fail**

Succeeds if:

- Search results contain individual company names in their titles/snippets
- Company names are distinct and unambiguous

Fails (returns empty) if:

- All results are aggregated pages with no company name in the title
- Titles are too generic ("développeur freelance France")

---

## Call 3 — `qualify`

**Input** — company scraped content + qualificationCriteria

**Expected behavior**

Score ≥ 0.5 if the scraped content mentions:

- A freelance mission or dev job offer
- TypeScript and/or Node.js
- Remote / télétravail

Score < 0.5 (filtered out) if:

- The page is a job board listing many companies
- No dev hiring signal found
- Technologies don't match

**Reason field** — always in French, readable by the user:

```
✓ "L'entreprise propose une mission freelance TypeScript Node.js en full remote."
✗ "Aucune offre de mission freelance identifiée sur le site."
```
