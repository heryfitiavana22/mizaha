import type { Result } from "@/types";

export type ScrapedContent = {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
};

export interface ScraperProvider {
  readonly name: string;
  scrape(url: string): Promise<Result<ScrapedContent>>;
}
