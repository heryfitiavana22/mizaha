# Pipeline Improvements

> Diagnostic établi après analyse du run `aa9a9162-657b-4907-9bb3-812005c4801c`.
> Query : `"je cherche un entreprise qui recherche un dev"`
> uiCriteria : `{"search": {"location": "À distance", "contractType": "CDI"}}`

---

## Ce qui s'est passé — step by step

### Step 1 — extract-criteria (2.6s) — partiellement cassé

Output : `{"signals": ["hiring_dev"]}` — c'est tout.

Les uiCriteria (`location: "À distance"`, `contractType: "CDI"`) ont été ignorés.
Le prompt attend des paires clé/valeur plates, mais l'UI envoie un objet imbriqué `{"search": {...}}`.
Le LLM n'a pas su les lire → critères perdus.
Résultat : criteria ultra-sparse, sans location, sans sector.

---

### Step 2 — discover (4.8s) — complètement cassé

Output : 3 "entreprises" :

- `insee.fr` — le site de l'INSEE
- `annuaire-entreprises.data.gouv.fr` — un annuaire gouvernemental
- `909172116` — un numéro SIREN (UNSA BUSINESSFRANCE), pas un domaine

Causes :

1. **`buildSearchQuery` ignore les signaux.** Avec criteria `{signals: ["hiring_dev"]}` sans sector ni location, la fonction construit juste `"entreprise"`. Brave renvoie les premiers résultats génériques → l'INSEE et l'annuaire des entreprises. Le signal `hiring_dev` n'est jamais traduit en mots-clés.

2. **SIREN utilisé comme `domain`.** SIRENE et Pappers n'ont pas de champ "domain web". On stocke le SIREN comme `domain`. Mais tout le pipeline suppose que `domain` est un vrai domaine web — `buildCompanyUrl("909172116")` → `https://909172116` → Firecrawl échoue → la company disparaît silencieusement.

3. **Seuls 3 résultats.** `DEFAULT_SEARCH_LIMIT = 3` dans `brave.ts`. Aucune chance d'avoir de la diversité.

4. **Pas de blocklist.** `insee.fr`, `annuaire-entreprises.data.gouv.fr`, `societe.com` ne sont jamais des cibles client. Aucun filtre ne les rejette.

---

### Step 3 — qualify (7.4s) — résultats mauvais

- `insee.fr` : score 0 (correct, mais Firecrawl a gaspillé 1 crédit pour le scraper)
- `annuaire-entreprises.data.gouv.fr` : score 0.4 avec `matchedSignals: ["hiring_dev"]` → hallucination du LLM sur un annuaire gouvernemental
- UNSA BUSINESSFRANCE : disparue silencieusement (scrape de `https://909172116` a échoué)

Problème supplémentaire : `qualify` est entièrement séquentiel — chaque company est scrapée + qualifiée l'une après l'autre.

---

### Step 4 — enrich (19.7s) — 0 contacts

Normal : `insee.fr` et `data.gouv.fr` n'ont pas de contacts individuels à démarcher.
Mais 19.7 secondes pour ne rien trouver — Brave search + scraping × 2 companies, tout séquentiel.

---

## Problèmes racines — par ordre de criticité

### 1. `buildSearchQuery` ne traduit pas les signaux (critique)

Fichier : `src/lib/pipeline/steps/discover.ts`

Les signaux doivent se traduire en mots-clés de recherche concrets.
Aujourd'hui ils sont complètement ignorés dans la construction de la query.

Ce que ça doit produire :

- `hiring_dev` → ajouter `"recrute développeur" OR "cherche développeur" OR "offre emploi dev"`
- `recently_funded` → ajouter `"levée de fonds" OR "série A" OR "série B"`
- `no_internal_dev` → cibler PME/startups sans CTO visible
- `new_product` → ajouter `"nouveau produit" OR "lancement"`
- La location doit apparaître dans la query
- Le sector doit apparaître dans la query
- Le techStack doit apparaître dans la query

---

### 2. SIREN ≠ domain — architecture cassée (critique)

Fichiers : `src/lib/providers/company/pappers.ts`, `src/lib/providers/company/sirene.ts`

Pappers et SIRENE ne connaissent pas le domaine web d'une company.
On utilise le SIREN comme `domain` par défaut — mais tout le pipeline suppose que `domain` est un vrai domaine web.
Conséquences :

- `buildCompanyUrl(siren)` → URL invalide → scrape échoue → company silencieusement supprimée
- Déduplication par `domain` fonctionne mal
- La company est cassée à toutes les étapes suivantes

Bonne architecture :
**Brave cherche des vraies URLs → on extrait le vrai domaine → SIRENE/Pappers enrichissent optionnellement les données légales.**
SIRENE et Pappers ne doivent jamais être la source du champ `domain`.
Si SIRENE ne connaît pas le domaine, on garde le domaine extrait de l'URL Brave.

---

### 3. Pas de blocklist des domaines à rejeter (critique)

Fichier : `src/lib/pipeline/steps/discover.ts`

Avant de passer les résultats Brave à `resolveCompanies`, filtrer les domaines inutiles.
Exemples à bloquer : `insee.fr`, `*.gouv.fr`, `societe.com`, `infogreffe.fr`,
`welcometothejungle.com`, `indeed.fr`, `linkedin.com`, `glassdoor.fr`,
`leboncoin.fr`, `poleemploi.fr`, `apec.fr`, `monster.fr`.

---

### 4. Search limit trop bas (important)

Fichier : `src/lib/providers/search/brave.ts`

`DEFAULT_SEARCH_LIMIT = 3` → au maximum 3 companies possibles.
Minimum recommandé : 10. Idéal : 20.
Brave a 2000 req/mois — on peut se permettre 10–20 résultats par search.

---

### 5. uiCriteria imbriqués non normalisés (important)

Fichier : `src/lib/ai/prompts/extract-criteria.ts` ou côté UI

L'UI envoie `{"search": {"location": "À distance", "contractType": "CDI"}}` (objet imbriqué).
Le prompt construit des lignes `- search: [object Object]` — inutilisable par le LLM.
Solution : aplatir l'objet avant de le passer au prompt, ou normaliser côté UI avant l'envoi.

---

### 6. qualify et enrich sont séquentiels (performance)

Fichiers : `src/lib/pipeline/steps/qualify.ts`, `src/lib/pipeline/steps/enrich.ts`

Les boucles `for...of` séquentielles traitent les companies une par une.
Avec 10 companies, qualify fait 10 scrapes + 10 appels LLM en série.
Passer en `Promise.all` (ou batches de N pour respecter les rate limits).

---

### 7. `scrapedContent` manquant dans l'appel LLM qualify (bug)

Fichier : `src/lib/providers/llm/vercel.ts`

`QualifyInput` définit `scrapedContent?: string` dans l'interface.
Mais dans `vercel.ts`, l'appel `buildQualifyPrompt({ company, criteria })` ne passe pas `scrapedContent`.
Le prompt reçoit donc toujours un contenu vide — le LLM qualifie sans avoir lu le site.

---

## Ordre d'implémentation recommandé

| Priorité | Changement                                | Impact                                         |
| -------- | ----------------------------------------- | ---------------------------------------------- |
| 1        | Blocklist domaines + filter dans discover | Élimine les faux positifs immédiats            |
| 2        | `buildSearchQuery` signal-aware           | Trouve de vraies companies cibles              |
| 3        | Augmenter search limit à 10–20            | Plus de candidats dans le pipeline             |
| 4        | Fixer SIREN comme domain                  | Arrête la disparition silencieuse de companies |
| 5        | Normaliser uiCriteria                     | Critères UI pris en compte                     |
| 6        | Fix `scrapedContent` dans qualify LLM     | LLM qualifie avec le vrai contenu du site      |
| 7        | Paralléliser qualify + enrich             | Performance (temps pipeline divisé par ~5)     |
