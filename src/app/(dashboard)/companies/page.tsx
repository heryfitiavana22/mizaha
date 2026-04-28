import Link from "next/link";
import { env } from "@/env";
import { SearchCard } from "@/components/companies/search-card";
import type { SearchRow } from "@/components/companies/search-card";

async function fetchSearches(): Promise<SearchRow[]> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/searches`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  return (await response.json()) as SearchRow[];
}

export default async function CompaniesPage() {
  const searches = await fetchSearches();

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recherches</h1>
        <Link
          href="/searches/new"
          className="text-sm text-primary hover:underline"
        >
          + Nouvelle recherche
        </Link>
      </div>

      {searches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Aucune recherche pour l&apos;instant.{" "}
          <Link href="/searches/new" className="text-primary hover:underline">
            Lancez votre première recherche.
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {searches.map((search) => (
            <SearchCard key={search.id} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}
