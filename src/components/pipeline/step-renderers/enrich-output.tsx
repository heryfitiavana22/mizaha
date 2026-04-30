type EnrichedCompany = {
  name: string;
  domain: string;
  contacts: {
    email?: string | null;
    name?: string | null;
    title?: string | null;
  }[];
};

export function EnrichOutput({ data }: { data: Record<string, unknown> }) {
  const companies: EnrichedCompany[] = Array.isArray(data)
    ? (data as EnrichedCompany[])
    : [];

  if (!companies.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise enrichie
      </span>
    );

  return (
    <div className="flex flex-col gap-2">
      {companies.map((company) => {
        const contactCount = company.contacts?.length ?? 0;
        return (
          <div
            key={company.domain}
            className="flex flex-col gap-0.5 border-l-2 border-border pl-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{company.name}</span>
              <span className="text-xs text-muted-foreground">
                {company.domain}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {contactCount} contact{contactCount !== 1 ? "s" : ""}
              </span>
            </div>
            {company.contacts?.map((contact) =>
              contact.email ? (
                <div
                  key={contact.email}
                  className="text-xs text-muted-foreground pl-2"
                >
                  {contact.name && (
                    <span className="font-medium text-foreground">
                      {contact.name}
                    </span>
                  )}
                  {contact.title && <span> · {contact.title}</span>}
                  {" · "}
                  <span className="font-mono">{contact.email}</span>
                </div>
              ) : null,
            )}
          </div>
        );
      })}
    </div>
  );
}
