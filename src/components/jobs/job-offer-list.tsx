import { JobOfferCard, type JobOfferResult } from "./job-offer-card";

type JobOfferListProps = {
  offers: JobOfferResult[];
};

export function JobOfferList({ offers }: JobOfferListProps) {
  if (offers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune offre trouvée.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {offers.map((offer) => (
        <JobOfferCard key={offer.entityId} offer={offer} />
      ))}
    </div>
  );
}
