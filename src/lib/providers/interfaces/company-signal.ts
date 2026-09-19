import type { Result, SignalSource } from "@/types";

export type CompanySignal = {
  companyName: string;
  profileUrl?: string;
};

export type CompanyDiscoveryCriteria = {
  keywords?: string[];
  limit?: number;
};

export interface CompanySignalProvider {
  readonly name: string;
  readonly signalSource: SignalSource;
  discoverCompanies(
    criteria: CompanyDiscoveryCriteria,
  ): Promise<Result<CompanySignal[]>>;
}
