"use client";

import { use, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyList } from "@/components/companies/company-list";
import { StatusBadge } from "@/components/companies/status-badge";
import type { CompanyResult } from "@/components/companies/company-card";

type SearchStatus = "pending" | "running" | "completed" | "failed";

type SearchData = {
  search: {
    id: string;
    rawQuery: string;
    useCase: string | null;
    status: string | null;
    createdAt: string | null;
  };
  results: CompanyResult[];
};

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES: SearchStatus[] = ["completed", "failed"];

async function loadSearchData({
  id,
}: {
  id: string;
}): Promise<{ data: SearchData } | { notFound: true } | { error: true }> {
  const response = await fetch(`/api/searches/${id}`);
  if (response.status === 404) return { notFound: true };
  if (!response.ok) return { error: true };
  return { data: (await response.json()) as SearchData };
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function SearchResultsPage({ params }: PageProps) {
  const { id } = use(params);
  const [data, setData] = useState<SearchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSearchData({ id }).then((result) => {
      if ("notFound" in result) setError("Recherche introuvable.");
      else if ("error" in result) setError("Erreur lors du chargement.");
      else setData(result.data);
    });
  }, [id]);

  useEffect(() => {
    const status = data?.search.status as SearchStatus | undefined;
    if (!status || TERMINAL_STATUSES.includes(status)) return;

    const interval = setInterval(() => {
      loadSearchData({ id }).then((result) => {
        if ("data" in result) setData(result.data);
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [id, data?.search.status]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { search, results } = data;
  const status = search.status as SearchStatus | null;
  const isPending = status === "pending" || status === "running";

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold truncate">{search.rawQuery}</h1>
          <StatusBadge status={status} />
        </div>
        {search.useCase && (
          <p className="text-sm text-muted-foreground">
            Cas d&apos;usage : {search.useCase}
          </p>
        )}
      </div>

      {isPending && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            La recherche est en cours, cela peut prendre 1 à 5 minutes…
          </p>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {status === "failed" && (
        <p className="text-sm text-destructive">
          La recherche a échoué. Veuillez réessayer.
        </p>
      )}

      {status === "completed" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {results.length} entreprise{results.length !== 1 ? "s" : ""} trouvée
            {results.length !== 1 ? "s" : ""}
          </p>
          <CompanyList companies={results} />
        </div>
      )}
    </div>
  );
}
