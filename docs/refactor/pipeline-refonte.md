# Refonte totale du pipeline

Diagnostic basé sur le search `aa9a9162-657b-4907-9bb3-812005c4801c`.
Résultat actuel : 2 sites gouvernementaux, 0 contacts. Échec total.

---

## Décision transversale : signaux → searchStrategies

**Supprimer les signaux** (`recently_funded`, `hiring_dev`, etc.) en tant que liste fixe hardcodée.

**Les remplacer par `searchStrategies`** : le LLM de `extract-criteria` produit directement les requêtes de recherche à lancer, pas des labels intermédiaires.

Raison : le mapping signal → requête était figé, limité à 6 cas, et maintenu à la main. Le LLM fait une traduction bien meilleure directement depuis la requête utilisateur.

---

## Changements par fichier

---

### `src/types/index.ts`

**Remplacer `SearchCriteria`** :

```typescript
// AVANT
export type SearchCriteria = {
  sector?: string;
  location?: string;
  signals: string[];
  techStack?: string[];
  employeeRange?: { min: number; max: number };
};

// APRÈS
export type SearchCriteria = {
  sector?: string;
  location?: string;
  techStack?: string[];
  employeeRange?: { min: number; max: number };
  remoteOk?: boolean;
  targetPersona?: string; // Use Case 3 : "CTO", "Head of Product", "DRH"
  maxResults?: number; // Use Case 2 : volume élevé (centaines de résultats)
  searchStrategies: string[]; // requêtes Brave à lancer, générées par le LLM
  qualificationCriteria: string[]; // ce que le LLM doit vérifier sur chaque site
};
```

**Ajouter `scrapedContent` dans `QualifiedCompany`** pour éviter le double-scraping :

```typescript
// AVANT
export type QualifiedCompany = CompanyData & {
  qualification: QualificationResult;
};

// APRÈS
export type QualifiedCompany = CompanyData & {
  qualification: QualificationResult;
  scrapedContent?: string; // transmis à enrich — pas de double scrape
};
```

---

### `src/lib/ai/prompts/extract-criteria.ts`

**Réécrire le schéma Zod** pour inclure `searchStrategies` et `qualificationCriteria` à la place de `signals` :

```typescript
export const searchCriteriaSchema = z.object({
  sector: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Secteur d'activité (ex: SaaS, e-commerce, fintech). null si non mentionné.",
    ),

  location: z
    .string()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Ville ou région en France. null si non mentionné."),

  techStack: z
    .array(z.string())
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Technologies mentionnées explicitement. null si aucune."),

  employeeRange: z
    .object({ min: z.number(), max: z.number() })
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Fourchette d'effectifs si mentionnée. null sinon."),

  remoteOk: z
    .boolean()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("true si le télétravail/remote est mentionné ou impliqué."),

  searchStrategies: z
    .array(z.string())
    .describe(
      "3 à 5 requêtes de recherche web en français ou anglais, prêtes à être envoyées à Brave Search. " +
        "Chaque requête doit cibler une intention différente (offre d'emploi, actualité, annuaire...). " +
        "Exemples : 'offre emploi développeur React startup Paris', 'recrutement CTO SaaS France 2024', " +
        "'levée de fonds startup fintech France site:bpifrance.fr'",
    ),

  qualificationCriteria: z
    .array(z.string())
    .describe(
      "2 à 4 critères que le LLM doit vérifier sur le site de chaque entreprise pour confirmer la pertinence. " +
        "En français, formulés comme des questions ou affirmations. " +
        "Exemples : 'L\\'entreprise a une offre d\\'emploi développeur ouverte', " +
        "'Aucun développeur interne visible dans l\\'équipe', 'Financement récent mentionné'",
    ),
});
```

**Réécrire `buildExtractCriteriaPrompt`** : normaliser `uiCriteria` avant de le passer au LLM (aplatir la structure `{"search": {"location": "X"}}` → `{"location": "X"}`).

---

### `src/lib/providers/interfaces/llm.ts`

**Mettre à jour `QualifyInput`** — `scrapedContent` devient explicitement utilisé :

```typescript
export type QualifyInput = {
  company: CompanyData;
  criteria: SearchCriteria;
  scrapedContent: string; // obligatoire (plus optionnel) — on ne qualifie pas sans contenu
};
```

---

### `src/lib/ai/prompts/qualify.ts`

Changer le prompt pour utiliser `qualificationCriteria` à la place des `signals` :

```typescript
// AVANT
- Signals to find: ${criteria.signals.join(", ")}

// APRÈS
Critères à vérifier sur ce site :
${criteria.qualificationCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}
```

Le prompt reçoit maintenant du contenu scraped réel + des critères précis formulés pour cette recherche spécifique.

---

### `src/lib/providers/llm/vercel.ts`

**Bug critique à corriger** : `scrapedContent` est actuellement destructuré et jeté.

```typescript
// AVANT (bug)
async qualify({ company, criteria }: QualifyInput) {
  prompt: buildQualifyPrompt({ company, criteria }),  // scrapedContent absent
}

// APRÈS
async qualify({ company, criteria, scrapedContent }: QualifyInput) {
  prompt: buildQualifyPrompt({ company, criteria, scrapedContent }),
}
```

---

### `src/lib/pipeline/steps/discover.ts`

**Réécrire entièrement.**

Nouvelle logique :

1. Lancer chaque `searchStrategy` de `criteria.searchStrategies` en parallèle (limit=10 par requête)
2. Agréger toutes les URLs → dédupliquer par domain
3. Filtrer les domains blacklistés
4. Pour chaque domain restant : appeler `company.findByDomain()` pour enrichir avec données légales
5. **Fixer le bug domain** : si le provider retourne un SIREN comme domain, garder le webDomain d'origine

```typescript
// Nouvelle signature — inchangée, seul le corps change
export async function discover({
  criteria,
  search,
  company,
}: DiscoverOptions): Promise<Result<CompanyData[]>>;
```

**Blocklist de domaines** (à définir comme constante dans le fichier) :

```typescript
const NOISE_DOMAINS = new Set([
  "insee.fr",
  "annuaire-entreprises.data.gouv.fr",
  "data.gouv.fr",
  "infogreffe.fr",
  "societe.com",
  "verif.com",
  "manageo.fr",
  "pappers.fr",
  "linkedin.com",
  "welcometothejungle.com",
  "indeed.fr",
  "indeed.com",
  "monster.fr",
  "apec.fr",
  "pole-emploi.fr",
  "wikipedia.org",
  "lefigaro.fr",
  "lemonde.fr",
  "bfmtv.com",
]);
```

**Fix domain SIREN** — quand `company.findByDomain(webDomain)` retourne des données :

```typescript
// Le provider peut retourner son SIREN comme domain — on garde toujours le webDomain
const enriched: CompanyData = {
  name: registryData?.name ?? result.title,
  domain: webDomain, // jamais le SIREN, toujours le domain web
  sector: registryData?.sector ?? "",
  location: registryData?.location ?? "",
  employeeCount: registryData?.employeeCount,
  legalForm: registryData?.legalForm,
  foundedAt: registryData?.foundedAt,
};
```

**Augmenter la limite** : 10 résultats par requête (au lieu de 3).
Avec 3-5 searchStrategies → 30-50 URLs brutes → après dédup + filtre → 10-20 entreprises réelles.

---

### `src/lib/pipeline/steps/qualify.ts`

**Cibler des pages spécifiques selon `qualificationCriteria`** au lieu de scraper systématiquement la homepage.

Pour une recherche orientée recrutement : essayer d'abord `/jobs`, `/recrutement`, `/carrieres` avant la homepage. La homepage d'une PME ne mentionne pas ses offres d'emploi.

**Stocker `scrapedContent` dans le résultat** pour le transmettre à enrich :

```typescript
return {
  success: true,
  data: {
    ...company,
    qualification: qualifyResult.data,
    scrapedContent: scrapeResult.data.content, // transmis à enrich
  },
};
```

**Seuil de score** : passer de 0.35 à **0.5** (trop de faux positifs à 0.35).

**Marquer explicitement les échecs de scraping** au lieu de retourner `null` silencieusement :

```typescript
// AVANT
if (!scrapeResult.success) return null; // disparaît silencieusement

// APRÈS — logger + retourner avec score 0 et raison explicite
// OU filtrer mais logger proprement
```

---

### `src/lib/pipeline/steps/enrich.ts`

**Réutiliser `scrapedContent` de qualify** — si disponible, extraire les emails directement sans nouveau scrape :

```typescript
export async function enrich({
  companies,
  email,
}: EnrichOptions): Promise<Result<EnrichedCompany[]>> {
  const above = companies.filter(
    (c) => c.qualification.score >= SCORE_THRESHOLD,
  );

  const settlements = await Promise.allSettled(
    above.map(async (company) => {
      // Si qualify a déjà scraped le site — extraire emails depuis ce contenu
      // Sinon — appeler email provider normalement
      const contacts = company.scrapedContent
        ? extractEmailsFromScrapedContent(company)
        : await fetchContactsFromProvider(company, email);
      return { ...company, contacts } as EnrichedCompany;
    }),
  );
  // ...
}
```

---

### `src/lib/pipeline/index.ts`

**`upsertCompany`** — mettre à jour tous les champs, pas seulement `name` et `lastScrapedAt` :

```typescript
.onConflictDoUpdate({
  target: companiesTable.domain,
  set: {
    name: company.name,
    sector: company.sector || undefined,
    location: company.location || undefined,
    employeeCount: company.employeeCount ?? null,
    lastScrapedAt: new Date(),
  },
})
```

**`saveContacts`** — passer en parallèle (`Promise.allSettled`) et vérifier les doublons d'emails avant insert.

---

### `src/lib/use-cases/freelance.ts`

**Supprimer `signals` et `scoringWeights`** — ils ne servent plus à rien avec les searchStrategies.
Ces champs n'ont jamais été utilisés dans le code de toute façon.

```typescript
// AVANT
export const freelanceConfig: UseCaseConfig = {
  signals: ["recently_funded", "hiring_dev", ...],
  scoringWeights: { hiring_dev: 0.35, ... },
  // ...
};

// APRÈS — plus de signals, plus de scoringWeights dans UseCaseConfig
```

**Corriger le model ID** : `"gpt-5.4-mini"` → `"gpt-4o-mini"` (le modèle actuel).

---

### `src/lib/use-cases/index.ts`

**Mettre à jour `UseCaseConfig`** — retirer `signals` et `scoringWeights`, ajouter `enrichStrategy` et `maxResults` :

```typescript
export type EnrichStrategy = "domain" | "persona";
// "domain"  → findByDomain() — Use Cases 1 et 2
// "persona" → findContact({ role, domain }) — Use Case 3

export type UseCaseConfig = {
  name: string;
  description: string;
  providers: UseCaseProviders;
  enrichStrategy: EnrichStrategy; // comment enrich cherche les contacts
  maxResults: number; // combien d'entreprises retourner max
};
```

**Pourquoi `enrichStrategy` dans le config et pas dans `SearchCriteria` ?**
`SearchCriteria` est produit par le LLM à partir de la requête utilisateur — c'est du contexte dynamique.
`enrichStrategy` est une décision architecturale du use case, pas de l'utilisateur. Elle appartient au config.

**Pourquoi `maxResults` dans les deux ?**

- `UseCaseConfig.maxResults` = valeur par défaut du use case (ex: 20 pour freelance, 200 pour agence)
- `SearchCriteria.maxResults` = override par l'utilisateur pour une recherche spécifique

---

## Ordre d'implémentation recommandé

Les changements sont interdépendants. Cet ordre minimise les états intermédiaires cassés.

**Bloc 1 — Types (fondation)**

1. `src/types/index.ts` — nouveau `SearchCriteria` + `QualifiedCompany` avec `scrapedContent`

**Bloc 2 — LLM (produit les nouvelles données)** 2. `src/lib/ai/prompts/extract-criteria.ts` — nouveau schéma + prompt 3. `src/lib/ai/prompts/qualify.ts` — `qualificationCriteria` au lieu de `signals` 4. `src/lib/providers/llm/vercel.ts` — corriger le bug `scrapedContent` ignoré 5. `src/lib/providers/interfaces/llm.ts` — `scrapedContent` obligatoire dans `QualifyInput`

**Bloc 3 — Pipeline steps** 6. `src/lib/pipeline/steps/discover.ts` — réécriture totale (multi-query + fix domain + blocklist) 7. `src/lib/pipeline/steps/qualify.ts` — ciblage pages + transmettre scrapedContent + seuil 0.5 8. `src/lib/pipeline/steps/enrich.ts` — réutiliser scrapedContent

**Bloc 4 — Orchestrateur + use-case** 9. `src/lib/pipeline/index.ts` — upsert + contacts parallèles 10. `src/lib/use-cases/freelance.ts` — supprimer signals/scoringWeights + fix model ID 11. `src/lib/use-cases/index.ts` — mettre à jour `UseCaseConfig`

---

## Extensibilité — nouveaux use cases futurs

**Ce qui s'adapte automatiquement (sans toucher la pipeline) :**

- Le contenu de la recherche — `searchStrategies` et `qualificationCriteria` sont générés par le LLM depuis la requête utilisateur. N'importe quel use case B2B prospection fonctionne sans modifier une ligne.
- Les providers — chaque use case choisit ses providers dans son config. Ajouter un provider international = créer un adapter, pas toucher la pipeline.
- Le scoring — `qualificationCriteria` guide le LLM. Changer les critères = changer le config.

**Ce qui nécessite un nouveau config uniquement :**
Investisseur cherchant des startups, journaliste, recruteur, partenaire intégrateur → tous rentrent dans le moule `discover → qualify → enrich` avec un config différent.

**La seule limite réelle :**
Un use case fondamentalement person-first (ex: "trouver des CTO nommément, puis identifier leur entreprise") ne rentre pas dans la pipeline actuelle. Ce serait une pipeline différente. Aucun des 3 use cases documentés n'atteint cette limite.

---

## Bugs critiques (à corriger même avant la refonte complète)

Si on veut tester rapidement sans tout réécrire :

1. **`vercel.ts` ligne ~83** : ajouter `scrapedContent` dans la destructuration et dans `buildQualifyPrompt`
2. **`discover.ts` `DEFAULT_SEARCH_LIMIT`** : passer de 3 à 10
3. **`discover.ts` `buildSearchQuery`** : utiliser `criteria.signals` pour enrichir la requête (temporaire)
4. **`discover.ts` `resolveCompanies`** : garder le `webDomain` quand le provider retourne SIREN
5. **`enrich.ts` `SCORE_THRESHOLD`** : passer de 0.35 à 0.5

---

## Mise à jour de docs/ après la refonte

Une fois la refonte terminée et validée, mettre à jour ces fichiers dans `docs/` pour rester la source de vérité :

| Fichier                     | Ce qui change                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`      | Remplacer "signals" par "searchStrategies + qualificationCriteria" dans la description du pipeline. Mettre à jour le flow du Step 2 (multi-query). Ajouter `enrichStrategy` dans la section Use Cases. |
| `docs/conventions.md`       | Rien à changer structurellement — les règles tiennent.                                                                                                                                                 |
| `docs/database.md`          | Rien à changer — le schéma DB n'est pas touché.                                                                                                                                                        |
| `docs/providers.md`         | Mettre à jour `LLMProvider.QualifyInput` — `scrapedContent` devient obligatoire. Mettre à jour `SearchCriteria` avec les nouveaux champs.                                                              |
| `docs/use-cases.md`         | Mettre à jour la section "Use Case Config Pattern" — retirer `signals`/`scoringWeights`, ajouter `enrichStrategy`/`maxResults`.                                                                        |
| `docs/tech-stack.md`        | Corriger le model ID : `gpt-5.4-mini` → `gpt-4o-mini`.                                                                                                                                                 |
| `docs/checklist.md`         | Décocher les phases 9-15 et les réécrire pour refléter la nouvelle pipeline. Ou ajouter une Phase 16 "Refonte pipeline".                                                                               |
| `docs/project-structure.md` | Rien à changer — la structure des fichiers reste identique.                                                                                                                                            |
