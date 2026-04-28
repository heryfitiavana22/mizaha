import { Badge } from "@/components/ui/badge";
import type { ProviderSlot } from "./types";

export function ProviderBadges({ slots }: { slots: ProviderSlot[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Providers</span>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot, index) => (
          <div key={index} className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
              {slot.primary}
            </Badge>
            {slot.backup && (
              <>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge
                  variant={slot.usedFallback ? "destructive" : "outline"}
                  className="text-xs font-mono px-1.5 py-0 opacity-60"
                >
                  {slot.backup}
                  {slot.usedFallback && " ⚡"}
                </Badge>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
